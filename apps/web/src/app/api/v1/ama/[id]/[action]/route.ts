/**
 * AMA Payment & Admin Flow
 * POST /api/v1/ama/[id]/pay - Submit payment
 * POST /api/admin/ama/[id]/approve - Approve AMA
 * POST /api/admin/ama/[id]/start - Start AMA
 * POST /api/admin/ama/[id]/end - End AMA
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const amaId = params.id;
    const action = params.action;

    const { data: session } = await supabase
      .from('ama_sessions')
      .select('*')
      .eq('id', amaId)
      .single();
    if (!session) return NextResponse.json({ error: 'AMA not found' }, { status: 404 });

    if (action === 'pay') {
      // User submits payment
      if (session.host_id !== user.id) {
        return NextResponse.json({ error: 'Only host can submit payment' }, { status: 403 });
      }

      const body = await request.json();
      const { tx_hash } = body;

      if (!tx_hash) {
        return NextResponse.json({ error: 'tx_hash required' }, { status: 400 });
      }

      await supabase
        .from('ama_sessions')
        .update({
          status: 'PAID',
          payment_tx_hash: tx_hash,
        })
        .eq('id', amaId);

      return NextResponse.json({ success: true, message: 'Payment submitted' });
    }

    // Admin actions below
    // TODO: Check admin role

    if (action === 'approve') {
      if (session.status !== 'PAID') {
        return NextResponse.json({ error: 'AMA must be PAID before approval' }, { status: 400 });
      }

      await supabase.from('ama_sessions').update({ status: 'APPROVED' }).eq('id', amaId);
      // TODO: Audit log
      return NextResponse.json({ success: true, message: 'AMA approved' });
    }

    if (action === 'start') {
      if (session.status !== 'APPROVED') {
        return NextResponse.json(
          { error: 'AMA must be APPROVED before starting' },
          { status: 400 }
        );
      }

      await supabase.from('ama_sessions').update({ status: 'LIVE' }).eq('id', amaId);
      return NextResponse.json({ success: true, message: 'AMA started' });
    }

    if (action === 'end') {
      if (session.status !== 'LIVE') {
        return NextResponse.json({ error: 'AMA must be LIVE to end' }, { status: 400 });
      }

      await supabase.from('ama_sessions').update({ status: 'ENDED' }).eq('id', amaId);
      return NextResponse.json({ success: true, message: 'AMA ended' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in AMA action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
