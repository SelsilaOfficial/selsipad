import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, isSuperAdmin } from '@/lib/admin/rbac';

/**
 * GET /api/admin/roles/users
 * List all users with admin roles
 * Requires: Super admin or role:view permission
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

    // Check if user is super admin (required for role management)
    const isSuperAdm = await isSuperAdmin(userId);
    if (!isSuperAdm) {
      return NextResponse.json(
        { error: 'Forbidden: Super admin access required' },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();

    // Get all users with admin roles
    const { data: adminRoles, error } = await supabase
      .from('admin_roles')
      .select(`
        id,
        user_id,
        role,
        granted_at,
        granted_by,
        profile:profiles!admin_roles_user_id_fkey(
          user_id,
          nickname,
          avatar_url,
          created_at
        )
      `)
      .order('granted_at', { ascending: false });

    if (error) {
      console.error('[Admin Roles] Failed to fetch admin users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch admin users' },
        { status: 500 }
      );
    }

    // Group roles by user
    const userRolesMap = new Map();
    adminRoles.forEach((roleRecord) => {
      const userId = roleRecord.user_id;
      if (!userRolesMap.has(userId)) {
        userRolesMap.set(userId, {
          user_id: userId,
          profile: roleRecord.profile,
          roles: [],
        });
      }
      userRolesMap.get(userId).roles.push({
        role: roleRecord.role,
        granted_at: roleRecord.granted_at,
        granted_by: roleRecord.granted_by,
      });
    });

    const adminUsers = Array.from(userRolesMap.values());

    return NextResponse.json({
      admin_users: adminUsers,
      total: adminUsers.length,
    });
  } catch (error) {
    console.error('[Admin Roles] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
