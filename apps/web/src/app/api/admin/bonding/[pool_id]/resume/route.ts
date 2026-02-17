/**
 * POST /api/admin/bonding/[pool_id]/resume
 * Admin: Resume a paused bonding pool
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

    // Verify status is PAUSED
    if (pool.status !== 'PAUSED') {
      return NextResponse.json({ error: 'Pool is not paused' }, { status: 400 });
    }

    // Resume to LIVE (default) or check previous status if tracked.
    // For simplicity, we assume resumed pools go to LIVE.
    // Ideally we should check if it was GRADUATING, but usually pause happens during LIVE.
    const newStatus = 'LIVE';

    const { error: updateError } = await supabase
      .from('bonding_pools')
      .update({ status: newStatus })
      .eq('id', poolId);

    if (updateError) throw updateError;

    // Log event
    await supabase.from('bonding_events').insert({
      pool_id: poolId,
      event_type: 'POOL_RESUMED',
      event_data: { resumed_by: user.id, new_status: newStatus },
      triggered_by: user.id,
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Error in POST /api/admin/bonding/resume:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
