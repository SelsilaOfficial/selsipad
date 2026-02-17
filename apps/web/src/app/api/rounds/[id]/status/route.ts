import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds/[id]/status
 * Get current pool status and statistics (public endpoint)
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get round
    const { data: round, error } = await supabase
      .from('launch_rounds')
      .select('status, result, total_raised, total_participants, start_at, end_at, type, params')
      .eq('id', params.id)
      .single();

    if (error || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Calculate time remaining
    const now = new Date();
    const startAt = new Date(round.start_at);
    const endAt = new Date(round.end_at);

    let timeRemainingSeconds: number | null = null;
    if (now < endAt) {
      timeRemainingSeconds = Math.floor((endAt.getTime() - now.getTime()) / 1000);
    }

    // Calculate progress percentage (for presale)
    let progressPercentage = 0;
    if (round.type === 'PRESALE' && round.params.hardcap) {
      progressPercentage = Math.min((round.total_raised / round.params.hardcap) * 100, 100);
    }

    // Determine time status
    let timeStatus: 'upcoming' | 'live' | 'ended' = 'ended';
    if (now < startAt) {
      timeStatus = 'upcoming';
    } else if (now >= startAt && now < endAt) {
      timeStatus = 'live';
    }

    return NextResponse.json({
      status: round.status,
      result: round.result,
      total_raised: round.total_raised,
      total_participants: round.total_participants,
      time_remaining_seconds: timeRemainingSeconds,
      progress_percentage: progressPercentage,
      time_status: timeStatus,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
