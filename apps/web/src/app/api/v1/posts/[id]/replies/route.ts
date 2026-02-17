/**
 * GET /api/v1/posts/[id]/replies
 * Get all replies to a post with pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const REPLIES_PER_PAGE = 20;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const postId = params.id;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || String(REPLIES_PER_PAGE));

    // Build query
    let query = supabase
      .from('posts')
      .select(
        `
        *,
        author:profiles!posts_author_id_fkey(user_id, username, avatar_url, bluecheck_status)
      `
      )
      .eq('parent_post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(limit + 1);

    if (cursor) {
      query = query.gt('created_at', cursor);
    }

    const { data: replies, error } = await query;

    if (error) {
      console.error('Error fetching replies:', error);
      return NextResponse.json(
        { error: 'Failed to fetch replies', details: error.message },
        { status: 500 }
      );
    }

    const hasMore = replies.length > limit;
    const replyList = hasMore ? replies.slice(0, limit) : replies;
    const nextCursor =
      hasMore && replyList.length > 0 ? replyList[replyList.length - 1].created_at : null;

    return NextResponse.json({
      replies: replyList,
      cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/posts/[id]/replies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
