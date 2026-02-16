import { NextRequest, NextResponse } from 'next/server';
import {
    verifyTOTP,
    decryptMFASecret,
    generateRecoveryCodes,
    hashRecoveryCode,
    getSupabaseServiceClient,
    errorResponse,
    successResponse,
    writeAuditLog
} from '@selsipad/shared';

/**
 * POST /api/admin/mfa/verify
 * Verify TOTP token and enable MFA
 */
export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json();
        const userId = req.headers.get('x-user-id');

        if (!userId) {
            return NextResponse.json(
                errorResponse('UNAUTHORIZED', 'Authentication required'),
                { status: 401 }
            );
        }

        if (!token) {
            return NextResponse.json(
                errorResponse('INVALID_INPUT', 'TOTP token is required'),
                { status: 400 }
            );
        }

        const supabase = getSupabaseServiceClient();

        // Get encrypted secret
        const { data: profile } = await supabase
            .from('profiles')
            .select('mfa_secret_encrypted, mfa_enabled')
            .eq('user_id', userId)
            .single();

        if (!profile?.mfa_secret_encrypted) {
            return NextResponse.json(
                errorResponse('NO_MFA_SECRET', 'No MFA secret found. Please enroll first.'),
                { status: 400 }
            );
        }

        if (profile.mfa_enabled) {
            return NextResponse.json(
                errorResponse('MFA_ALREADY_ENABLED', 'MFA is already enabled'),
                { status: 400 }
            );
        }

        // Decrypt and verify token
        const secret = decryptMFASecret(profile.mfa_secret_encrypted);
        const isValid = verifyTOTP(secret, token);

        if (!isValid) {
            return NextResponse.json(
                errorResponse('INVALID_TOKEN', 'Invalid TOTP token'),
                { status: 401 }
            );
        }

        // Generate recovery codes
        const recoveryCodes = generateRecoveryCodes(10);

        // Store hashed recovery codes
        await supabase.from('admin_recovery_codes').insert(
            recoveryCodes.map((code: string) => ({
                user_id: userId,
                code_hash: hashRecoveryCode(code)
            }))
        );

        // Enable MFA
        await supabase
            .from('profiles')
            .update({
                mfa_enabled: true,
                mfa_verified_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        // Write audit log
        await writeAuditLog({
            actor: userId,
            action: 'MFA_ENABLED',
            entityType: 'profile',
            entityId: userId
        });

        return NextResponse.json(
            successResponse({
                success: true,
                recovery_codes: recoveryCodes // Show once - user must save these
            }),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('[MFA Verify] Error:', error);
        return NextResponse.json(
            errorResponse('INTERNAL_ERROR', error.message || 'Failed to verify MFA'),
            { status: 500 }
        );
    }
}
