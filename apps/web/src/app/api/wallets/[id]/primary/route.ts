import { NextRequest, NextResponse } from 'next/server';
import {
    getSupabaseServiceClient,
    setPrimaryWallet,
    errorResponse,
    successResponse
} from '@selsipad/shared';

/**
 * PATCH /api/wallets/[id]/primary
 * Set wallet as primary for its chain
 * 
 * Requires: Authentication
 */
export const dynamic = 'force-dynamic';

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json(
                errorResponse('UNAUTHORIZED', 'Authentication required'),
                { status: 401 }
            );
        }

        const userId = 'temp-user-id'; // Replace with actual auth
        const walletId = params.id;

        // Get wallet to verify ownership and chain
        const supabase = getSupabaseServiceClient();
        const { data: wallet, error } = await supabase
            .from('wallets')
            .select('*')
            .eq('id', walletId)
            .single();

        if (error || !wallet) {
            return NextResponse.json(
                errorResponse('NOT_FOUND', 'Wallet not found'),
                { status: 404 }
            );
        }

        // Verify ownership
        if (wallet.user_id !== userId) {
            return NextResponse.json(
                errorResponse('FORBIDDEN', 'You do not own this wallet'),
                { status: 403 }
            );
        }

        // Set as primary
        const updatedWallet = await setPrimaryWallet(userId, walletId, wallet.chain);

        return NextResponse.json(
            successResponse({ wallet: updatedWallet }),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Error setting primary wallet:', error);
        return NextResponse.json(
            errorResponse('INTERNAL_ERROR', error.message || 'Failed to set primary wallet'),
            { status: 500 }
        );
    }
}
