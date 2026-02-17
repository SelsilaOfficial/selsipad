/**
 * POST /api/v1/bonding
 * Create a new bonding curve pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CreateBondingPoolRequest, BondingPool } from '@selsipad/shared';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest
): Promise<NextResponse<Omit<BondingPool, 'deployment_data'> | { error: string }>> {
  try {
    const body: CreateBondingPoolRequest = await request.json();

    // Validate required fields
    const {
      project_id,
      token_name,
      token_symbol,
      token_decimals,
      total_supply,
      virtual_sol_reserves,
      virtual_token_reserves,
      graduation_threshold_sol,
      target_dex,
    } = body;

    if (
      !project_id ||
      !token_name ||
      !token_symbol ||
      !total_supply ||
      !virtual_sol_reserves ||
      !virtual_token_reserves ||
      !graduation_threshold_sol
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: project_id, token_name, token_symbol, total_supply, virtual_sol_reserves, virtual_token_reserves, graduation_threshold_sol',
        },
        { status: 400 }
      );
    }

    // Validate DEX choice
    if (target_dex && target_dex !== 'RAYDIUM' && target_dex !== 'ORCA') {
      return NextResponse.json(
        { error: 'Invalid target_dex. Must be RAYDIUM or ORCA' },
        { status: 400 }
      );
    }

    // Validate numeric ranges
    const tokenDecimals = token_decimals || 9;
    if (tokenDecimals < 0 || tokenDecimals > 18) {
      return NextResponse.json(
        { error: 'Token decimals must be between 0 and 18' },
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

    // Verify project exists and user is member/admin
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, creator_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is project creator or team member
    const { data: teamMember } = await supabase
      .from('project_team_members')
      .select('id')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .single();

    if (project.creator_id !== user.id && !teamMember) {
      return NextResponse.json(
        { error: 'You do not have permission to create pools for this project' },
        { status: 403 }
      );
    }

    // Use service role for pool creation
    const serviceSupabase = createClient();

    // Create bonding pool in DRAFT status
    const { data: pool, error: poolError } = await serviceSupabase
      .from('bonding_pools')
      .insert({
        project_id,
        creator_id: user.id,
        token_name,
        token_symbol,
        token_decimals: tokenDecimals,
        total_supply: BigInt(total_supply).toString(),
        virtual_sol_reserves: BigInt(virtual_sol_reserves).toString(),
        virtual_token_reserves: BigInt(virtual_token_reserves).toString(),
        actual_sol_reserves: '0',
        actual_token_reserves: BigInt(total_supply).toString(),
        deploy_fee_sol: '500000000', // 0.5 SOL (fixed)
        swap_fee_bps: 150, // 1.5% (fixed)
        graduation_threshold_sol: BigInt(graduation_threshold_sol).toString(),
        migration_fee_sol: '2500000000', // 2.5 SOL (fixed)
        status: 'DRAFT',
        target_dex: target_dex || 'RAYDIUM', // Default to RAYDIUM if not specified
      })
      .select()
      .single();

    if (poolError) {
      console.error('Pool creation error:', poolError);
      return NextResponse.json(
        { error: `Failed to create pool: ${poolError.message}` },
        { status: 500 }
      );
    }

    // Create bonding event
    await serviceSupabase.from('bonding_events').insert({
      pool_id: pool.id,
      event_type: 'POOL_CREATED',
      event_data: {
        token_name,
        token_symbol,
        virtual_sol_reserves: virtual_sol_reserves.toString(),
        virtual_token_reserves: virtual_token_reserves.toString(),
        target_dex: target_dex || 'RAYDIUM',
      },
      triggered_by: user.id,
    });

    return NextResponse.json(pool, { status: 201 });
  } catch (error) {
    console.error('Pool creation error:', error);
    return NextResponse.json({ error: `Internal server error: ${String(error)}` }, { status: 500 });
  }
}

/**
 * GET /api/v1/bonding
 * List bonding pools
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<BondingPool[] | { error: string }>> {
  try {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const projectId = searchParams.get('project_id');

    // Build query
    let query = supabase.from('bonding_pools').select('*');

    if (status) {
      query = query.eq('status', status);
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    // Filter by user (own pools or public pools)
    query = query.or(`creator_id.eq.${user.id},status.in.(LIVE,GRADUATING,GRADUATED)`);

    const { data: pools, error: poolsError } = await query.order('created_at', {
      ascending: false,
    });

    if (poolsError) {
      return NextResponse.json({ error: poolsError.message }, { status: 500 });
    }

    return NextResponse.json(pools || []);
  } catch (error) {
    console.error('Pool list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
