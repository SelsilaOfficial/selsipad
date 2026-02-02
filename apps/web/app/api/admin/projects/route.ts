/**
 * GET /api/admin/projects
 * 
 * Get all projects for admin dashboard
 * Includes pending deploy and live projects
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_WALLETS = (process.env.ADMIN_WALLET_ADDRESSES || '').split(',').map(a => a.toLowerCase());

export async function GET(request: Request) {
  try {
    // 1. Verify admin authentication
    const { getServerSession } = await import('@/lib/auth/session');
    const session = await getServerSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminWallet = session.address.toLowerCase();
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.userId)
      .single();

    if (!profile?.is_admin && !ADMIN_WALLETS.includes(adminWallet)) {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // 2. Fetch all projects with launch rounds
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        *,
        launch_rounds (
          id,
          round_type,
          softcap,
          hardcap,
          tokens_for_sale,
          start_time,
          end_time,
          escrow_tx_hash,
          escrow_amount,
          creation_fee_paid,
          creation_fee_tx_hash,
          deployed_at,
          paused_at,
          pause_reason,
          total_raised,
          contributor_count
        )
      `)
      .in('status', ['PENDING_DEPLOY', 'LIVE', 'PAUSED', 'ENDED'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin Projects] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      projects: projects || [],
    });

  } catch (error: any) {
    console.error('[Admin Projects] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
