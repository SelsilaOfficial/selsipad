import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: leaderboard } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, active_referral_count')
      .gt('active_referral_count', 0)
      .order('active_referral_count', { ascending: false })
      .limit(100);

    const leaderboardWithRank = (leaderboard || []).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    return NextResponse.json({ leaderboard: leaderboardWithRank });
  } catch (error) {
    console.error('Error in GET /api/v1/referral/leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
