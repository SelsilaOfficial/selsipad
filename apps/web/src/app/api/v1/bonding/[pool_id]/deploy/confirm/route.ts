/**
 * POST /api/v1/bonding/:pool_id/deploy/confirm
 * Confirm deploy fee payment and initiate on-chain deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DeployConfirmRequest, DeployConfirmResponse } from '@selsipad/shared';
import { verifyBondingOperation } from '@/lib/solana-verification';

const DEPLOY_FEE_SOL = 500000000n; // 0.5 SOL in lamports
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || 'TREASURY_PLACEHOLDER';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { pool_id: string } }
): Promise<NextResponse<DeployConfirmResponse | { error: string }>> {
  try {
    const { pool_id } = params;
    const body: DeployConfirmRequest = await request.json();
    const { intent_id, fee_tx_hash } = body;

    if (!intent_id || !fee_tx_hash) {
      return NextResponse.json(
        { error: 'Missing required fields: intent_id, fee_tx_hash' },
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

    // Get pool with service role (to update status)
    const serviceSupabase = createClient();
    const { data: pool, error: poolError } = await serviceSupabase
      .from('bonding_pools')
      .select('*')
      .eq('id', pool_id)
      .single();

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Verify user is creator
    if (pool.creator_id !== user.id) {
      return NextResponse.json({ error: 'Not pool creator' }, { status: 403 });
    }

    // Verify pool is in DRAFT status
    if (pool.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Pool must be in DRAFT status. Current status: ${pool.status}` },
        { status: 400 }
      );
    }

    // Check if already verified (idempotency)
    if (pool.deploy_tx_verified && pool.deploy_tx_hash === fee_tx_hash) {
      return NextResponse.json({
        success: true,
        pool_status: pool.status as 'DEPLOYING' | 'FAILED',
        deploy_tx_hash: pool.deploy_tx_hash,
        message: 'Deploy fee already verified',
      });
    }

    // Verify transaction on-chain via Solana RPC
    const verification = await verifyBondingOperation(
      'DEPLOY',
      fee_tx_hash,
      TREASURY_ADDRESS,
      DEPLOY_FEE_SOL
    );

    if (!verification.success) {
      // Record failed attempt
      await serviceSupabase.from('bonding_events').insert({
        pool_id: pool.id,
        event_type: 'DEPLOY_FAILED',
        event_data: {
          intent_id,
          fee_tx_hash,
          reason: verification.error,
          verification_details: verification,
        },
        triggered_by: user.id,
      });

      return NextResponse.json(
        {
          error: verification.error || 'Transaction verification failed',
          details: verification,
        },
        { status: 400 }
      );
    }

    // Update pool status: DRAFT → DEPLOYING
    const { error: updateError } = await serviceSupabase
      .from('bonding_pools')
      .update({
        status: 'DEPLOYING',
        deploy_tx_hash: fee_tx_hash,
        deploy_tx_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pool.id);

    if (updateError) {
      console.error('Pool update error:', updateError);
      return NextResponse.json({ error: 'Failed to update pool status' }, { status: 500 });
    }

    // Create bonding events
    await serviceSupabase.from('bonding_events').insert([
      {
        pool_id: pool.id,
        event_type: 'DEPLOY_FEE_PAID',
        event_data: {
          intent_id,
          fee_tx_hash,
          amount: DEPLOY_FEE_SOL.toString(),
        },
        triggered_by: user.id,
      },
      {
        pool_id: pool.id,
        event_type: 'DEPLOY_STARTED',
        event_data: {
          fee_tx_hash,
          target_status: 'DEPLOYING',
        },
        triggered_by: user.id,
      },
    ]);

    // TODO: Trigger on-chain pool deployment via worker
    // Worker will update status to LIVE when complete

    const response: DeployConfirmResponse = {
      success: true,
      pool_status: 'DEPLOYING',
      deploy_tx_hash: fee_tx_hash,
      message: 'Deploy fee verified. Pool deployment initiated.',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Deploy confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
