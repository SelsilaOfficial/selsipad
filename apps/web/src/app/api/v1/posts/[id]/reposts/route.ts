/**
 * GET /api/v1/posts/[id]/reposts
 * Get all reposts of a post
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const postId = params.id;

    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('posts')
      .select(
        `
        *,
        author:profiles!posts_author_id_fkey(user_id, username, avatar_url, bluecheck_status)
      `
      )
      .eq('reposted_post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: reposts, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch reposts', details: error.message },
        { status: 500 }
      );
    }

    const hasMore = reposts.length > limit;
    const repostList = hasMore ? reposts.slice(0, limit) : reposts;
    const nextCursor =
      hasMore && repostList.length > 0 ? repostList[repostList.length - 1].created_at : null;

    return NextResponse.json({
      reposts: repostList,
      cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/posts/[id]/reposts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
