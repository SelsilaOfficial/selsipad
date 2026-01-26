import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/admin/rbac';

/**
 * GET /api/admin/two-man-rule/history
 * Get history of executed/rejected/expired actions
 * Requires: Admin session
 */
export async function GET(request: NextRequest) {
  try {
    // Get admin session
    const sessionCookie = request.cookies.get('admin_session');
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();

    // Get URL params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // APPROVED, REJECTED, EXPIRED, EXECUTED
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('admin_actions')
      .select(`
        *,
        requester:profiles!admin_actions_requested_by_fkey(user_id, nickname, avatar_url),
        approvals:admin_action_approvals(
          id,
          decision,
          reason,
          approved_at,
          approver:profiles!admin_action_approvals_approved_by_fkey(user_id, nickname, avatar_url)
        )
      `)
      .neq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status && ['APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: actions, error, count } = await query;

    if (error) {
      console.error('[Two-Man Rule] Failed to fetch history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch action history' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      actions,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Two-Man Rule] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
