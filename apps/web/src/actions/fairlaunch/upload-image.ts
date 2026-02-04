'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';

interface UploadImageResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload image to fairlaunch-assets bucket
 * 
 * @param formData - FormData containing the image file
 * @param type - 'logo' or 'banner'
 * @returns Public URL or error
 */
export async function uploadFairlaunchImage(
  formData: FormData,
  type: 'logo' | 'banner'
): Promise<UploadImageResult> {
  try {
    // 1. Check authentication
    const session = await getServerSession();
    if (!session || !session.userId) {
      return {
        success: false,
        error: 'Unauthorized - please login',
      };
    }

    // 2. Get file from FormData
    const file = formData.get('file') as File;
    if (!file) {
      return {
        success: false,
        error: 'No file provided',
      };
    }

    // 3. Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Only PNG, JPG, and WebP are allowed',
      };
    }

    // 4. Validate file size
    const maxSize = type === 'logo' ? 2 * 1024 * 1024 : 5 * 1024 * 1024; // 2MB for logo, 5MB for banner
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return {
        success: false,
        error: `File too large. Maximum size is ${maxSizeMB}MB`,
      };
    }

    // 5. Use service role client to bypass RLS
    const supabase = createServiceRoleClient();

    // 6. Generate unique filename
    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const filename = `${type}_${timestamp}.${ext}`;
    const filePath = `${session.userId}/${filename}`;

    // 7. Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('fairlaunch-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true, // Allow overwriting
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return {
        success: false,
        error: 'Failed to upload image: ' + uploadError.message,
      };
    }

    // 8. Get public URL
    const { data: urlData } = supabase.storage
      .from('fairlaunch-assets')
      .getPublicUrl(filePath);

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error: any) {
    console.error('uploadFairlaunchImage error:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error uploading image',
    };
  }
}
