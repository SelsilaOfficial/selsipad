import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateApprovePool, PoolValidationError } from '@selsipad/shared';
import { requireAdmin } from '@/lib/auth/require-admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/rounds/[id]/approve
 * Approve a launch round (admin only)
 */
export const dynamic = 'force-dynamic';

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
    if (round.status !== 'SUBMITTED') {
      return NextResponse.json({ error: 'Can only approve SUBMITTED rounds' }, { status: 400 });
    }

    // Validate request body
    const body = await request.json().catch(() => ({}));
    try {
      validateApprovePool(body);
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    // Update to APPROVED with review + approval tracking
    const { data: updated, error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'APPROVED',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        approved_by: userId, // ✅ Also set approval columns
        approved_at: new Date().toISOString(), // ✅ Approval timestamp
        rejection_reason: null, // Clear any previous rejection
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving round:', updateError);
      return NextResponse.json({ error: 'Failed to approve round' }, { status: 500 });
    }

    // TODO: Create audit log
    // await createAuditLog({
    //   action: 'APPROVE_ROUND',
    //   resource_type: 'launch_round',
    //   resource_id: params.id,
    //   user_id: user.id,
    //   details: { notes: body.notes },
    // });

    return NextResponse.json({ round: updated });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
