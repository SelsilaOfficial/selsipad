'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * Check if current user has Solana wallet linked
 * Returns Solana address if exists, null otherwise
 */
export async function checkSolanaWallet(): Promise<string | null> {
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  const supabase = createClient();

  const { data: solanaWallet } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', session.userId)
    .eq('chain', 'SOLANA')
    .eq('wallet_role', 'SECONDARY')
    .single();

  return solanaWallet?.address || null;
}

/**
 * Get user's primary (EVM) wallet
 */
export async function getPrimaryWallet() {
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  const supabase = createClient();

  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, address, chain')
    .eq('user_id', session.userId)
    .eq('wallet_role', 'PRIMARY')
    .single();

  return wallet;
}
