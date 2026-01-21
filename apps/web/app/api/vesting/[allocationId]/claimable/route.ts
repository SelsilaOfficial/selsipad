import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { calculateClaimableAmount } from '@/lib/vesting/claim-utils';
import type { VestingAllocation, VestingSchedule } from '@/lib/vesting/claim-utils';

/**
 * GET /api/vesting/[allocationId]/claimable
 *
 * Get claimable amount and next unlock info for a vesting allocation
 */
export async function GET(request: NextRequest, { params }: { params: { allocationId: string } }) {
  try {
    const { allocationId } = params;

    // Validate session
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();

    // Fetch allocation
    const { data: allocation, error: allocationError } = await supabase
      .from('vesting_allocations')
      .select('*')
      .eq('id', allocationId)
      .single();

    if (allocationError || !allocation) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    // Verify ownership
    if (allocation.user_id !== session.userId) {
      return NextResponse.json({ error: 'Forbidden - not your allocation' }, { status: 403 });
    }

    // Fetch vesting schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('vesting_schedules')
      .select('*')
      .eq('id', allocation.schedule_id)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Vesting schedule not found' }, { status: 404 });
    }

    // Calculate claimable amount
    const result = calculateClaimableAmount(
      allocation as VestingAllocation,
      schedule as VestingSchedule
    );

    return NextResponse.json({
      success: true,
      data: {
        allocationId,
        claimable: result.claimableFormatted,
        claimableBigInt: result.claimable.toString(),
        nextUnlock: result.nextUnlock
          ? {
              amount: result.nextUnlock.amountFormatted,
              unlockAt: result.nextUnlock.unlockAt?.toISOString(),
              daysUntil: result.nextUnlock.daysUntil,
            }
          : null,
        vestingProgress: {
          total: result.vestingProgress.total.toString(),
          claimed: result.vestingProgress.claimed.toString(),
          unlocked: result.vestingProgress.unlocked.toString(),
          locked: result.vestingProgress.locked.toString(),
          percentUnlocked: result.vestingProgress.percentUnlocked,
        },
        schedule: {
          tgePercentage: schedule.tge_percentage,
          tgeAt: schedule.tge_at,
          cliffMonths: schedule.cliff_months,
          vestingMonths: schedule.vesting_months,
          intervalType: schedule.interval_type,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching aimable amount:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
