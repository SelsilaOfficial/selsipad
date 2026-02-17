/**
 * GET /api/v1/bonding/:pool_id/graduation-gates
 * Check all graduation requirements for pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkGraduationThreshold, validateLPLockDuration } from '@selsipad/shared';
import type { GraduationGatesResponse } from '@selsipad/shared';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { pool_id: string } }
): Promise<NextResponse<GraduationGatesResponse | { error: string }>> {
  try {
    const { pool_id } = params;

    const supabase = createClient();

    // Get pool
    const { data: pool, error: poolError } = await supabase
      .from('bonding_pools')
      .select('*')
      .eq('id', pool_id)
      .single();

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Check SOL threshold
    const thresholdCheck = checkGraduationThreshold(
      pool.actual_sol_reserves,
      pool.graduation_threshold_sol
    );

    // Initialize gates
    const gates = {
      sol_threshold_met: thresholdCheck.threshold_met,
      lp_lock_created: false,
      lp_lock_duration_met: false,
      lp_lock_active: false,
      team_vesting_active: false,
    };

    // Check LP Lock (FASE 5 integration)
    if (pool.lp_lock_id) {
      const { data: lpLock } = await supabase
        .from('liquidity_locks')
        .select('*')
        .eq('id', pool.lp_lock_id)
        .single();

      if (lpLock) {
        gates.lp_lock_created = true;
        gates.lp_lock_active = lpLock.status === 'ACTIVE';

        // Calculate lock duration in months
        const lockStart = new Date(lpLock.lock_start);
        const lockEnd = new Date(lpLock.lock_end);
        const durationMonths = Math.floor(
          (lockEnd.getTime() - lockStart.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        const durationCheck = validateLPLockDuration(durationMonths, 12);
        gates.lp_lock_duration_met = durationCheck.valid;
      }
    }

    // Check Team Vesting (FASE 6 integration)
    const { data: vestingSchedules } = await supabase
      .from('vesting_schedules')
      .select('*')
      .eq('project_id', pool.project_id)
      .eq('allocation_type', 'TEAM')
      .eq('status', 'ACTIVE');

    gates.team_vesting_active = (vestingSchedules?.length || 0) > 0;

    // Determine if can graduate
    const canGraduate =
      gates.sol_threshold_met &&
      gates.lp_lock_created &&
      gates.lp_lock_duration_met &&
      gates.lp_lock_active &&
      gates.team_vesting_active;

    const response: GraduationGatesResponse = {
      pool_id: pool.id,
      pool_status: pool.status,
      gates,
      can_graduate: canGraduate,
      graduation_progress_percent: thresholdCheck.progress_percent,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Graduation gates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
