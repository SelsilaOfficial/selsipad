import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/rounds/[id]/lock/unlock
 * Unlock liquidity after lock period expires
 * REQUIRES TWO-MAN RULE + TIME CHECK
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
    // TODO: Check two-man rule approval

    // Get lock
    const { data: lock, error: lockError } = await supabase
      .from('liquidity_locks')
      .select('*')
      .eq('round_id', params.id)
      .single();

    if (lockError || !lock) {
      return NextResponse.json({ error: 'Liquidity lock not found' }, { status: 404 });
    }

    // Validate lock status
    if (lock.status !== 'LOCKED') {
      return NextResponse.json(
        { error: 'Lock must be in LOCKED status to unlock' },
        { status: 400 }
      );
    }

    // Check if lock period has expired
    const now = new Date();
    const lockedUntil = new Date(lock.locked_until);

    if (now < lockedUntil) {
      const daysRemaining = Math.ceil(
        (lockedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return NextResponse.json(
        {
          error: `Lock period has not expired yet. ${daysRemaining} days remaining.`,
          locked_until: lock.locked_until,
          days_remaining: daysRemaining,
        },
        { status: 400 }
      );
    }

    // Request body for unlock reason
    const body = await request.json();
    if (!body.reason) {
      return NextResponse.json(
        { error: 'Unlock reason is required', field: 'reason' },
        { status: 400 }
      );
    }

    // Update lock status to UNLOCKED
    const { data: updatedLock, error: updateError } = await supabase
      .from('liquidity_locks')
      .update({
        status: 'UNLOCKED',
        updated_at: now.toISOString(),
      })
      .eq('id', lock.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error unlocking:', updateError);
      return NextResponse.json({ error: 'Failed to unlock' }, { status: 500 });
    }

    // TODO: Write audit log
    // await writeAuditLog({
    //   action: 'UNLOCK_LIQUIDITY',
    //   resource_type: 'liquidity_lock',
    //   resource_id: lock.id,
    //   user_id: user.id,
    //   details: { reason: body.reason }
    // });

    return NextResponse.json({
      lock: updatedLock,
      unlocked_at: now.toISOString(),
      message: 'Liquidity unlocked successfully',
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
