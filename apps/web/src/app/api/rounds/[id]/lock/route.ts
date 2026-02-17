import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds/[id]/lock
 * Get liquidity lock details (public)
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get liquidity lock
    const { data: lock, error } = await supabase
      .from('liquidity_locks')
      .select('*')
      .eq('round_id', params.id)
      .single();

    if (error || !lock) {
      return NextResponse.json({ error: 'Liquidity lock not found' }, { status: 404 });
    }

    // Calculate remaining lock time
    let daysRemaining = null;
    let unlockProgress = 0;

    if (lock.locked_at && lock.locked_until) {
      const now = new Date();
      const lockedAt = new Date(lock.locked_at);
      const lockedUntil = new Date(lock.locked_until);

      const totalDuration = lockedUntil.getTime() - lockedAt.getTime();
      const elapsed = now.getTime() - lockedAt.getTime();
      const remaining = lockedUntil.getTime() - now.getTime();

      daysRemaining = Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
      unlockProgress = Math.min(100, Math.floor((elapsed / totalDuration) * 100));
    }

    // Get round context
    const { data: round } = await supabase
      .from('launch_rounds')
      .select('status, result, finalized_at')
      .eq('id', params.id)
      .single();

    return NextResponse.json({
      lock,
      days_remaining: daysRemaining,
      unlock_progress: unlockProgress,
      is_locked: lock.status === 'LOCKED',
      is_unlocked: lock.status === 'UNLOCKED',
      round: round || null,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
