'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Look up the referrer's wallet address for a given wallet.
 * Uses service role to bypass RLS on referral_relationships.
 * 
 * Flow: walletAddress → user_id → referral_relationships → referrer wallet
 */
export async function getReferrerWallet(walletAddress: string): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();

    // 1. Find user_id from wallet address
    const { data: walletData } = await supabase
      .from('wallets')
      .select('user_id')
      .ilike('address', walletAddress)
      .limit(1)
      .single();

    if (!walletData) return null;

    // 2. Find referrer from referral_relationships
    const { data: refData } = await supabase
      .from('referral_relationships')
      .select('referrer_id')
      .eq('referee_id', walletData.user_id)
      .limit(1)
      .single();

    if (!refData) return null;

    // 3. Get referrer's primary wallet address
    const { data: refWallet } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', refData.referrer_id)
      .eq('is_primary', true)
      .limit(1)
      .single();

    return refWallet?.address || null;
  } catch (err) {
    console.error('[getReferrerWallet] Error:', err);
    return null;
  }
}
