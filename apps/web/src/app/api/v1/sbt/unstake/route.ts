/**
 * POST /api/v1/sbt/unstake
 * Remove a stake. No cooldown required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { UnstakeSbtRequest, UnstakeSbtResponse } from '@selsipad/shared';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest
): Promise<NextResponse<UnstakeSbtResponse | { error: string }>> {
  try {
    const body: UnstakeSbtRequest = await request.json();
    const { stake_id } = body;

    if (!stake_id) {
      return NextResponse.json({ error: 'Missing stake_id' }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if stake belongs to user
    const { data: stake, error: fetchError } = await supabase
      .from('sbt_stakes')
      .select('id')
      .eq('id', stake_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !stake) {
      return NextResponse.json({ error: 'Stake not found or not owned by user' }, { status: 404 });
    }

    // Delete stake
    const { error: deleteError } = await supabase.from('sbt_stakes').delete().eq('id', stake_id);

    if (deleteError) {
      console.error('Unstake error:', deleteError);
      return NextResponse.json({ error: 'Failed to unstake' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Unstaked successfully',
    });
  } catch (error) {
    console.error('Unstake error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
