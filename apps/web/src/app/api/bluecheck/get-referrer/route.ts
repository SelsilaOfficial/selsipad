/**
 * Backend API: Get Referrer Address
 *
 * Returns the wallet address of the user's referrer for Blue Check purchase
 * If no referrer, returns null (frontend will use zero address fallback)
 */

import { getServerSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getServerSession();

    // If no session, return null (no referrer)
    if (!session?.userId) {
      return NextResponse.json({ referrer_address: null });
    }

    const supabase = await createClient();

    // Get user's referrer relationship
    const { data: relationship } = await supabase
      .from('referral_relationships')
      .select('referrer_id')
      .eq('referee_id', session.userId)
      .eq('is_active', true)
      .single();

    if (!relationship?.referrer_id) {
      return NextResponse.json({ referrer_address: null });
    }

    // Get referrer's wallet address on BSC Testnet (chain 97)
    const { data: wallet } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', relationship.referrer_id)
      .eq('chain', '97') // BSC Testnet
      .single();

    if (!wallet?.address) {
      console.warn('Referrer has no BSC Testnet wallet:', relationship.referrer_id);
      return NextResponse.json({ referrer_address: null });
    }

    return NextResponse.json({
      referrer_address: wallet.address,
      referrer_id: relationship.referrer_id,
    });
  } catch (error) {
    console.error('Error fetching referrer address:', error);
    return NextResponse.json({ referrer_address: null });
  }
}
