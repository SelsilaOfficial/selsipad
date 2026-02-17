import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  validateLiquidityLock,
  VestingValidationError,
  type CreateLiquidityLockRequest,
} from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/rounds/[id]/lock/setup
 * Initialize liquidity lock for finalized round
 * CRITICAL: Enforces 12-month minimum at database level
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
    let lockData: CreateLiquidityLockRequest;
    try {
      lockData = validateLiquidityLock({
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
      .select('*, projects(chain, token_address)')
      .eq('id', params.id)
      .single();

    if (roundError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Validate round status
    if (round.status !== 'FINALIZED' || round.result !== 'SUCCESS') {
      return NextResponse.json(
        { error: 'Can only setup lock for finalized successful rounds' },
        { status: 400 }
      );
    }

    // Check if lock already exists
    const { data: existing } = await supabase
      .from('liquidity_locks')
      .select('id')
      .eq('round_id', params.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Liquidity lock already exists for this round' },
        { status: 400 }
      );
    }

    // Calculate unlock date (minimum 12 months from now)
    const lockedUntil = new Date();
    lockedUntil.setMonth(lockedUntil.getMonth() + lockData.lock_duration_months);

    // Create liquidity lock
    const { data: createdLock, error: createError } = await supabase
      .from('liquidity_locks')
      .insert({
        round_id: params.id,
        chain: body.chain || round.projects.chain,
        dex_type: lockData.dex_type,
        lp_token_address: lockData.lp_token_address,
        lock_amount: lockData.lock_amount,
        lock_duration_months: lockData.lock_duration_months,
        locked_until: lockedUntil.toISOString(),
        status: 'PENDING',
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating liquidity lock:', createError);

      // Check if constraint violation (12-month minimum)
      if (createError.message?.includes('lock_duration_months')) {
        return NextResponse.json(
          { error: 'Lock duration must be at least 12 months (enforced at database level)' },
          { status: 400 }
        );
      }

      return NextResponse.json({ error: 'Failed to create liquidity lock' }, { status: 500 });
    }

    // Update round lock status
    await supabase.from('launch_rounds').update({ lock_status: 'PENDING' }).eq('id', params.id);

    // TODO: Trigger Tx Manager to prepare LP tokens for locking

    return NextResponse.json({
      lock: createdLock,
      locker_contract_address: 'TBD', // Will be provided by Tx Manager
      estimated_unlock_date: lockedUntil.toISOString(),
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
