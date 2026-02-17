/**
 * GET /api/admin/moderation/audit-log
 * View audit trail (placeholder)
 *
 * GET /api/admin/moderation/stats
 * Moderation statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TODO: Check admin role

    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type'); // 'audit-log' or 'stats'

    if (type === 'audit-log') {
      // TODO: Implement audit log retrieval from FASE 2
      return NextResponse.json({
        logs: [],
        message: 'Audit logging will be implemented in FASE 2',
      });
    }

    // Stats
    const [deletedPosts, bannedUsers, revokedBlueChecks, totalPosts] = await Promise.all([
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null),
      supabase
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('status', 'BANNED'),
      supabase
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('bluecheck_status', 'REVOKED'),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      total_posts: totalPosts.count || 0,
      deleted_posts: deletedPosts.count || 0,
      banned_users: bannedUsers.count || 0,
      revoked_bluechecks: revokedBlueChecks.count || 0,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/moderation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
