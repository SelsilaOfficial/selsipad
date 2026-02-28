/**
 * GET /api/user/projects
 * 
 * Get all projects for authenticated user
 * Supports filtering by type (FAIRLAUNCH, PRESALE, BONDING_CURVE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { getServerSession } = await import('@/lib/auth/session');
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get query params
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // FAIRLAUNCH, PRESALE, BONDING_CURVE, or null for all

    // 3. Fetch regular projects (FAIRLAUNCH / PRESALE)
    let projects: any[] = [];
    if (!type || type !== 'BONDING_CURVE') {
      let query = supabase
        .from('projects')
        .select(`
          *,
          launch_rounds (
            id,
            type,
            params,
            start_at,
            end_at,
            status,
            result,
            escrow_tx_hash,
            escrow_amount,
            creation_fee_paid,
            creation_fee_tx_hash,
            admin_deployer_id,
            deployed_at,
            paused_at,
            pause_reason,
            total_raised,
            total_participants,
            finalized_at
          )
        `)
        .eq('owner_user_id', session.userId)
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('type', type.toUpperCase());
      }

      const { data, error } = await query;
      if (error) {
        console.error('[User Projects] Projects query error:', error);
      } else {
        projects = data || [];
      }
    }

    // 4. Fetch bonding curve pools
    let bondingCurves: any[] = [];
    if (!type || type === 'BONDING_CURVE') {
      const { data: pools, error: poolError } = await supabase
        .from('bonding_pools')
        .select(`
          id,
          token_address,
          token_name,
          token_symbol,
          status,
          chain_id,
          creator_wallet,
          logo_url,
          description,
          actual_native_reserves,
          graduation_threshold_native,
          target_dex,
          dex_pool_address,
          deployed_at,
          graduated_at,
          failed_at,
          created_at,
          updated_at
        `)
        .eq('creator_id', session.userId)
        .order('created_at', { ascending: false });

      if (poolError) {
        console.error('[User Projects] Bonding pools query error:', poolError);
      } else {
        // Map bonding pools to a unified project-like shape
        bondingCurves = (pools || []).map((pool) => ({
          id: pool.id,
          name: pool.token_name,
          symbol: pool.token_symbol,
          description: pool.description,
          logo_url: pool.logo_url,
          type: 'BONDING_CURVE',
          status: pool.status,
          chain_id: pool.chain_id,
          token_address: pool.token_address,
          creator_wallet: pool.creator_wallet,
          created_at: pool.created_at,
          bonding_data: {
            actual_native_reserves: pool.actual_native_reserves,
            graduation_threshold_native: pool.graduation_threshold_native,
            target_dex: pool.target_dex,
            dex_pool_address: pool.dex_pool_address,
            deployed_at: pool.deployed_at,
            graduated_at: pool.graduated_at,
            failed_at: pool.failed_at,
          },
        }));
      }
    }

    // 5. Merge and sort by created_at desc
    const allProjects = [...projects, ...bondingCurves].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      projects: allProjects,
    });

  } catch (error: any) {
    console.error('[User Projects] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
