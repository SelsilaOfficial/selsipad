import { NextRequest, NextResponse } from 'next/server';
import {
  generateMFASecret,
  encryptMFASecret,
  getSupabaseServiceClient,
  errorResponse,
  successResponse,
  requireAdmin,
} from '@selsipad/shared';

/**
 * POST /api/admin/mfa/enroll
 * Generate MFA secret and QR code for enrollment
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user (placeholder - implement proper auth middleware)
    const userId = req.headers.get('x-user-id'); // Replace with actual JWT verification
    if (!userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), {
        status: 401,
      });
    }

    // Check if user is admin
    try {
      await requireAdmin(userId);
    } catch (error: any) {
      return NextResponse.json(errorResponse(error.message, 'Admin access required'), {
        status: 403,
      });
    }

    const supabase = getSupabaseServiceClient();

    // Check if already enrolled
    const { data: profile } = await supabase
      .from('profiles')
      .select('mfa_enabled')
      .eq('user_id', userId)
      .single();

    if (profile?.mfa_enabled) {
      return NextResponse.json(
        errorResponse('MFA_ALREADY_ENABLED', 'MFA is already enabled for this account'),
        { status: 400 }
      );
    }

    // Get user email
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    if (!authUser || !authUser.user) {
      return NextResponse.json(errorResponse('USER_NOT_FOUND', 'User not found'), { status: 404 });
    }

    // Generate MFA secret
    const { secret, qrCodeUrl, otpauthUrl } = await generateMFASecret(authUser.user.email!);

    // Encrypt and temporarily store secret (will be confirmed after verification)
    const encryptedSecret = encryptMFASecret(secret);

    await supabase
      .from('profiles')
      .update({ mfa_secret_encrypted: encryptedSecret })
      .eq('user_id', userId);

    return NextResponse.json(
      successResponse({
        qrCodeUrl,
        secret, // Show once for manual entry
        otpauthUrl,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[MFA Enroll] Error:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to enroll MFA'),
      { status: 500 }
    );
  }
}
