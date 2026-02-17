/**
 * POST /api/v1/bonding/:pool_id/migrate/intent
 * Generate migration intent with 2.5 SOL fee requirement
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MigrateIntentRequest, MigrateIntentResponse } from '@selsipad/shared';

const MIGRATION_FEE_SOL = 2500000000n; // 2.5 SOL in lamports
const INTENT_EXPIRY_MINUTES = 10;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || 'TREASURY_PLACEHOLDER';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { pool_id: string } }
): Promise<NextResponse<MigrateIntentResponse | { error: string }>> {
  try {
    const { pool_id } = params;
    const body: MigrateIntentRequest = await request.json();
    const { target_dex } = body;

    if (!target_dex || (target_dex !== 'RAYDIUM' && target_dex !== 'ORCA')) {
      return NextResponse.json(
        { error: 'Invalid target_dex. Must be RAYDIUM or ORCA' },
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

    // Get pool
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

    // Verify pool is in GRADUATING status
    if (pool.status !== 'GRADUATING') {
      return NextResponse.json(
        { error: `Pool must be GRADUATING to migrate. Current status: ${pool.status}` },
        { status: 400 }
      );
    }

    // Generate intent ID
    const intentId = `migrate_${pool_id}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + INTENT_EXPIRY_MINUTES * 60 * 1000);

    // Create bonding event
    await supabase.from('bonding_events').insert({
      pool_id: pool.id,
      event_type: 'MIGRATION_INTENT_GENERATED',
      event_data: {
        intent_id: intentId,
        target_dex,
        required_fee: MIGRATION_FEE_SOL.toString(),
        expires_at: expiresAt.toISOString(),
      },
      triggered_by: user.id,
    });

    const response: MigrateIntentResponse = {
      intent_id: intentId,
      treasury_address: TREASURY_ADDRESS,
      required_fee_lamports: MIGRATION_FEE_SOL.toString(),
      expires_at: expiresAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Migration intent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
