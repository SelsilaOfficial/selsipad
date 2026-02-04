'use server';
import { getServerSession } from '@/lib/auth/session';

import { createClient } from '@/lib/supabase/server';
import { type Post } from '@/lib/data/feed';

/**
 * Create Post Server Action
 *
 * Creates a new post in the social feed
 * Requires Blue Check status for posting
 */
export async function createPost(
  content: string,
  imageUrls?: string[],
  projectId?: string
): Promise<Post> {
  try {
    // Get authenticated session (wallet-only auth)
    const session = await getServerSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    const supabase = createClient();

    // Check Blue Check status (required for posting)
    const { data: profile } = await supabase
      .from('profiles')
      .select('bluecheck_status, username, avatar_url')
      .eq('user_id', session.userId)
      .single();

    console.log('[createPost] Blue Check verification:', {
      userId: session.userId,
      profile,
      bluecheck_status: profile?.bluecheck_status,
      isEligible:
        profile?.bluecheck_status?.toUpperCase() === 'ACTIVE' ||
        profile?.bluecheck_status?.toUpperCase() === 'VERIFIED',
    });

    const bluecheckStatus = profile?.bluecheck_status?.toUpperCase();
    if (!profile || (bluecheckStatus !== 'ACTIVE' && bluecheckStatus !== 'VERIFIED')) {
      throw new Error(
        `Blue Check status required to create posts (current: ${profile?.bluecheck_status})`
      );
    }

    // Extract hashtags from content (case-insensitive)
    const extractHashtags = (text: string): string[] => {
      const matches = text.match(/#\w+/g);
      return matches ? [...new Set(matches.map(tag => tag.toLowerCase()))] : [];
    };

    const hashtags = extractHashtags(content);

    console.log('[createPost] Extracted hashtags:', { count: hashtags.length, hashtags });

    // Insert new post
    const { data: newPost, error } = await supabase
      .from('posts')
      .insert({
        author_id: session.userId,
        content,
        project_id: projectId,
        type: 'POST', // Changed from TEXT to POST to match schema
        image_urls: imageUrls || [],
        hashtags: hashtags,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      throw error;
    }

    return {
      id: newPost.id,
      author: {
        id: session.userId,
        username: profile.username || 'Anonymous',
        avatar_url: profile.avatar_url,
        bluecheck: true,
      },
      content: newPost.content,
      project_id: newPost.project_id,
      type: 'text',
      created_at: newPost.created_at,
      likes: 0,
      replies: 0,
      is_liked: false,
      image_urls: newPost.image_urls || [],
    };
  } catch (err) {
    console.error('Unexpected error in createPost:', err);
    throw err;
  }
}
