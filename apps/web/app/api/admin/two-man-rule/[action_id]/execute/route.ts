import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, isSuperAdmin } from '@/lib/admin/rbac';
import { executeApprovedAction } from '@/lib/admin/action-executor';
import { logAdminAction, getClientIP, getUserAgent } from '@/lib/admin/audit-logging';

/**
 * POST /api/admin/two-man-rule/[action_id]/execute
 * Execute an approved action
 * Requires: Super admin
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
    const executorId = session.userId;

    // Check if user is super admin
    const isSuperAdm = await isSuperAdmin(executorId);
    if (!isSuperAdm) {
      return NextResponse.json(
        { error: 'Forbidden: Super admin access required to execute actions' },
        { status: 403 }
      );
    }

    const actionId = params.action_id;

    // Execute the action
    const result = await executeApprovedAction(actionId, executorId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to execute action' },
        { status: 500 }
      );
    }

    // Audit log
    await logAdminAction({
      actor_admin_id: executorId,
      action: 'TWO_MAN_RULE_EXECUTED',
      entity_type: 'admin_action',
      entity_id: actionId,
      after_data: { executed_by: executorId },
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      message: 'Action executed successfully',
    });
  } catch (error) {
    console.error('[Two-Man Rule] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
