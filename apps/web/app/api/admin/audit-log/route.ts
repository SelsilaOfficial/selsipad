import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, hasPermission } from '@/lib/admin/rbac';

/**
 * GET /api/admin/audit-log
 * Get audit logs with filtering
 * Requires: audit:view permission
 */
export async function GET(request: NextRequest) {
  try {
    // Get admin session
    const sessionCookie = request.cookies.get('admin_session');
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const userId = session.userId;

    // Check audit:view permission
    const canViewAudit = await hasPermission(userId, 'audit:view');
    if (!canViewAudit) {
      return NextResponse.json(
        { error: 'Forbidden: audit:view permission required' },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const entityType = searchParams.get('entity_type');
    const actorId = searchParams.get('actor_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('admin_audit_logs')
      .select(`
        *,
        actor:profiles!admin_audit_logs_actor_admin_id_fkey(
          user_id,
          nickname,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (action) {
      query = query.eq('action', action);
    }
    if (entityType) {
      query = query.eq('entity_type', entityType);
    }
    if (actorId) {
      query = query.eq('actor_admin_id', actorId);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('[Audit Log] Failed to fetch logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      logs,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Audit Log] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
