import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  calculateClaimable,
  getVestingTimeline,
  type VestingSchedule,
  type VestingAllocation,
} from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds/[id]/vesting/allocations/me
 * Get user's vesting allocation and claimable amount
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vesting schedule
    const { data: schedule, error: schedError } = await supabase
      .from('vesting_schedules')
      .select('*')
      .eq('round_id', params.id)
      .single();

    if (schedError || !schedule) {
      return NextResponse.json({ error: 'Vesting schedule not found' }, { status: 404 });
    }

    // Get user's allocation
    const { data: allocation, error: allocError } = await supabase
      .from('vesting_allocations')
      .select('*')
      .eq('round_id', params.id)
      .eq('user_id', user.id)
      .single();

    if (allocError || !allocation) {
      return NextResponse.json({ error: 'No allocation found for this user' }, { status: 404 });
    }

    // Calculate claimable amount (SERVER-SIDE SOURCE OF TRUTH)
    const claimable = calculateClaimable(
      schedule as VestingSchedule,
      allocation as VestingAllocation
    );

    // Get vesting timeline
    const timeline = getVestingTimeline(schedule as VestingSchedule);

    return NextResponse.json({
      allocation,
      claimable,
      timeline,
      schedule: {
        tge_percentage: schedule.tge_percentage,
        cliff_months: schedule.cliff_months,
        vesting_months: schedule.vesting_months,
        interval_type: schedule.interval_type,
        status: schedule.status,
      },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
