/**
 * GET /api/v1/referral/rewards - Get claimable rewards by chain
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceRoleClient();
    const userId = session.userId;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') || 'CLAIMABLE';

    const { data: rewards } = await supabase
      .from('referral_ledger')
      .select('*')
      .eq('referrer_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    return NextResponse.json({ rewards: rewards || [] });
  } catch (error) {
    console.error('Error in GET /api/v1/referral/rewards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
