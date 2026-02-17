/**
 * GET /api/v1/posts/[id]
 * Get single post with thread context
 *
 * DELETE /api/v1/posts/[id]
 * Soft delete post (author or admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const postId = params.id;

    // Get post with all relations
    const { data: post, error } = await supabase
      .from('posts')
      .select(
        `
        *,
        author:profiles!posts_author_id_fkey(user_id, username, avatar_url, bluecheck_status),
        project:projects(id, name, logo_url),
        parent_post:posts!posts_parent_post_id_fkey(
          id,
          content,
          author_id,
          created_at,
          author:profiles!posts_author_id_fkey(user_id, username, avatar_url, bluecheck_status)
        ),
        quoted_post:posts!posts_quoted_post_id_fkey(
          id,
          content,
          author_id,
          created_at,
          author:profiles!posts_author_id_fkey(user_id, username, avatar_url, bluecheck_status)
        ),
        reposted_post:posts!posts_reposted_post_id_fkey(
          id,
          content,
          author_id,
          created_at,
          author:profiles!posts_author_id_fkey(user_id, username, avatar_url, bluecheck_status)
        )
      `
      )
      .eq('id', postId)
      .is('deleted_at', null)
      .single();

    if (error || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Get engagement counts
    const [replyCount, quoteCount, repostCount] = await Promise.all([
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('parent_post_id', postId)
        .is('deleted_at', null),
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('quoted_post_id', postId)
        .is('deleted_at', null),
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('reposted_post_id', postId)
        .is('deleted_at', null),
    ]);

    return NextResponse.json({
      post: {
        ...post,
        engagement: {
          reply_count: replyCount.count || 0,
          quote_count: quoteCount.count || 0,
          repost_count: repostCount.count || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error in GET /api/v1/posts/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const postId = params.id;

    // Get post to check ownership
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('author_id, deleted_at')
      .eq('id', postId)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.deleted_at) {
      return NextResponse.json({ error: 'Post already deleted' }, { status: 410 });
    }

    // Check if user is author
    // TODO: Also allow admin to delete (check admin role from FASE 2)
    if (post.author_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You can only delete your own posts' },
        { status: 403 }
      );
    }

    // Soft delete (set deleted_at)
    const { error: deleteError } = await supabase
      .from('posts')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq('id', postId);

    if (deleteError) {
      console.error('Error deleting post:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete post', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Error in DELETE /api/v1/posts/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
