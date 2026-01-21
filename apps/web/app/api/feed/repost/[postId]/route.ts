import { getServerSession } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/feed/repost/[postId]
 * Create a repost of a post
 */
export async function POST(request: NextRequest, { params }: { params: { postId: string } }) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();
    const { postId } = params;

    // Check if original post exists
    const { data: originalPost, error: fetchError } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', postId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !originalPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check if user already reposted this
    const { data: existingRepost } = await supabase
      .from('posts')
      .select('id')
      .eq('author_id', session.userId)
      .eq('reposted_post_id', postId)
      .eq('type', 'REPOST')
      .is('deleted_at', null)
      .single();

    if (existingRepost) {
      return NextResponse.json({ error: 'Already reposted this post' }, { status: 400 });
    }

    // Create repost
    const { data: repost, error: insertError } = await supabase
      .from('posts')
      .insert({
        author_id: session.userId,
        type: 'REPOST',
        reposted_post_id: postId,
        content: '', // Reposts don't have additional content
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating repost:', insertError);
      return NextResponse.json({ error: 'Failed to create repost' }, { status: 500 });
    }

    // Increment repost count
    await supabase.rpc('increment_post_repost_count', { post_id: postId });

    return NextResponse.json({
      success: true,
      repost: {
        id: repost.id,
        created_at: repost.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/feed/repost/[postId]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/feed/repost/[postId]
 * Delete a repost (undo repost)
 */
export async function DELETE(request: NextRequest, { params }: { params: { postId: string } }) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();
    const { postId } = params;

    // Find and delete user's repost
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('author_id', session.userId)
      .eq('reposted_post_id', postId)
      .eq('type', 'REPOST');

    if (deleteError) {
      console.error('Error deleting repost:', deleteError);
      return NextResponse.json({ error: 'Failed to delete repost' }, { status: 500 });
    }

    // Decrement repost count
    await supabase.rpc('decrement_post_repost_count', { post_id: postId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/feed/repost/[postId]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
