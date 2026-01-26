import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/admin/rbac';
import { logAdminAction, getClientIP, getUserAgent } from '@/lib/admin/audit-logging';

/**
 * POST /api/admin/two-man-rule/request
 * Create a new two-man rule action request
 * Requires: Admin session
 */
export async function POST(request: NextRequest) {
  try {
    // Get admin session from cookie
    const sessionCookie = request.cookies.get('admin_session');
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const requesterId = session.userId;

    const body = await request.json();
    const { type, payload, expiresInHours = 24 } = body;

    // Validate input
    if (!type || !payload) {
      return NextResponse.json(
        { error: 'type and payload required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Insert action request
    const { data: action, error } = await supabase
      .from('admin_actions')
      .insert({
        type,
        payload,
        status: 'PENDING',
        requested_by: requesterId,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Two-Man Rule] Failed to create action:', error);
      return NextResponse.json(
        { error: 'Failed to create action request' },
        { status: 500 }
      );
    }

    // Audit log
    await logAdminAction({
      actor_admin_id: requesterId,
      action: 'TWO_MAN_RULE_REQUEST_CREATED',
      entity_type: 'admin_action',
      entity_id: action.id,
      after_data: { type, payload, expires_at: expiresAt },
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      action,
      message: 'Action request created. Awaiting approval from another admin.',
    });
  } catch (error) {
    console.error('[Two-Man Rule] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
