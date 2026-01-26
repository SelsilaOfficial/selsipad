import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/admin/rbac';

/**
 * GET /api/admin/two-man-rule/pending
 * Get all pending two-man rule actions
 * Requires: Admin session
 */
export async function GET(request: NextRequest) {
  try {
    // Get admin session from cookie
    const sessionCookie = request.cookies.get('admin_session');
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const userId = session.userId;

    const supabase = getServiceClient();

    // Get pending actions with requester profile info
    const { data: actions, error } = await supabase
      .from('admin_actions')
      .select(`
        *,
        requester:profiles!admin_actions_requested_by_fkey(user_id, nickname, avatar_url)
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Two-Man Rule] Failed to fetch pending actions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pending actions' },
        { status: 500 }
      );
    }

    // Mark which actions current user can approve (cannot approve own requests)
    const actionsWithPermissions = actions.map((action) => ({
      ...action,
      can_approve: action.requested_by !== userId,
      is_own_request: action.requested_by === userId,
    }));

    return NextResponse.json({
      actions: actionsWithPermissions,
      total: actions.length,
    });
  } catch (error) {
    console.error('[Two-Man Rule] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
