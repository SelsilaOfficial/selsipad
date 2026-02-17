/**
 * Admin API: Blue Check Audit Log Viewer
 *
 * View audit trail for all Blue Check actions
 * Supports filtering and pagination
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const action_type = searchParams.get('action_type');
    const target_user_id = searchParams.get('target_user_id');
    const admin_user_id = searchParams.get('admin_user_id');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('bluecheck_audit_log')
      .select(
        `
        *,
        target_user:profiles!bluecheck_audit_log_target_user_id_fkey(user_id, username, avatar_url),
        admin_user:profiles!bluecheck_audit_log_admin_user_id_fkey(user_id, username, avatar_url)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (action_type) {
      query = query.eq('action_type', action_type);
    }
    if (target_user_id) {
      query = query.eq('target_user_id', target_user_id);
    }
    if (admin_user_id) {
      query = query.eq('admin_user_id', admin_user_id);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    return NextResponse.json({
      logs: logs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in audit log endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
