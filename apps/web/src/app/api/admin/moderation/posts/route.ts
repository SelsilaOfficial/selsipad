/**
 * GET /api/admin/moderation/posts
 * List all posts (for moderation dashboard)
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
    const filter = searchParams.get('filter') || 'all'; // all, deleted, active
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('posts')
      .select(`*, author:profiles!posts_author_id_fkey(user_id, username, bluecheck_status)`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filter === 'deleted') {
      query = query.not('deleted_at', 'is', null);
    } else if (filter === 'active') {
      query = query.is('deleted_at', null);
    }

    const { data: posts } = await query;

    return NextResponse.json({ posts: posts || [] });
  } catch (error) {
    console.error('Error in GET /api/admin/moderation/posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
