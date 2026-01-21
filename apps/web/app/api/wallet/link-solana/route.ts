import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * POST /api/wallet/link-solana
 * Link Solana wallet to authenticated user as SECONDARY wallet
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify user is authenticated (must have EVM PRIMARY wallet)
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect EVM wallet first.' },
        { status: 401 }
      );
    }

    // 2. Get Solana wallet info from request
    const body = await request.json();
    const { address, signature, message } = body;

    if (!address) {
      return NextResponse.json({ error: 'Solana address required' }, { status: 400 });
    }

    // TODO: Verify signature (optional for now)
    // In production, verify the signature matches the message

    const supabase = createClient();

    // 3. Check if this Solana address is already linked to ANY user
    const { data: existing } = await supabase
      .from('wallets')
      .select('user_id')
      .eq('address', address.toLowerCase())
      .eq('chain', 'SOLANA')
      .single();

    if (existing) {
      if (existing.user_id === session.userId) {
        return NextResponse.json({
          success: true,
          message: 'Wallet already linked to your account',
        });
      }

      return NextResponse.json(
        { error: 'This Solana wallet is already linked to another account' },
        { status: 409 }
      );
    }

    // 4. Link Solana wallet as SECONDARY
    const { data: wallet, error } = await supabase
      .from('wallets')
      .insert({
        user_id: session.userId,
        chain: 'SOLANA',
        address: address.toLowerCase(),
        wallet_role: 'SECONDARY',
        verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error linking Solana wallet:', error);
      return NextResponse.json({ error: 'Failed to link wallet' }, { status: 500 });
    }

    console.log('[Link Solana] Wallet linked successfully:', {
      user_id: session.userId,
      wallet_id: wallet.id,
      address: wallet.address,
    });

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        role: wallet.wallet_role,
      },
    });
  } catch (error) {
    console.error('[Link Solana API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
