/**
 * GET /api/v1/projects/[id]/feed
 * Get project-specific feed (for trending calculation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const POSTS_PER_PAGE = 20;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const projectId = params.id;

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || String(POSTS_PER_PAGE));

    // Build query
    let query = supabase
      .from('posts')
      .select(
        `
        *,
        author:profiles!posts_author_id_fkey(user_id, username, avatar_url, bluecheck_status)
      `
      )
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('Error fetching project feed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch project feed', details: error.message },
        { status: 500 }
      );
    }

    const hasMore = posts.length > limit;
    const feedPosts = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor =
      hasMore && feedPosts.length > 0 ? feedPosts[feedPosts.length - 1].created_at : null;

    // Get engagement counts
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
      project,
      posts: postsWithEngagement,
      cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/projects/[id]/feed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
