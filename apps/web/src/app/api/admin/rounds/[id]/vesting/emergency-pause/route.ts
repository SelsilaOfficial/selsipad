import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateEmergencyPause, VestingValidationError } from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/rounds/[id]/vesting/emergency-pause
 * Emergency pause vesting claims
 * REQUIRES TWO-MAN RULE
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Validate request body
    const body = await request.json();
    let pauseData;
    try {
      pauseData = validateEmergencyPause({
        ...body,
        round_id: params.id,
      });
    } catch (err) {
      if (err instanceof VestingValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
    }

    // TODO: Implement two-man rule check
    // For now, proceed with pause

    // Get vesting schedule
    const { data: schedule, error: schedError } = await supabase
      .from('vesting_schedules')
      .select('*')
      .eq('round_id', params.id)
      .single();

    if (schedError || !schedule) {
      return NextResponse.json({ error: 'Vesting schedule not found' }, { status: 404 });
    }

    // Check if already paused
    if (schedule.status === 'PAUSED') {
      return NextResponse.json({ error: 'Vesting already paused' }, { status: 400 });
    }

    // Pause vesting
    const { data: updatedSchedule, error: updateError } = await supabase
      .from('vesting_schedules')
      .update({ status: 'PAUSED' })
      .eq('id', schedule.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error pausing vesting:', updateError);
      return NextResponse.json({ error: 'Failed to pause vesting' }, { status: 500 });
    }

    // Count affected allocations
    const { count } = await supabase
      .from('vesting_allocations')
      .select('*', { count: 'exact', head: true })
      .eq('round_id', params.id);

    // TODO: Write audit log
    // await writeAuditLog({
    //   action: 'EMERGENCY_PAUSE_VESTING',
    //   resource_type: 'vesting_schedule',
    //   resource_id: schedule.id,
    //   user_id: user.id,
    //   details: { reason: pauseData.reason }
    // });

    return NextResponse.json({
      schedule: updatedSchedule,
      paused_at: new Date().toISOString(),
      affected_allocations: count || 0,
      reason: pauseData.reason,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
