import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/admin/rbac';
import { logAdminAction, getClientIP, getUserAgent } from '@/lib/admin/audit-logging';

/**
 * POST /api/admin/two-man-rule/[action_id]/reject
 * Reject a pending two-man rule action
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { action_id: string } }
) {
  try {
    // Get admin session
    const sessionCookie = request.cookies.get('admin_session');
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const rejecterId = session.userId;

    const supabase = getServiceClient();
    const actionId = params.action_id;

    // Get the action
    const { data: action, error: fetchError } = await supabase
      .from('admin_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (fetchError || !action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Check status
    if (action.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Action already ${action.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Insert rejection record
    const { error: rejectionError } = await supabase
      .from('admin_action_approvals')
      .insert({
        action_id: actionId,
        approved_by: rejecterId,
        decision: 'REJECT',
        reason,
      });

    if (rejectionError) {
      console.error('[Two-Man Rule] Failed to insert rejection:', rejectionError);
      return NextResponse.json(
        { error: 'Failed to record rejection' },
        { status: 500 }
      );
    }

    // Update action status to REJECTED
    const { error: updateError } = await supabase
      .from('admin_actions')
      .update({ status: 'REJECTED' })
      .eq('id', actionId);

    if (updateError) {
      console.error('[Two-Man Rule] Failed to update action status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update action status' },
        { status: 500 }
      );
    }

    // Audit log
    await logAdminAction({
      actor_admin_id: rejecterId,
      action: 'TWO_MAN_RULE_REJECTED',
      entity_type: 'admin_action',
      entity_id: actionId,
      before_data: { status: 'PENDING' },
      after_data: {
        status: 'REJECTED',
        rejected_by: rejecterId,
        reason,
        action_type: action.type,
        requested_by: action.requested_by,
      },
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      message: 'Action rejected',
      action_id: actionId,
    });
  } catch (error) {
    console.error('[Two-Man Rule] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
