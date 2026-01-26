import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/admin/rbac';
import { logAdminAction, getClientIP, getUserAgent } from '@/lib/admin/audit-logging';

/**
 * POST /api/admin/two-man-rule/[action_id]/approve
 * Approve a pending two-man rule action
 * Constraint: approver cannot be the requester
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
    const approverId = session.userId;

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

    // CRITICAL: Approver cannot be requester (Two-Man Rule constraint)
    if (action.requested_by === approverId) {
      return NextResponse.json(
        { error: 'You cannot approve your own request' },
        { status: 403 }
      );
    }

    // Check if already approved by this admin
    const { data: existingApproval } = await supabase
      .from('admin_action_approvals')
      .select('*')
      .eq('action_id', actionId)
      .eq('approved_by', approverId)
      .single();

    if (existingApproval) {
      return NextResponse.json(
        { error: 'You have already approved this action' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    // Insert approval record
    const { error: approvalError } = await supabase
      .from('admin_action_approvals')
      .insert({
        action_id: actionId,
        approved_by: approverId,
        decision: 'APPROVE',
        reason,
      });

    if (approvalError) {
      console.error('[Two-Man Rule] Failed to insert approval:', approvalError);
      return NextResponse.json(
        { error: 'Failed to record approval' },
        { status: 500 }
      );
    }

    // Update action status to APPROVED
    const { error: updateError } = await supabase
      .from('admin_actions')
      .update({ status: 'APPROVED' })
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
      actor_admin_id: approverId,
      action: 'TWO_MAN_RULE_APPROVED',
      entity_type: 'admin_action',
      entity_id: actionId,
      before_data: { status: 'PENDING' },
      after_data: {
        status: 'APPROVED',
        approved_by: approverId,
        reason,
        action_type: action.type,
        requested_by: action.requested_by,
      },
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      message: 'Action approved successfully',
      action_id: actionId,
    });
  } catch (error) {
    console.error('[Two-Man Rule] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
