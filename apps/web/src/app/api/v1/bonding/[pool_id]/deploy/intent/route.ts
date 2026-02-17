/**
 * POST /api/v1/bonding/:pool_id/deploy/intent
 * Generate deploy intent with 0.5 SOL fee requirement
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DeployIntentResponse } from '@selsipad/shared';

const DEPLOY_FEE_SOL = 500000000n; // 0.5 SOL in lamports
const INTENT_EXPIRY_MINUTES = 10;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || 'TREASURY_PLACEHOLDER';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { pool_id: string } }
): Promise<NextResponse<DeployIntentResponse | { error: string }>> {
  try {
    const { pool_id } = params;

    // Get authenticated user
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pool and verify ownership
    const { data: pool, error: poolError } = await supabase
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

    // Generate intent ID
    const intentId = `deploy_${pool_id}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + INTENT_EXPIRY_MINUTES * 60 * 1000);

    // TODO: Store intent in cache/database with expiry for verification
    // For now, we'll verify based on tx_hash in confirm endpoint

    // Create bonding event
    await supabase.from('bonding_events').insert({
      pool_id: pool.id,
      event_type: 'DEPLOY_INTENT_GENERATED',
      event_data: {
        intent_id: intentId,
        required_fee: DEPLOY_FEE_SOL.toString(),
        expires_at: expiresAt.toISOString(),
      },
      triggered_by: user.id,
    });

    const response: DeployIntentResponse = {
      intent_id: intentId,
      treasury_address: TREASURY_ADDRESS,
      required_amount_lamports: DEPLOY_FEE_SOL.toString(),
      expires_at: expiresAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Deploy intent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
