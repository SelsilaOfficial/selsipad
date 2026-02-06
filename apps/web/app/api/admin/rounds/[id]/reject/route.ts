import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRejectPool, PoolValidationError } from '@selsipad/shared';
import { requireAdmin } from '@/lib/auth/require-admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/rounds/[id]/reject
 * Reject a launch round with reason (admin only)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;
    const { userId } = adminResult;

    // Get round
    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Validate status
    if (round.status !== 'SUBMITTED_FOR_REVIEW') {
      return NextResponse.json(
        { error: 'Can only reject SUBMITTED_FOR_REVIEW rounds' },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();

    // Require rejection reason (min 10 chars)
    if (!body.rejection_reason || typeof body.rejection_reason !== 'string') {
      return NextResponse.json({ error: 'rejection_reason is required' }, { status: 400 });
    }

    const reason = body.rejection_reason.trim();
    if (reason.length < 10) {
      return NextResponse.json(
        { error: 'Rejection reason must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (reason.length > 500) {
      return NextResponse.json(
        { error: 'Rejection reason must not exceed 500 characters' },
        { status: 400 }
      );
    }

    // Validate using shared validator if needed
    let rejectData;
    try {
      rejectData = validateRejectPool(body);
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
    }

    // Update to REJECTED with review tracking
    const { data: updated, error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'REJECTED',
        rejection_reason: reason,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting round:', updateError);
      return NextResponse.json({ error: 'Failed to reject round' }, { status: 500 });
    }

    // TODO: Create audit log

    return NextResponse.json({ round: updated });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
