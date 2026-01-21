import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * POST /api/staking/sbt/unstake
 *
 * Unstake SBT (instant, no cooldown)
 *
 * Body: {
 *   positionId: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { positionId } = body;

    if (!positionId) {
      return NextResponse.json({ error: 'Missing positionId' }, { status: 400 });
    }

    const supabase = createClient();

    // Get position
    const { data: position } = await supabase
      .from('staking_positions')
      .select('*')
      .eq('id', positionId)
      .eq('user_id', session.userId)
      .single();

    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    if (position.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Position already unstaked' }, { status: 400 });
    }

    // Unstake (instant, no cooldown)
    const { data: updated, error: unstakeError } = await supabase
      .from('staking_positions')
      .update({
        status: 'UNSTAKED',
        unstaked_at: new Date().toISOString(),
      })
      .eq('id', positionId)
      .select()
      .single();

    if (unstakeError) {
      console.error('Error unstaking:', unstakeError);
      return NextResponse.json({ error: 'Failed to unstake' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        positionId: updated.id,
        unstakedAt: updated.unstaked_at,
        status: updated.status,
      },
    });
  } catch (error: any) {
    console.error('Error unstaking SBT:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
