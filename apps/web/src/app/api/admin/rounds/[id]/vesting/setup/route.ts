import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  validateVestingSchedule,
  VestingValidationError,
  generateVestingSchedule,
  type CreateVestingScheduleRequest,
} from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/rounds/[id]/vesting/setup
 * Create vesting schedule for finalized round
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
    let scheduleData: CreateVestingScheduleRequest;
    try {
      scheduleData = validateVestingSchedule({
        ...body,
        round_id: params.id,
      });
    } catch (err) {
      if (err instanceof VestingValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
    }

    // Get round
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('*, projects(token_address, chain)')
      .eq('id', params.id)
      .single();

    if (roundError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Validate round status
    if (round.status !== 'FINALIZED' || round.result !== 'SUCCESS') {
      return NextResponse.json(
        { error: 'Can only setup vesting for finalized successful rounds' },
        { status: 400 }
      );
    }

    // Check if vesting already exists
    const { data: existing } = await supabase
      .from('vesting_schedules')
      .select('id')
      .eq('round_id', params.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Vesting schedule already exists for this round' },
        { status: 400 }
      );
    }

    // Generate vesting schedule
    const schedule = generateVestingSchedule(params.id, new Date(round.finalized_at), {
      tge_percentage: scheduleData.tge_percentage,
      cliff_months: scheduleData.cliff_months,
      vesting_months: scheduleData.vesting_months,
      interval_type: scheduleData.interval_type,
      token_address: round.projects.token_address,
      chain: round.projects.chain,
      total_tokens: round.total_raised.toString(), // TODO: Calculate actual token amount
      tge_at: scheduleData.tge_at ? new Date(scheduleData.tge_at) : undefined,
    });

    // Create vesting schedule
    const { data: createdSchedule, error: createError } = await supabase
      .from('vesting_schedules')
      .insert({
        ...schedule,
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating vesting schedule:', createError);
      return NextResponse.json({ error: 'Failed to create vesting schedule' }, { status: 500 });
    }

    // Create allocations for all confirmed contributors
    const { data: allocations } = await supabase
      .from('round_allocations')
      .select('user_id, allocation_tokens')
      .eq('round_id', params.id);

    if (allocations && allocations.length > 0) {
      const vestingAllocations = allocations.map((alloc) => ({
        schedule_id: createdSchedule.id,
        round_id: params.id,
        user_id: alloc.user_id,
        allocation_tokens: alloc.allocation_tokens,
      }));

      const { error: allocError } = await supabase
        .from('vesting_allocations')
        .insert(vestingAllocations);

      if (allocError) {
        console.error('Error creating vesting allocations:', allocError);
        // Continue even if allocation insert fails
      }
    }

    // Update round vesting status
    await supabase.from('launch_rounds').update({ vesting_status: 'PENDING' }).eq('id', params.id);

    // TODO: Trigger Tx Manager for contract deployment

    return NextResponse.json({
      schedule: createdSchedule,
      allocations_created: allocations?.length || 0,
      total_tokens_allocated: schedule.total_tokens,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
