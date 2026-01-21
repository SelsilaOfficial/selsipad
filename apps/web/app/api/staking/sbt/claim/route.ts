import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * POST /api/staking/sbt/claim
 *
 * Claim staking rewards with $10 flat fee
 *
 * Body: {
 *   positionId: string;
 *   amount: string; // Total claimable amount before fee
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { positionId, amount } = body;

    if (!positionId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const claimAmount = parseFloat(amount);
    const claimFee = 10.0;

    if (claimAmount < claimFee) {
      return NextResponse.json(
        { error: `Minimum claim amount is $${claimFee} to cover fee` },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Verify position ownership
    const { data: position } = await supabase
      .from('staking_positions')
      .select('*')
      .eq('id', positionId)
      .eq('user_id', session.userId)
      .single();

    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    if (position.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Position must be active to claim' }, { status: 400 });
    }

    // Generate idempotency key (daily bucket)
    const today = new Date().toISOString().split('T')[0];
    const idempotencyKey = `SBT_CLAIM:${positionId}:${today}`;

    // Check for duplicate claim
    const { data: existingClaim } = await supabase
      .from('staking_claims')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existingClaim) {
      return NextResponse.json({
        success: false,
        error: 'Already claimed today. Only one claim per day allowed.',
        existingClaim: {
          id: existingClaim.id,
          amount: existingClaim.claim_amount_usdt,
          status: existingClaim.status,
        },
      });
    }

    // Create claim record
    const netPayout = claimAmount - claimFee;

    const { data: claim, error: claimError } = await supabase
      .from('staking_claims')
      .insert({
        position_id: positionId,
        user_id: session.userId,
        claim_amount_usdt: claimAmount,
        claim_fee_paid: claimFee,
        status: 'PENDING',
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (claimError) {
      console.error('Error creating claim:', claimError);
      return NextResponse.json({ error: 'Failed to create claim' }, { status: 500 });
    }

    // TODO: Process actual payment
    // 1. Collect $10 fee from user
    // 2. Send net payout from reward pool
    // For now, mock as complete

    const mockFeePaymentTx = `0xFEE${Date.now().toString(16)}`;
    const mockPayoutTx = `0xPAY${Date.now().toString(16)}`;

    // Update claim with mock transactions
    const { data: updated } = await supabase
      .from('staking_claims')
      .update({
        fee_payment_tx: mockFeePaymentTx,
        payout_tx: mockPayoutTx,
        status: 'PAID_OUT',
        fee_paid_at: new Date().toISOString(),
        paid_out_at: new Date().toISOString(),
      })
      .eq('id', claim.id)
      .select()
      .single();

    // Update reward pool (deduct claimed amount)
    await supabase
      .from('staking_rewards_pool')
      .update({
        total_claimed: supabase.sql`total_claimed + ${claimAmount}`,
      })
      .eq('pool_name', 'SBT_STAKING');

    return NextResponse.json({
      success: true,
      data: {
        claimId: updated!.id,
        claimAmount: claimAmount.toFixed(2),
        feePaid: claimFee.toFixed(2),
        netPayout: netPayout.toFixed(2),
        feePaymentTx: mockFeePaymentTx,
        payoutTx: mockPayoutTx,
        status: updated!.status,
      },
    });
  } catch (error: any) {
    console.error('Error claiming rewards:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
