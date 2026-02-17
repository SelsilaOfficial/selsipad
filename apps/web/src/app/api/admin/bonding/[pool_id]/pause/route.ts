/**
 * POST /api/admin/bonding/[pool_id]/pause
 * Admin: Pause a bonding pool (emergency)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { pool_id: string } }) {
  try {
    const poolId = params.pool_id;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify pool exists
    const { data: pool, error: poolError } = await supabase
      .from('bonding_pools')
      .select('status')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    if (pool.status === 'PAUSED') {
      return NextResponse.json({ error: 'Pool is already paused' }, { status: 400 });
    }

    // Verify pool is currently pause-able (LIVE or GRADUATING)
    if (!['LIVE', 'GRADUATING'].includes(pool.status)) {
      return NextResponse.json(
        { error: `Cannot pause pool in ${pool.status} status` },
        { status: 400 }
      );
    }

    // Update status to PAUSED
    const { error: updateError } = await supabase
      .from('bonding_pools')
      .update({
        status: 'PAUSED',
        // Track who paused it in events, but specific column not needed if we rely on events
      })
      .eq('id', poolId);

    if (updateError) throw updateError;

    // Log event
    await supabase.from('bonding_events').insert({
      pool_id: poolId,
      event_type: 'POOL_PAUSED',
      event_data: { paused_by: user.id },
      triggered_by: user.id,
    });

    return NextResponse.json({ success: true, status: 'PAUSED' });
  } catch (error) {
    console.error('Error in POST /api/admin/bonding/pause:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
