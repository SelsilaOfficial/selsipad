'use server';

import { getServerSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface UpdateProfileData {
  nickname?: string;
}

/**
 * Validate nickname
 */
function validateNickname(nickname: string): { valid: boolean; error?: string } {
  if (!nickname) {
    return { valid: true }; // Nickname is optional
  }

  if (nickname.length < 3) {
    return { valid: false, error: 'Nickname must be at least 3 characters' };
  }

  if (nickname.length > 20) {
    return { valid: false, error: 'Nickname must be at most 20 characters' };
  }

  const nicknameRegex = /^[a-zA-Z0-9_]+$/;
  if (!nicknameRegex.test(nickname)) {
    return { valid: false, error: 'Nickname can only contain letters, numbers, and underscores' };
  }

  return { valid: true };
}

/**
 * Upload avatar to Supabase Storage
 */
async function uploadAvatar(userId: string, file: File): Promise<string> {
  // Use admin client to bypass RLS for storage
  const supabaseAdmin = createClient();

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPG, PNG, and WebP are allowed');
  }

  // Validate file size (2MB)
  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    throw new Error('File size must be less than 2MB');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const ext = file.name.split('.').pop();
  const filename = `${userId}/${timestamp}.${ext}`;

  // Upload to storage using service role
  const { error: uploadError } = await supabaseAdmin.storage
    .from('avatars')
    .upload(filename, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error('Failed to upload avatar');
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from('avatars').getPublicUrl(filename);

  return publicUrl;
}

/**
 * Update user profile
 */
export async function updateProfile(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get session
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();
    const updates: any = {};

    // Handle nickname update
    const nickname = formData.get('nickname') as string;
    if (nickname !== undefined && nickname !== null) {
      const validation = validateNickname(nickname);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      // Update both nickname and username for compatibility
      const nicknameValue = nickname || null;
      updates.nickname = nicknameValue;
      updates.username = nicknameValue; // Also update username column
    }

    // Handle avatar upload
    const avatarFile = formData.get('avatar') as File | null;
    if (avatarFile && avatarFile.size > 0) {
      try {
        const avatarUrl = await uploadAvatar(session.userId, avatarFile);
        updates.avatar_url = avatarUrl;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    // Update database
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', session.userId);

      if (error) {
        console.error('Database update error:', error);
        return { success: false, error: 'Failed to update profile' };
      }
    }

    // Revalidate profile page
    revalidatePath('/profile');
    revalidatePath('/profile/edit');

    return { success: true };
  } catch (error: any) {
    console.error('Update profile error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Delete user avatar
 */
export async function deleteAvatar(): Promise<{ success: boolean; error?: string }> {
  try {
    // Get session
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    // Get current avatar URL to extract filename
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', session.userId)
      .single();

    if (!profile?.avatar_url) {
      return { success: true }; // No avatar to delete
    }

    // Extract filename from URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/avatars/[userId]/[timestamp].ext
    const urlParts = profile.avatar_url.split('/avatars/');
    if (urlParts.length > 1) {
      const filename = urlParts[1];

      // Delete from storage
      const { error: deleteError } = await supabase.storage.from('avatars').remove([filename]);

      if (deleteError) {
        console.error('Storage delete error:', deleteError);
        // Continue anyway - update DB even if storage delete fails
      }
    }

    // Update database - set avatar_url to null
    const { error } = await supabase
      .from('profiles')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', session.userId);

    if (error) {
      console.error('Database update error:', error);
      return { success: false, error: 'Failed to delete avatar' };
    }

    // Revalidate
    revalidatePath('/profile');
    revalidatePath('/profile/edit');

    return { success: true };
  } catch (error: any) {
    console.error('Delete avatar error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
