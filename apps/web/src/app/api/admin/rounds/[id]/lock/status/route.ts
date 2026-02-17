import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/rounds/[id]/lock/status
 * Get lock verification status (admin)
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

    // Get lock
    const { data: lock, error: lockError } = await supabase
      .from('liquidity_locks')
      .select('*')
      .eq('round_id', params.id)
      .single();

    if (lockError || !lock) {
      return NextResponse.json({ error: 'Liquidity lock not found' }, { status: 404 });
    }

    // TODO: Query indexer for on-chain verification status
    const indexerStatus = {
      synced: true, // Placeholder
      block_height: null,
      last_check: new Date().toISOString(),
    };

    return NextResponse.json({
      lock,
      indexer_status: indexerStatus,
      verification_pending: lock.status === 'PENDING' && lock.lock_tx_hash !== null,
      can_confirm: lock.status === 'PENDING',
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
