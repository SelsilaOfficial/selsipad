/**
 * GET /api/v1/posts/[id]/quotes
 * Get all quote posts of a post
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
      .eq('quoted_post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: quotes, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch quotes', details: error.message },
        { status: 500 }
      );
    }

    const hasMore = quotes.length > limit;
    const quoteList = hasMore ? quotes.slice(0, limit) : quotes;
    const nextCursor =
      hasMore && quoteList.length > 0 ? quoteList[quoteList.length - 1].created_at : null;

    return NextResponse.json({
      quotes: quoteList,
      cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/posts/[id]/quotes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
