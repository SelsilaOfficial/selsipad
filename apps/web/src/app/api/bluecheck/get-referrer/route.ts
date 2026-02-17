/**
 * Backend API: Get Referrer Address
 *
 * Returns the wallet address of the user's referrer for Blue Check purchase
 * If no referrer, returns null (frontend will use zero address fallback)
 */

import { getServerSession } from '@/lib/auth/session';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession();

    // If no session, return null (no referrer)
    if (!session?.userId) {
      console.log('[BlueCheck GetReferrer] No session');
      return NextResponse.json({ referrer_address: null });
    }

    console.log('[BlueCheck GetReferrer] Looking up referrer for user:', session.userId);

    // Use service role to bypass RLS
    const supabase = createServiceRoleClient();

    // Get user's referrer relationship (don't filter by is_active - new referrals may not be activated yet)
    const { data: relationship, error: relError } = await supabase
      .from('referral_relationships')
      .select('referrer_id')
      .eq('referee_id', session.userId)
      .single();

    console.log('[BlueCheck GetReferrer] Relationship:', relationship, 'Error:', relError?.message);

    if (!relationship?.referrer_id) {
      console.log('[BlueCheck GetReferrer] No referrer found for user');
      return NextResponse.json({ referrer_address: null });
    }

    // Get referrer's wallet address - check ALL chains, prefer BSC Testnet
    const { data: wallets, error: walletError } = await supabase
      .from('wallets')
      .select('address, chain')
      .eq('user_id', relationship.referrer_id)
      .order('chain', { ascending: true });

    console.log(
      '[BlueCheck GetReferrer] Referrer wallets:',
      wallets,
      'Error:',
      walletError?.message
    );

    if (!wallets || wallets.length === 0) {
      console.warn('[BlueCheck GetReferrer] Referrer has no wallets:', relationship.referrer_id);
      return NextResponse.json({ referrer_address: null });
    }

    // Prefer BSC Testnet (chain 97), fallback to any wallet
    const bscWallet = wallets.find((w) => w.chain === '97');
    const walletAddress = bscWallet?.address || wallets[0]?.address;

    console.log(
      '[BlueCheck GetReferrer] Using wallet:',
      walletAddress,
      '(chain:',
      bscWallet ? '97' : wallets[0]?.chain,
      ')'
    );

    return NextResponse.json({
      referrer_address: walletAddress,
      referrer_id: relationship.referrer_id,
    });
  } catch (error) {
    console.error('[BlueCheck GetReferrer] Error:', error);
    return NextResponse.json({ referrer_address: null });
  }
}
