import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceRoleClient();
    const userId = session.userId;

    const { data: claims } = await supabase
      .from('referral_ledger')
      .select('*')
      .eq('referrer_id', userId)
      .eq('status', 'CLAIMED')
      .order('claimed_at', { ascending: false });

    return NextResponse.json({ claims: claims || [] });
  } catch (error) {
    console.error('Error in GET /api/v1/referral/claims:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
