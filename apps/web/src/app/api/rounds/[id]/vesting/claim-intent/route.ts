import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  calculateClaimable,
  canClaimNow,
  validateClaimIntent,
  VestingValidationError,
  type VestingSchedule,
  type VestingAllocation,
} from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/rounds/[id]/vesting/claim-intent
 * Create claim intent - calculate claimable and return quote
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Validate request body
    const body = await request.json();
    try {
      validateClaimIntent(body);
    } catch (err) {
      if (err instanceof VestingValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
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
      .eq('id', body.allocation_id)
      .eq('user_id', user.id)
      .single();

    if (allocError || !allocation) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    // Check if can claim
    const eligibility = canClaimNow(schedule as VestingSchedule, allocation as VestingAllocation);

    if (!eligibility.can_claim) {
      return NextResponse.json(
        {
          can_claim: false,
          reason: eligibility.reason,
        },
        { status: 400 }
      );
    }

    // Calculate claimable amount
    const claimable = calculateClaimable(
      schedule as VestingSchedule,
      allocation as VestingAllocation
    );

    // Generate intent ID
    const intentId = `intent_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Intent expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    return NextResponse.json({
      intent_id: intentId,
      allocation,
      claimable,
      expires_at: expiresAt,
      can_claim: true,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
