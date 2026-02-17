import { NextRequest, NextResponse } from 'next/server';
import { generateNonce, createSignInMessage, errorResponse, successResponse } from '@selsipad/shared';

/**
 * POST /api/auth/nonce
 * Generate a nonce for wallet signature challenge
 * 
 * Body: { walletAddress: string, chain: string }
 * Returns: { nonce: string, message: string}
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { walletAddress, chain } = await req.json();

        // Validation
        if (!walletAddress || !chain) {
            return NextResponse.json(
                errorResponse('INVALID_INPUT', 'Missing walletAddress or chain'),
                { status: 400 }
            );
        }

        // Validate chain format
        const validChains = ['EVM_1', 'EVM_56', 'EVM_137', 'EVM_97', 'SOLANA', 'SOLANA_DEVNET'];
        if (!validChains.includes(chain)) {
            return NextResponse.json(
                errorResponse('INVALID_CHAIN', `Invalid chain. Must be one of: ${validChains.join(', ')}`),
                { status: 400 }
            );
        }

        // Validate address format (basic check)
        if (chain.startsWith('EVM') && !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            return NextResponse.json(
                errorResponse('INVALID_ADDRESS', 'Invalid EVM address format'),
                { status: 400 }
            );
        }

        // Generate nonce
        const nonce = await generateNonce(walletAddress, chain);
        const message = createSignInMessage(nonce, chain);

        return NextResponse.json(
            successResponse({ nonce, message }),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Error generating nonce:', error);
        return NextResponse.json(
            errorResponse('INTERNAL_ERROR', error.message || 'Failed to generate nonce'),
            { status: 500 }
        );
    }
}
