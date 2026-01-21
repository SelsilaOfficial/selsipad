import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * GET /api/staking/sbt/rewards
 *
 * Get claimable rewards for user's active stake
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();

    // Get user's active position
    const { data: position } = await supabase
      .from('staking_positions')
      .select('*')
      .eq('user_id', session.userId)
      .eq('status', 'ACTIVE')
      .order('staked_at', { ascending: false })
      .limit(1)
      .single();

    if (!position) {
      return NextResponse.json({
        success: true,
        data: {
          hasActiveStake: false,
          claimableRewards: '0.00',
          poolBalance: '0.00',
          totalStakers: 0,
        },
      });
    }

    // Calculate rewards using database function
    const { data: rewardData } = await supabase.rpc('calculate_sbt_staking_rewards', {
      p_user_id: session.userId,
    });

    const claimableRewards = rewardData || 0;

    // Get pool info
    const { data: pool } = await supabase
      .from('staking_rewards_pool')
      .select('*')
      .eq('pool_name', 'SBT_STAKING')
      .single();

    // Get total stakers
    const { count: totalStakers } = await supabase
      .from('staking_positions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    // Calculate days staked
    const stakedAt = new Date(position.staked_at);
    const now = new Date();
    const daysStaked = Math.floor((now.getTime() - stakedAt.getTime()) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      success: true,
      data: {
        hasActiveStake: true,
        positionId: position.id,
        claimableRewards: claimableRewards.toFixed(2),
        claimFee: '10.00',
        netPayout: Math.max(0, claimableRewards - 10).toFixed(2),
        poolBalance: pool?.available_balance || '0.00',
        totalStakers: totalStakers || 0,
        daysStaked,
        stakedAt: position.staked_at,
      },
    });
  } catch (error: any) {
    console.error('Error getting rewards:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
