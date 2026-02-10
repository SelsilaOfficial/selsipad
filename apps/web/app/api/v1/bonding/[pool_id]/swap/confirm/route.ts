/**
 * POST /api/v1/bonding/:pool_id/swap/confirm
 * Execute swap and record fee split (1.5% → 50% Treasury / 50% Referral Pool)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateAMMSwap,
  checkGraduationThreshold,
  type SwapConfirmRequest,
  type SwapConfirmResponse,
} from '@selsipad/shared';
import { verifyTransactionExists } from '@/lib/solana-verification';

export async function POST(
  request: NextRequest,
  { params }: { params: { pool_id: string } }
): Promise<NextResponse<SwapConfirmResponse | { error: string }>> {
  try {
    const { pool_id } = params;
    const body: SwapConfirmRequest = await request.json();
    const { intent_id, tx_hash } = body;

    if (!intent_id || !tx_hash) {
      return NextResponse.json(
        { error: 'Missing required fields: intent_id, tx_hash' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pool (use service role for updates)
    const serviceSupabase = createClient();
    const { data: pool, error: poolError } = await serviceSupabase
      .from('bonding_pools')
      .select('*')
      .eq('id', pool_id)
      .single();

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Verify pool is LIVE
    if (pool.status !== 'LIVE') {
      return NextResponse.json(
        { error: `Pool must be LIVE. Current status: ${pool.status}` },
        { status: 400 }
      );
    }

    // Check for duplicate tx_hash (idempotency)
    const { data: existingSwap } = await serviceSupabase
      .from('bonding_swaps')
      .select('id, output_amount')
      .eq('tx_hash', tx_hash)
      .single();

    if (existingSwap) {
      return NextResponse.json({
        success: true,
        swap_id: existingSwap.id,
        actual_output: existingSwap.output_amount,
        message: 'Swap already processed',
      });
    }

    // Verify transaction exists on-chain
    const txStatus = await verifyTransactionExists(tx_hash);
    if (!txStatus) {
      return NextResponse.json(
        {
          error:
            'Transaction not found on Solana blockchain. Please ensure transaction was submitted.',
        },
        { status: 400 }
      );
    }

    if (txStatus.err) {
      return NextResponse.json(
        { error: `Transaction failed on-chain: ${JSON.stringify(txStatus.err)}` },
        { status: 400 }
      );
    }

    // Extract swap details from tx (placeholder - would be done via tx decoding service)
    const { swap_type, input_amount } = await extractSwapFromTx(tx_hash);

    // Calculate actual swap output
    const calculation = calculateAMMSwap(
      swap_type,
      BigInt(input_amount),
      BigInt(pool.virtual_sol_reserves),
      BigInt(pool.virtual_token_reserves),
      pool.swap_fee_bps
    );

    // Get user's referrer (if exists)
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    const { data: referralRel } = await serviceSupabase
      .from('referral_relationships')
      .select('referrer_id')
      .eq('referee_id', user.id)
      .eq('activated', true)
      .single();

    const referrerId = referralRel?.referrer_id || null;

    // Insert swap record
    const { data: swapRecord, error: swapError } = await serviceSupabase
      .from('bonding_swaps')
      .insert({
        pool_id: pool.id,
        user_id: user.id,
        swap_type,
        input_amount: calculation.input_amount.toString(),
        output_amount: calculation.output_amount.toString(),
        price_per_token: calculation.price_per_token.toString(),
        swap_fee_amount: calculation.swap_fee.toString(),
        treasury_fee: calculation.treasury_fee.toString(),
        referral_pool_fee: calculation.referral_pool_fee.toString(),
        tx_hash,
        signature_verified: true, // TODO: Set based on Tx Manager verification
        referrer_id: referrerId,
        sol_reserves_before: pool.actual_sol_reserves,
        token_reserves_before: pool.actual_token_reserves,
        sol_reserves_after: (swap_type === 'BUY'
          ? BigInt(pool.actual_sol_reserves) + (calculation.input_amount - calculation.swap_fee)
          : BigInt(pool.actual_sol_reserves) - calculation.output_amount
        ).toString(),
        token_reserves_after: (swap_type === 'BUY'
          ? BigInt(pool.actual_token_reserves) - calculation.output_amount
          : BigInt(pool.actual_token_reserves) + (calculation.input_amount - calculation.swap_fee)
        ).toString(),
      })
      .select('id')
      .single();

    if (swapError) {
      console.error('Swap insert error:', swapError);
      return NextResponse.json({ error: 'Failed to record swap' }, { status: 500 });
    }

    // Insert fee split (FASE 6 integration)
    await serviceSupabase.from('fee_splits').insert({
      source_type: 'BONDING_SWAP',
      source_id: swapRecord.id,
      total_amount: calculation.swap_fee.toString(),
      treasury_amount: calculation.treasury_fee.toString(),
      referral_pool_amount: calculation.referral_pool_fee.toString(),
      treasury_percent: 50,
      referral_pool_percent: 50,
      asset: 'SOL',
      chain: 'solana',
      processed: false,
    });

    // Update pool reserves
    const newSolReserves =
      swap_type === 'BUY'
        ? BigInt(pool.actual_sol_reserves) + (calculation.input_amount - calculation.swap_fee)
        : BigInt(pool.actual_sol_reserves) - calculation.output_amount;

    const newTokenReserves =
      swap_type === 'BUY'
        ? BigInt(pool.actual_token_reserves) - calculation.output_amount
        : BigInt(pool.actual_token_reserves) + (calculation.input_amount - calculation.swap_fee);

    await serviceSupabase
      .from('bonding_pools')
      .update({
        actual_sol_reserves: newSolReserves.toString(),
        actual_token_reserves: newTokenReserves.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pool.id);

    // Create bonding event
    await serviceSupabase.from('bonding_events').insert({
      pool_id: pool.id,
      event_type: 'SWAP_EXECUTED',
      event_data: {
        swap_id: swapRecord.id,
        swap_type,
        input_amount: calculation.input_amount.toString(),
        output_amount: calculation.output_amount.toString(),
        tx_hash,
      },
      triggered_by: user.id,
    });

    // Check graduation threshold
    const graduationCheck = checkGraduationThreshold(
      newSolReserves.toString(),
      pool.graduation_threshold_sol
    );

    if (graduationCheck.threshold_met && pool.status === 'LIVE') {
      // Trigger graduation
      await serviceSupabase
        .from('bonding_pools')
        .update({ status: 'GRADUATING' })
        .eq('id', pool.id);

      await serviceSupabase.from('bonding_events').insert({
        pool_id: pool.id,
        event_type: 'GRADUATION_THRESHOLD_REACHED',
        event_data: {
          actual_sol: newSolReserves.toString(),
          threshold_sol: pool.graduation_threshold_sol,
        },
        triggered_by: null, // System event
      });
    }

    const response: SwapConfirmResponse = {
      success: true,
      swap_id: swapRecord.id,
      actual_output: calculation.output_amount.toString(),
      message: 'Swap executed successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Swap confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Extract swap details from transaction
 * TODO: Replace with actual transaction decoder or Solana program event indexer
 * For now, this is a placeholder that would need to:
 * 1. Decode the transaction instructions
 * 2. Parse the bonding curve program instructions
 * 3. Extract swap_type (BUY/SELL) and input_amount
 */
async function extractSwapFromTx(
  txHash: string
): Promise<{ swap_type: 'BUY' | 'SELL'; input_amount: string }> {
  // Placeholder: In production, this should:
  // 1. Use @solana/web3.js Connection.getTransaction()
  // 2. Decode transaction instructions
  // 3. Match against bonding curve program instructions
  // 4. Extract swap details from instruction data
  // 5. Return actual values

  console.log('TODO: Extract swap from tx via program instruction decoder', txHash);

  // Mock data for development - in production, extract from actual tx
  return {
    swap_type: 'BUY',
    input_amount: '100000000', // 0.1 SOL
  };
}
