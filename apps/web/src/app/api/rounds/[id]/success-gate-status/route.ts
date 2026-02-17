import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSuccessGating } from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds/[id]/success-gate-status
 * Check all three success gates (public)
 * CRITICAL: All gates must pass for project to be SUCCESS
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get round
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', params.id)
      .single();

    if (roundError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Get vesting schedule
    const { data: vestingSchedule } = await supabase
      .from('vesting_schedules')
      .select('*')
      .eq('round_id', params.id)
      .maybeSingle();

    // Get liquidity lock
    const { data: liquidityLock } = await supabase
      .from('liquidity_locks')
      .select('*')
      .eq('round_id', params.id)
      .maybeSingle();

    // Validate all gates
    const gateValidation = validateSuccessGating(
      round.result || 'NONE',
      round.vesting_status || 'NONE',
      round.lock_status || 'NONE'
    );

    // Build response
    const gates = {
      round_success: round.result === 'SUCCESS',
      vesting_confirmed: round.vesting_status === 'CONFIRMED',
      lock_confirmed: round.lock_status === 'LOCKED',
      all_gates_passed: gateValidation.passed,
      success_gated_at: round.success_gated_at,
    };

    return NextResponse.json({
      gates,
      vesting_schedule: vestingSchedule || null,
      liquidity_lock: liquidityLock || null,
      missing_requirements: gateValidation.missing,
      can_mark_success: gateValidation.passed && !round.success_gated_at,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
