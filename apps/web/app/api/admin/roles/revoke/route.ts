import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, isSuperAdmin } from '@/lib/admin/rbac';

/**
 * POST /api/admin/roles/revoke
 * Revoke admin role from user
 * IMPORTANT: This creates a two-man rule request, does NOT revoke directly
 * Requires: Super admin
 */
export async function POST(request: NextRequest) {
  try {
    // Get admin session
    const sessionCookie = request.cookies.get('admin_session');
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const requesterId = session.userId;

    // Check if user is super admin
    const isSuperAdm = await isSuperAdmin(requesterId);
    if (!isSuperAdm) {
      return NextResponse.json(
        { error: 'Forbidden: Super admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { target_user_id, role } = body;

    // Validate input
    if (!target_user_id || !role) {
      return NextResponse.json(
        { error: 'target_user_id and role required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Check if user has this role
    const { data: existingRole } = await supabase
      .from('admin_roles')
      .select('*')
      .eq('user_id', target_user_id)
      .eq('role', role)
      .single();

    if (!existingRole) {
      return NextResponse.json(
        { error: 'User does not have this role' },
        { status: 400 }
      );
    }

    // Prevent self-revocation of super_admin
    if (target_user_id === requesterId && role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot revoke your own super_admin role' },
        { status: 403 }
      );
    }

    // Create two-man rule request for role revoke
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { data: action, error: actionError } = await supabase
      .from('admin_actions')
      .insert({
        type: 'ROLE_REVOKE',
        payload: {
          target_user_id,
          role,
          requester_id: requesterId,
        },
        status: 'PENDING',
        requested_by: requesterId,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (actionError) {
      console.error('[Admin Roles] Failed to create role revoke request:', actionError);
      return NextResponse.json(
        { error: 'Failed to create role revoke request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        'Role revoke request created. Requires approval from another super admin.',
      action_id: action.id,
      requires_approval: true,
    });
  } catch (error) {
    console.error('[Admin Roles] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
