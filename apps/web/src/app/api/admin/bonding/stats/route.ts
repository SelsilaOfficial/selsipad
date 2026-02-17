/**
 * GET /api/admin/bonding/stats
 * Admin: Aggregated stats for bonding curve system
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get total pools by status
    const { data: statusCounts } = await supabase.rpc('get_bonding_pool_status_counts');
    // Note: Since we don't have this RPC properly setup yet, we'll do raw count queries in parallel
    // or just select all status and aggregate in memory if data size allows,
    // but for admin stats doing specific count queries is safer.

    // Alternative: Parallel count queries (more efficient for low throughput admin)
    const [
      { count: totalPools },
      { count: livePools },
      { count: graduatedPools },
      { data: feeStats },
    ] = await Promise.all([
      supabase.from('bonding_pools').select('*', { count: 'exact', head: true }),
      supabase
        .from('bonding_pools')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'LIVE'),
      supabase
        .from('bonding_pools')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'GRADUATED'),
      supabase
        .from('bonding_pools')
        .select('actual_sol_reserves, deploy_fee_sol, migration_fee_sol'),
    ]);

    // Calculate total volume (SOL collected) and fees
    // For exact volume we should sum from swaps, but pools reserves give a snapshot
    // But better to use `bonding_swaps` for volume

    const { data: swapStats } = await supabase
      .from('bonding_swaps')
      .select(
        'input_amount, output_amount, swap_type, swap_fee_amount, treasury_fee, referral_pool_fee'
      );

    let totalVolumeSol = 0n;
    let totalSwapFees = 0n;
    let totalTreasuryFees = 0n;
    let totalReferralFees = 0n;

    if (swapStats) {
      for (const swap of swapStats) {
        if (swap.swap_type === 'BUY') {
          totalVolumeSol += BigInt(swap.input_amount);
        } else {
          totalVolumeSol += BigInt(swap.output_amount);
        }
        totalSwapFees += BigInt(swap.swap_fee_amount);
        totalTreasuryFees += BigInt(swap.treasury_fee);
        totalReferralFees += BigInt(swap.referral_pool_fee);
      }
    }

    // Deploy fees = 0.5 SOL * total pools (excluding draft/failed theoretically, but simple approx)
    // Detailed:
    const { count: deployedCount } = await supabase
      .from('bonding_pools')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'DRAFT');

    const totalDeployFees = BigInt(deployedCount || 0) * 500000000n; // 0.5 SOL

    // Migration fees
    const { count: migratedCount } = await supabase
      .from('dex_migrations') // Using dex_migrations table
      .select('*', { count: 'exact', head: true })
      .eq('status', 'COMPLETED');

    const totalMigrationFees = BigInt(migratedCount || 0) * 2500000000n; // 2.5 SOL

    const grandTotalTreasurySol = totalTreasuryFees + totalDeployFees + totalMigrationFees;

    return NextResponse.json({
      pools: {
        total: totalPools,
        live: livePools,
        graduated: graduatedPools,
        deployed: deployedCount,
      },
      volume: {
        total_sol: totalVolumeSol.toString(),
      },
      fees: {
        swap: totalSwapFees.toString(),
        treasury_swap: totalTreasuryFees.toString(),
        referral_pool: totalReferralFees.toString(),
        deploy: totalDeployFees.toString(),
        migration: totalMigrationFees.toString(),
        total_treasury: grandTotalTreasurySol.toString(),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/bonding/stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
