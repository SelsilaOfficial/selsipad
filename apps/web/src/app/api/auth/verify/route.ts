import { NextRequest, NextResponse } from 'next/server';
import {
    verifyNonce,
    markNonceUsed,
    verifySignatureEVM,
    verifySignatureSolana,
    createSignInMessage,
    linkWalletToUser,
    getSupabaseServiceClient,
    errorResponse,
    successResponse
} from '@selsipad/shared';

/**
 * POST /api/auth/verify
 * Verify wallet signature and create/link user account
 * 
 * Body: { walletAddress: string, signature: string, nonce: string, chain: string }
 * Returns: { token: string, user: {...} }
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { walletAddress, signature, nonce, chain } = await req.json();

        // Validation
        if (!walletAddress || !signature || !nonce || !chain) {
            return NextResponse.json(
                errorResponse('INVALID_INPUT', 'Missing required fields'),
                { status: 400 }
            );
        }

        // 1. Verify nonce is valid (not expired, not used)
        const nonceRecord = await verifyNonce(nonce, walletAddress, chain);
        if (!nonceRecord) {
            return NextResponse.json(
                errorResponse('INVALID_NONCE', 'Nonce is invalid, expired, or already used'),
                { status: 401 }
            );
        }

        // 2. Verify signature
        const message = createSignInMessage(nonce, chain);
        let isValid = false;

        if (chain.startsWith('EVM')) {
            isValid = await verifySignatureEVM(walletAddress, message, signature);
        } else if (chain.startsWith('SOLANA')) {
            isValid = await verifySignatureSolana(walletAddress, message, signature);
        } else {
            return NextResponse.json(
                errorResponse('UNSUPPORTED_CHAIN', 'Chain not supported'),
                { status: 400 }
            );
        }

        if (!isValid) {
            return NextResponse.json(
                errorResponse('INVALID_SIGNATURE', 'Signature verification failed'),
                { status: 401 }
            );
        }

        // 3. Mark nonce as used (prevent replay attacks)
        await markNonceUsed(nonceRecord.id);

        // 4. Create or get user + session
        const supabase = getSupabaseServiceClient();

        // Check if wallet already linked to a user
        const normalizedAddress = chain.startsWith('EVM')
            ? walletAddress.toLowerCase()
            : walletAddress;

        const { data: existingWallet } = await supabase
            .from('wallets')
            .select('user_id, id')
            .eq('address', normalizedAddress)
            .eq('chain', chain)
            .single();

        let userId: string;
        let isNewUser = false;

        if (existingWallet) {
            // Wallet already linked - use existing user
            userId = existingWallet.user_id;
        } else {
            // New wallet - create user account
            // For now, create anonymous user (Supabase custom auth flow)
            // In production, use signUp() or custom JWT generation

            // Create auth user (placeholder - implement proper Supabase Auth)
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: `${normalizedAddress}@wallet.selsipad.com`, // temporary email
                email_confirm: true,
                user_metadata: {
                    wallet_address: normalizedAddress,
                    chain: chain
                }
            });

            if (authError || !authData.user) {
                throw new Error(`Failed to create user: ${authError?.message}`);
            }

            userId = authData.user.id;
            isNewUser = true;

            // Create profile
            await supabase.from('profiles').insert({
                user_id: userId,
                username: null, // User can set later
                bluecheck_status: 'NONE'
            });

            // Link wallet
            await linkWalletToUser(userId, normalizedAddress, chain);
        }

        // 5. Generate session token (using Supabase Auth)
        const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: `user-${userId}@wallet.selsipad.com`
        });

        if (sessionError) {
            throw new Error(`Failed to generate session: ${sessionError.message}`);
        }

        // Get user data
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        return NextResponse.json(
            successResponse({
                token: sessionData.properties.action_link, // Placeholder - implement proper JWT
                user: {
                    id: userId,
                    profile,
                    is_new_user: isNewUser
                }
            }),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Error verifying signature:', error);
        return NextResponse.json(
            errorResponse('INTERNAL_ERROR', error.message || 'Failed to verify signature'),
            { status: 500 }
        );
    }
}
