'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Follow a user
 * Only allows following users with at least one active badge
 */
export async function followUser(targetUserId: string) {
  try {
    const supabase = createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    if (user.id === targetUserId) {
      return { success: false, error: 'Cannot follow yourself' };
    }

    // Check if target user is followable (has active badge)
    const { data: isFollowable, error: checkError } = await supabase.rpc('is_user_followable', {
      target_user_id: targetUserId,
    });

    if (checkError) {
      console.error('Error checking if user is followable:', checkError);
      return { success: false, error: 'Failed to validate user' };
    }

    if (!isFollowable) {
      return {
        success: false,
        error: 'User must have at least one active badge to be followed',
      };
    }

    // Create follow relationship
    const { error: insertError } = await supabase.from('user_follows').insert({
      follower_id: user.id,
      following_id: targetUserId,
    });

    if (insertError) {
      // Check if already following
      if (insertError.code === '23505') {
        return { success: false, error: 'Already following this user' };
      }
      console.error('Error following user:', insertError);
      return { success: false, error: 'Failed to follow user' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in followUser:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Unfollow a user
 */
export async function unfollowUser(targetUserId: string) {
  try {
    const supabase = createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Delete follow relationship
    const { error: deleteError } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId);

    if (deleteError) {
      console.error('Error unfollowing user:', deleteError);
      return { success: false, error: 'Failed to unfollow user' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in unfollowUser:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Check if current user is following target user
 */
export async function checkIfFollowing(targetUserId: string) {
  try {
    const supabase = createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { isFollowing: false };
    }

    // Check if follow relationship exists
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error
      console.error('Error checking follow status:', error);
      return { isFollowing: false };
    }

    return { isFollowing: !!data };
  } catch (error) {
    console.error('Unexpected error in checkIfFollowing:', error);
    return { isFollowing: false };
  }
}

/**
 * Check if a user can be followed (has active badge)
 */
export async function checkUserFollowable(targetUserId: string) {
  try {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('is_user_followable', {
      target_user_id: targetUserId,
    });

    if (error) {
      console.error('Error checking if user is followable:', error);
      return { isFollowable: false };
    }

    return { isFollowable: !!data };
  } catch (error) {
    console.error('Unexpected error in checkUserFollowable:', error);
    return { isFollowable: false };
  }
}

/**
 * Get list of followers for a user
 */
export async function getFollowers(userId: string, limit = 50, offset = 0) {
  try {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('get_user_followers', {
      target_user_id: userId,
      result_limit: limit,
      result_offset: offset,
    });

    if (error) {
      console.error('Error fetching followers:', error);
      return { followers: [], error: 'Failed to fetch followers' };
    }

    return { followers: data || [] };
  } catch (error) {
    console.error('Unexpected error in getFollowers:', error);
    return { followers: [], error: 'An unexpected error occurred' };
  }
}

/**
 * Get list of users being followed by a user
 */
export async function getFollowing(userId: string, limit = 50, offset = 0) {
  try {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('get_user_following', {
      target_user_id: userId,
      result_limit: limit,
      result_offset: offset,
    });

    if (error) {
      console.error('Error fetching following:', error);
      return { following: [], error: 'Failed to fetch following' };
    }

    return { following: data || [] };
  } catch (error) {
    console.error('Unexpected error in getFollowing:', error);
    return { following: [], error: 'An unexpected error occurred' };
  }
}
