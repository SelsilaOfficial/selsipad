import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateVestingStatistics, type VestingSchedule } from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/rounds/[id]/vesting/analytics
 * Get vesting analytics for admin
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get authenticated admin user
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

    // TODO: Check admin role

    // Get vesting schedule
    const { data: schedule, error: schedError } = await supabase
      .from('vesting_schedules')
      .select('*')
      .eq('round_id', params.id)
      .single();

    if (schedError || !schedule) {
      return NextResponse.json({ error: 'Vesting schedule not found' }, { status: 404 });
    }

    // Get all allocations
    const { data: allocations, error: allocError } = await supabase
      .from('vesting_allocations')
      .select('*')
      .eq('round_id', params.id);

    if (allocError) {
      console.error('Error fetching allocations:', allocError);
      return NextResponse.json({ error: 'Failed to fetch allocations' }, { status: 500 });
    }

    // Calculate statistics
    const stats = calculateVestingStatistics(allocations || [], schedule as VestingSchedule);

    // Get claim statistics
    const { data: claims } = await supabase
      .from('vesting_claims')
      .select('status, claim_amount')
      .in(
        'allocation_id',
        (allocations || []).map((a) => a.id)
      );

    const confirmClaims = (claims || []).filter((c) => c.status === 'CONFIRMED');
    const uniqueClaimants = new Set(
      (allocations || []).filter((a) => a.total_claims > 0).map((a) => a.user_id)
    );

    return NextResponse.json({
      round_id: params.id,
      total_allocated: stats.total_allocated,
      total_claimed: stats.total_claimed,
      total_pending: stats.total_claimable_now,
      percent_claimed: stats.percent_claimed,
      percent_vested: stats.percent_vested,
      unique_claimants: uniqueClaimants.size,
      total_claims: claims?.length || 0,
      confirmed_claims: confirmClaims.length,
      schedule_status: schedule.status,
      total_allocations: allocations?.length || 0,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
