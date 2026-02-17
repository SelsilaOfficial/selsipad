/**
 * POST /api/v1/bonding/:pool_id/migrate/confirm
 * Execute DEX migration after fee payment verification
 * Creates LP Lock (FASE 5 integration)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MigrateConfirmRequest, MigrateConfirmResponse } from '@selsipad/shared';
import { verifyBondingOperation } from '@/lib/solana-verification';

const MIGRATION_FEE_SOL = 2500000000n; // 2.5 SOL
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || 'TREASURY_PLACEHOLDER';
const MIN_LP_LOCK_MONTHS = 12;

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { pool_id: string } }
): Promise<NextResponse<MigrateConfirmResponse | { error: string }>> {
  try {
    const { pool_id } = params;
    const body: MigrateConfirmRequest = await request.json();
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

    // Get pool with service role
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

    // Verify pool is GRADUATING
    if (pool.status !== 'GRADUATING') {
      return NextResponse.json(
        { error: `Pool must be GRADUATING. Current status: ${pool.status}` },
        { status: 400 }
      );
    }

    // Check idempotency
    if (pool.migration_fee_verified && pool.migration_fee_tx_hash === fee_tx_hash) {
      return NextResponse.json({
        success: true,
        dex_pool_address: pool.dex_pool_address || 'PENDING',
        migration_tx_hash: pool.migration_tx_hash || 'PENDING',
        lp_lock_id: pool.lp_lock_id || 'PENDING',
        message: 'Migration already processed',
      });
    }

    // Verify migration fee on-chain via Solana RPC
    const verification = await verifyBondingOperation(
      'MIGRATE',
      fee_tx_hash,
      TREASURY_ADDRESS,
      MIGRATION_FEE_SOL
    );

    if (!verification.success) {
      await serviceSupabase.from('bonding_events').insert({
        pool_id: pool.id,
        event_type: 'MIGRATION_FAILED',
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
          error: verification.error || 'Migration fee verification failed',
          details: verification,
        },
        { status: 400 }
      );
    }

    // Update migration fee verified with target_dex
    await serviceSupabase
      .from('bonding_pools')
      .update({
        migration_fee_tx_hash: fee_tx_hash,
        migration_fee_verified: true,
        target_dex: pool.target_dex, // Use pool's previously selected DEX
      })
      .eq('id', pool.id);

    // Execute DEX pool creation (Raydium/Orca SDK)
    const migrationResult = await executeDEXMigration(pool);

    // Create LP Lock (FASE 5 integration)
    const lockEndDate = new Date();
    lockEndDate.setMonth(lockEndDate.getMonth() + MIN_LP_LOCK_MONTHS);

    const { data: lpLock, error: lpLockError } = await serviceSupabase
      .from('liquidity_locks')
      .insert({
        manager_id: user.id,
        project_id: pool.project_id,
        token_address: migrationResult.lp_token_mint,
        token_symbol: `${pool.token_symbol}-LP`,
        token_decimals: 9,
        locked_amount: migrationResult.lp_amount,
        chain: 'solana',
        lock_start: new Date().toISOString(),
        lock_end: lockEndDate.toISOString(),
        status: 'ACTIVE',
      })
      .select('id')
      .single();

    if (lpLockError) {
      console.error('LP Lock creation error:', lpLockError);
      return NextResponse.json({ error: 'Failed to create LP lock' }, { status: 500 });
    }

    // Insert dex_migration record
    await serviceSupabase.from('dex_migrations').insert({
      pool_id: pool.id,
      target_dex: pool.target_dex || 'RAYDIUM',
      sol_migrated: pool.actual_sol_reserves,
      tokens_migrated: pool.actual_token_reserves,
      migration_fee_paid: MIGRATION_FEE_SOL.toString(),
      migration_fee_tx_hash: fee_tx_hash,
      dex_pool_address: migrationResult.dex_pool_address,
      creation_tx_hash: migrationResult.creation_tx_hash,
      lp_token_mint: migrationResult.lp_token_mint,
      lp_amount_locked: migrationResult.lp_amount,
      lp_lock_id: lpLock.id,
      lp_lock_duration_months: MIN_LP_LOCK_MONTHS,
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    });

    // Update pool status: GRADUATING → GRADUATED
    await serviceSupabase
      .from('bonding_pools')
      .update({
        status: 'GRADUATED',
        dex_pool_address: migrationResult.dex_pool_address,
        migration_tx_hash: migrationResult.creation_tx_hash,
        lp_lock_id: lpLock.id,
        graduated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pool.id);

    //  Create bonding events
    await serviceSupabase.from('bonding_events').insert([
      {
        pool_id: pool.id,
        event_type: 'MIGRATION_FEE_PAID',
        event_data: {
          intent_id,
          fee_tx_hash,
          amount: MIGRATION_FEE_SOL.toString(),
        },
        triggered_by: user.id,
      },
      {
        pool_id: pool.id,
        event_type: 'MIGRATION_COMPLETED',
        event_data: {
          dex_pool_address: migrationResult.dex_pool_address,
          creation_tx_hash: migrationResult.creation_tx_hash,
          lp_lock_id: lpLock.id,
        },
        triggered_by: user.id,
      },
      {
        pool_id: pool.id,
        event_type: 'LP_LOCK_CREATED',
        event_data: {
          lp_lock_id: lpLock.id,
          lock_duration_months: MIN_LP_LOCK_MONTHS,
          lp_amount: migrationResult.lp_amount,
        },
        triggered_by: user.id,
      },
    ]);

    const response: MigrateConfirmResponse = {
      success: true,
      dex_pool_address: migrationResult.dex_pool_address,
      migration_tx_hash: migrationResult.creation_tx_hash,
      lp_lock_id: lpLock.id,
      message: 'Migration completed successfully. Pool graduated with LP locked for 12 months.',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Migration confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Execute DEX pool creation and liquidity migration
 * Supports both Raydium and Orca
 * TODO: Implement actual DEX SDK integration
 */
async function executeDEXMigration(pool: any): Promise<{
  dex_pool_address: string;
  creation_tx_hash: string;
  lp_token_mint: string;
  lp_amount: string;
}> {
  // TODO: Integration with DEX SDKs
  // For RAYDIUM:
  //   - Use @raydium-io/raydium-sdk
  //   - Call createPool() with SOL + token reserves
  //   - Add initial liquidity
  //   - Return pool ID, LP mint, and tx hash
  //
  // For ORCA:
  //   - Use @orca-so/sdk
  //   - Call createPool() with token pair
  //   - Set up liquidity provision
  //   - Return pool address, LP mint, and tx hash
  //
  // In both cases:
  //   - Sign with creator's keypair (via Phantom wallet integration)
  //   - Broadcast to Solana network
  //   - Confirm transaction before returning

  console.log('TODO: Execute DEX migration for pool', pool.id);
  console.log('Target DEX:', pool.target_dex || 'RAYDIUM');

  // Placeholder: Returns mock data
  return {
    dex_pool_address: `DEX_POOL_${pool.id.substring(0, 8)}`,
    creation_tx_hash: `TX_${Date.now()}`,
    lp_token_mint: `LP_MINT_${pool.id.substring(0, 8)}`,
    lp_amount: '1000000000', // Placeholder LP amount
  };
}
