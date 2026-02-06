import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validatePoolStatus, PoolValidationError } from '@selsipad/shared';
import { getAuthUserId } from '@/lib/auth/require-admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/rounds/[id]/submit
 * Submit round for admin review with compliance validation
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    let userId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) userId = user.id;
    }
    if (!userId) userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get round with project details
    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select(
        `
        *,
        projects (
          id,
          name,
          owner_user_id,
          kyc_status,
          sc_scan_status
        )
      `
      )
      .eq('id', params.id)
      .single();

    if (fetchError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Check ownership
    if (round.projects.owner_user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate status (must be DRAFT or REJECTED)
    try {
      validatePoolStatus(round.status, ['DRAFT', 'REJECTED'], 'submit');
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    // Compliance gate validation
    const violations: string[] = [];

    // 1. Developer KYC must be CONFIRMED
    if (round.projects.kyc_status !== 'CONFIRMED') {
      violations.push(
        `Developer KYC must be CONFIRMED (current: ${round.projects.kyc_status || 'NOT_STARTED'})`
      );
    }

    // 2. SC Scan must be PASS or OVERRIDE_PASS
    const validScanStatuses = ['PASS', 'OVERRIDE_PASS'];
    if (!validScanStatuses.includes(round.projects.sc_scan_status || '')) {
      violations.push(
        `Smart Contract Scan must be PASS or OVERRIDE_PASS (current: ${round.projects.sc_scan_status || 'NOT_STARTED'})`
      );
    }

    // 3. Validate params based on pool type
    const params = round.params as any;

    // Check investor vesting (for now, we check if vesting fields exist in params)
    // In production, this should check against vesting_schedules table
    if (!params.investor_vesting) {
      violations.push('Investor vesting configuration is required');
    }

    // Check team vesting
    if (!params.team_vesting) {
      violations.push('Team vesting configuration is required');
    }

    // 4. LP lock plan must be >= 12 months
    if (!params.lp_lock_plan || !params.lp_lock_plan.duration_months) {
      violations.push('LP lock plan is required');
    } else if (params.lp_lock_plan.duration_months < 12) {
      violations.push(
        `LP lock duration must be at least 12 months (current: ${params.lp_lock_plan.duration_months})`
      );
    }

    // If there are violations, return error
    if (violations.length > 0) {
      return NextResponse.json(
        {
          error: 'Compliance requirements not met',
          violations,
        },
        { status: 400 }
      );
    }

    // Update round status to SUBMITTED_FOR_REVIEW
    const { data: updatedRound, error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'SUBMITTED_FOR_REVIEW',
        // Update compliance snapshots
        kyc_status_at_submit: round.projects.kyc_status,
        scan_status_at_submit: round.projects.sc_scan_status,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error submitting round:', updateError);
      return NextResponse.json({ error: 'Failed to submit round' }, { status: 500 });
    }

    // Create audit log entry
    await supabase.from('audit_logs').insert({
      action: 'ROUND_SUBMITTED',
      entity_type: 'launch_round',
      entity_id: params.id,
      user_id: userId,
      metadata: {
        round_type: round.type,
        project_id: round.project_id,
        kyc_status: round.projects.kyc_status,
        sc_scan_status: round.projects.sc_scan_status,
      },
    });

    return NextResponse.json({ round: updatedRound });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
