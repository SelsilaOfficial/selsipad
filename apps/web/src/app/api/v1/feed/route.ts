/**
 * GET /api/v1/feed
 * Get personalized feed with cursor-based pagination
 * Optional filter by project_id
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const POSTS_PER_PAGE = 20;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user (optional for public feed)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor'); // created_at timestamp
    const projectId = searchParams.get('project_id');
    const limit = parseInt(searchParams.get('limit') || String(POSTS_PER_PAGE));

    // Build query
    let query = supabase
      .from('posts')
      .select(
        `
        *,
        author:profiles!posts_author_id_fkey(user_id, username, avatar_url, bluecheck_status),
        project:projects(id, name, logo_url),
        parent_post:posts!posts_parent_post_id_fkey(id, content, author_id),
        quoted_post:posts!posts_quoted_post_id_fkey(id, content, author_id),
        reposted_post:posts!posts_reposted_post_id_fkey(id, content, author_id)
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Get one extra to check if there are more

    // Apply cursor pagination
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    // Apply project filter
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('Error fetching feed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feed', details: error.message },
        { status: 500 }
      );
    }

    // Check if there are more posts
    const hasMore = posts.length > limit;
    const feedPosts = hasMore ? posts.slice(0, limit) : posts;

    // Get next cursor (created_at of last post)
    const nextCursor =
      hasMore && feedPosts.length > 0 ? feedPosts[feedPosts.length - 1].created_at : null;

    // Get engagement counts for each post
    const postsWithEngagement = await Promise.all(
      feedPosts.map(async (post) => {
        const [replyCount, quoteCount, repostCount] = await Promise.all([
          supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .eq('parent_post_id', post.id)
            .is('deleted_at', null),
          supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .eq('quoted_post_id', post.id)
            .is('deleted_at', null),
          supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .eq('reposted_post_id', post.id)
            .is('deleted_at', null),
        ]);

        return {
          ...post,
          engagement: {
            reply_count: replyCount.count || 0,
            quote_count: quoteCount.count || 0,
            repost_count: repostCount.count || 0,
          },
        };
      })
    );

    return NextResponse.json({
      posts: postsWithEngagement,
      cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/feed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
