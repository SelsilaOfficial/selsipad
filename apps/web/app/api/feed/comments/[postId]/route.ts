import { getServerSession } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/feed/comments/[postId]
 * Get comments for a post
 */
export async function GET(request: NextRequest, { params }: { params: { postId: string } }) {
  try {
    const supabase = createClient();
    const { postId } = params;

    const { data: comments, error } = await supabase
      .from('post_comments')
      .select(
        `
        id,
        content,
        created_at,
        updated_at,
        like_count,
        author_id,
        parent_comment_id
      `
      )
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    // Get author profiles for all comments
    const authorIds = [...new Set(comments.map((c) => c.author_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, bluecheck_status')
      .in('user_id', authorIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    // Format comments with author info
    const formattedComments = comments.map((comment) => {
      const profile = profileMap.get(comment.author_id);
      return {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        like_count: comment.like_count,
        parent_comment_id: comment.parent_comment_id,
        author: {
          id: comment.author_id,
          username: profile?.username || 'Unknown',
          avatar_url: profile?.avatar_url,
          bluecheck:
            profile?.bluecheck_status === 'ACTIVE' || profile?.bluecheck_status === 'VERIFIED',
        },
      };
    });

    return NextResponse.json({ comments: formattedComments });
  } catch (error: any) {
    console.error('Error in GET /api/feed/comments/[postId]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/feed/comments/[postId]
 * Create a comment on a post
 */
export async function POST(request: NextRequest, { params }: { params: { postId: string } }) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();
    const { postId } = params;
    const { content } = await request.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Insert comment
    const { data: newComment, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        author_id: session.userId,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    // Get author profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url, bluecheck_status')
      .eq('user_id', session.userId)
      .single();

    return NextResponse.json({
      comment: {
        id: newComment.id,
        content: newComment.content,
        created_at: newComment.created_at,
        updated_at: newComment.updated_at,
        like_count: 0,
        parent_comment_id: newComment.parent_comment_id,
        author: {
          id: session.userId,
          username: profile?.username || 'Unknown',
          avatar_url: profile?.avatar_url,
          bluecheck:
            profile?.bluecheck_status === 'ACTIVE' || profile?.bluecheck_status === 'VERIFIED',
        },
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/feed/comments/[postId]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
