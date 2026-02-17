import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/rounds/[id]/lock/confirm
 * Confirm liquidity lock with transaction hash
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
    if (!body.lock_tx_hash) {
      return NextResponse.json(
        { error: 'Transaction hash is required', field: 'lock_tx_hash' },
        { status: 400 }
      );
    }

    // Get lock
    const { data: lock, error: lockError } = await supabase
      .from('liquidity_locks')
      .select('*')
      .eq('round_id', params.id)
      .single();

    if (lockError || !lock) {
      return NextResponse.json({ error: 'Liquidity lock not found' }, { status: 404 });
    }

    // Check if already confirmed
    if (lock.status === 'LOCKED') {
      return NextResponse.json({ error: 'Lock already confirmed' }, { status: 400 });
    }

    // Check for duplicate tx_hash
    const { data: existingLock } = await supabase
      .from('liquidity_locks')
      .select('id')
      .eq('lock_tx_hash', body.lock_tx_hash)
      .maybeSingle();

    if (existingLock && existingLock.id !== lock.id) {
      return NextResponse.json({ error: 'Transaction hash already used' }, { status: 400 });
    }

    // Update lock with transaction details
    const { data: updatedLock, error: updateError } = await supabase
      .from('liquidity_locks')
      .update({
        lock_tx_hash: body.lock_tx_hash,
        lock_id: body.lock_id || null,
        locker_contract_address: body.locker_contract_address || null,
        // Status remains PENDING until indexer confirms on-chain
      })
      .eq('id', lock.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lock:', updateError);
      return NextResponse.json({ error: 'Failed to update lock' }, { status: 500 });
    }

    // TODO: Trigger indexer to verify lock on-chain
    // Worker will update status to LOCKED once confirmed

    return NextResponse.json({
      lock: updatedLock,
      message: 'Lock transaction submitted for verification',
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
