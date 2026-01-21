'use server';
import { getServerSession } from '@/lib/auth/session';

import { createClient } from '@/lib/supabase/server';

/**
 * Toggle Like on Post
 */
export async function toggleLike(postId: string): Promise<{ liked: boolean; likeCount: number }> {
  try {
    const session = await getServerSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    const supabase = createClient();

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', session.userId)
      .single();

    if (existingLike) {
      // Unlike
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', session.userId);
    } else {
      // Like
      await supabase.from('post_likes').insert({
        post_id: postId,
        user_id: session.userId,
      });
    }

    // Get updated like count
    const { data: post } = await supabase
      .from('posts')
      .select('like_count')
      .eq('id', postId)
      .single();

    return {
      liked: !existingLike,
      likeCount: post?.like_count || 0,
    };
  } catch (error: any) {
    console.error('Error toggling like:', error);
    throw error;
  }
}

/**
 * Add Comment to Post
 */
export async function addComment(
  postId: string,
  content: string,
  parentCommentId?: string
): Promise<any> {
  try {
    const session = await getServerSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    const supabase = createClient();

    const { data: comment, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        author_id: session.userId,
        content,
        parent_comment_id: parentCommentId || null,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Fetch author profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url, bluecheck_status')
      .eq('user_id', session.userId)
      .single();

    return {
      ...comment,
      author: {
        id: session.userId,
        username: profile?.username || 'Anonymous',
        avatar_url: profile?.avatar_url,
        bluecheck:
          profile?.bluecheck_status === 'VERIFIED' || profile?.bluecheck_status === 'ACTIVE',
      },
    };
  } catch (error: any) {
    console.error('Error adding comment:', error);
    throw error;
  }
}

/**
 * React to Post (emoji reactions)
 */
export async function reactToPost(
  postId: string,
  reactionType: 'love' | 'haha' | 'wow' | 'sad' | 'angry'
): Promise<void> {
  try {
    const session = await getServerSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    const supabase = createClient();

    // Upsert reaction (replace if exists)
    await supabase.from('post_reactions').upsert(
      {
        post_id: postId,
        user_id: session.userId,
        reaction_type: reactionType,
      },
      {
        onConflict: 'post_id,user_id',
      }
    );
  } catch (error: any) {
    console.error('Error reacting to post:', error);
    throw error;
  }
}

/**
 * Track Post View
 */
export async function trackView(postId: string, sessionId?: string): Promise<void> {
  try {
    const session = await getServerSession();

    const supabase = createClient();

    // Insert view (unique constraint prevents duplicates)
    await supabase
      .from('post_views')
      .insert({
        post_id: postId,
        user_id: session?.userId || null,
        session_id: sessionId || null,
      })
      .select()
      .single();
  } catch (error: any) {
    // Silently fail if already viewed (unique constraint violation)
  }
}

/**
 * Edit Post
 */
export async function editPost(postId: string, content: string): Promise<void> {
  try {
    const session = await getServerSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    const supabase = createClient();

    // Verify ownership
    const { data: post } = await supabase
      .from('posts')
      .select('author_id, edit_count')
      .eq('id', postId)
      .single();

    if (post?.author_id !== session.userId) {
      throw new Error('Not authorized to edit this post');
    }

    // Update post
    await supabase
      .from('posts')
      .update({
        content,
        last_edited_at: new Date().toISOString(),
        edit_count: (post.edit_count || 0) + 1,
      })
      .eq('id', postId);
  } catch (error: any) {
    console.error('Error editing post:', error);
    throw error;
  }
}

/**
 * Delete Post (soft delete)
 */
export async function deletePost(postId: string): Promise<void> {
  try {
    const session = await getServerSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    const supabase = createClient();

    // Verify ownership
    const { data: post } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (post?.author_id !== session.userId) {
      throw new Error('Not authorized to delete this post');
    }

    // Soft delete
    await supabase
      .from('posts')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: session.userId,
      })
      .eq('id', postId);
  } catch (error: any) {
    console.error('Error deleting post:', error);
    throw error;
  }
}

/**
 * Share Post (track share action)
 */
export async function sharePost(
  postId: string,
  shareType: 'link' | 'repost' | 'quote'
): Promise<void> {
  try {
    const session = await getServerSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    const supabase = createClient();

    await supabase.from('post_shares').insert({
      post_id: postId,
      user_id: session.userId,
      share_type: shareType,
    });

    // Update share count
    await supabase.rpc('increment', {
      table_name: 'posts',
      row_id: postId,
      column_name: 'share_count',
    });
  } catch (error: any) {
    console.error('Error sharing post:', error);
    throw error;
  }
}

/**
 * Get Comments for Post
 */
export async function getComments(postId: string, parentCommentId?: string): Promise<any[]> {
  try {
    const supabase = createClient();

    const query = supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (parentCommentId) {
      query.eq('parent_comment_id', parentCommentId);
    } else {
      query.is('parent_comment_id', null);
    }

    const { data: comments, error } = await query;

    if (error) throw error;

    // Fetch author profiles
    const authorIds = [...new Set(comments.map((c: any) => c.author_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, bluecheck_status')
      .in('user_id', authorIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    return comments.map((comment: any) => {
      const author = profileMap.get(comment.author_id) || {};
      return {
        ...comment,
        author: {
          id: comment.author_id,
          username: author.username || 'Anonymous',
          avatar_url: author.avatar_url,
          bluecheck: author.bluecheck_status === 'VERIFIED' || author.bluecheck_status === 'ACTIVE',
        },
      };
    });
  } catch (error: any) {
    console.error('Error getting comments:', error);
    return [];
  }
}

/**
 * Get Reaction Breakdown for Post
 */
export async function getReactions(postId: string): Promise<{
  love: number;
  haha: number;
  wow: number;
  sad: number;
  angry: number;
  userReaction?: string;
}> {
  try {
    const session = await getServerSession();

    const supabase = createClient();

    // Get all reactions
    const { data: reactions } = await supabase
      .from('post_reactions')
      .select('reaction_type, user_id')
      .eq('post_id', postId);

    const breakdown = {
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
      userReaction: undefined as string | undefined,
    };

    reactions?.forEach((r: any) => {
      breakdown[r.reaction_type as keyof typeof breakdown]++;
      if (session && r.user_id === session.userId) {
        breakdown.userReaction = r.reaction_type;
      }
    });

    return breakdown;
  } catch (error: any) {
    console.error('Error getting reactions:', error);
    return {
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    };
  }
}

/**
 * Check if user liked post
 */
export async function checkUserLiked(postId: string): Promise<boolean> {
  try {
    const session = await getServerSession();

    if (!session) return false;

    const supabase = createClient();

    const { data } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', session.userId)
      .single();

    return !!data;
  } catch {
    return false;
  }
}
