/**
 * GET /api/v1/referral/my-referrals
 * List all referrals with activation status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const supabase = createClient();

    const { data: referrals } = await supabase
      .from('referral_relationships')
      .select('*')
      .eq('referrer_id', session.userId)
      .order('created_at', { ascending: false });
    
    // Manually fetch profiles for all referees
    const refereeIds = referrals?.map(r => r.referee_id) || [];
    const { data: profiles } = refereeIds.length > 0
      ? await supabase
          .from('profiles')
          .select('user_id, username, avatar_url, created_at')
          .in('user_id', refereeIds)
      : { data: [] };
    
    // Create profile map for lookups
    const profileMap = new Map(
      (profiles || []).map(p => [p.user_id, p])
    );

    const referralsWithStatus = (referrals || []).map((ref) => {
      const profile = profileMap.get(ref.referee_id);
      return {
        ...ref,
        referee: profile,
        is_active: ref.activated_at !== null,
      };
    });

    return NextResponse.json({ referrals: referralsWithStatus });
  } catch (error) {
    console.error('Error in GET /api/v1/referral/my-referrals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
