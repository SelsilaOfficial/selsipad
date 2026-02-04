/**
 * GET /api/user/projects
 * 
 * Get all projects for authenticated user
 * Supports filtering by type (FAIRLAUNCH, PRESALE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const type = searchParams.get('type'); // FAIRLAUNCH, PRESALE, or null for all

    // 3. Build query
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
          escrow_tx_hash,
          escrow_amount,
          creation_fee_paid,
          creation_fee_tx_hash,
          admin_deployer_id,
          deployed_at,
          paused_at,
          pause_reason,
          total_raised,
          total_participants
        )
      `)
      .eq('owner_user_id', session.userId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type.toUpperCase());
    }

    const { data: projects, error } = await query;

    if (error) {
      console.error('[User Projects] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      projects: projects || [],
    });

  } catch (error: any) {
    console.error('[User Projects] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
