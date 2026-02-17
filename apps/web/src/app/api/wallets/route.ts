import { NextRequest, NextResponse } from 'next/server';
import {
    getSupabaseServiceClient,
    linkWalletToUser,
    setPrimaryWallet,
    errorResponse,
    successResponse
} from '@selsipad/shared';

/**
 * POST /api/wallets/link
 * Link additional wallet to authenticated user
 * 
 * Requires: Authentication
 * Body: { walletAddress: string, chain: string }
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // Get authenticated user (from session token)
        // TODO: Implement proper auth middleware
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json(
                errorResponse('UNAUTHORIZED', 'Authentication required'),
                { status: 401 }
            );
        }

        // Extract user ID from token (placeholder - implement proper JWT verification)
        // const userId = await verifyToken(authHeader);
        const userId = 'temp-user-id'; // Replace with actual auth

        const { walletAddress, chain } = await req.json();

        if (!walletAddress || !chain) {
            return NextResponse.json(
                errorResponse('INVALID_INPUT', 'Missing walletAddress or chain'),
                { status: 400 }
            );
        }

        // Link wallet
        const wallet = await linkWalletToUser(userId, walletAddress, chain);

        return NextResponse.json(
            successResponse({ wallet }),
            { status: 201 }
        );
    } catch (error: any) {
        console.error('Error linking wallet:', error);

        // Handle duplicate wallet error
        if (error.message?.includes('already exists')) {
            return NextResponse.json(
                errorResponse('WALLET_ALREADY_LINKED', 'This wallet is already linked to an account'),
                { status: 409 }
            );
        }

        return NextResponse.json(
            errorResponse('INTERNAL_ERROR', error.message || 'Failed to link wallet'),
            { status: 500 }
        );
    }
}

/**
 * GET /api/wallets
 * Get all wallets for authenticated user
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json(
                errorResponse('UNAUTHORIZED', 'Authentication required'),
                { status: 401 }
            );
        }

        const userId = 'temp-user-id'; // Replace with actual auth

        const supabase = getSupabaseServiceClient();
        const { data: wallets, error } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return NextResponse.json(
            successResponse({ wallets }),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Error fetching wallets:', error);
        return NextResponse.json(
            errorResponse('INTERNAL_ERROR', error.message || 'Failed to fetch wallets'),
            { status: 500 }
        );
    }
}
