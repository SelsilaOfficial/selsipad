'use server';

import { getServerSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export interface Wallet {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  is_primary: boolean;
  wallet_role: 'PRIMARY' | 'SECONDARY';
  created_at: string;
}

/**
 * Set Primary Wallet
 */
export async function setPrimaryWalletAction(walletId: string): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const supabase = createClient();

  // First, unset all primary wallets for this user
  await supabase.from('wallets').update({ is_primary: false }).eq('user_id', session.userId);

  // Then set the new primary wallet
  const { error } = await supabase
    .from('wallets')
    .update({ is_primary: true })
    .eq('id', walletId)
    .eq('user_id', session.userId); // Ensure user owns this wallet

  if (error) {
    console.error('Error setting primary wallet:', error);
    throw error;
  }
}

/**
 * Remove Wallet
 */
export async function removeWalletAction(walletId: string): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const supabase = createClient();

  // Check if this is the primary wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('is_primary, wallet_role')
    .eq('id', walletId)
    .eq('user_id', session.userId)
    .single();

  if (wallet?.is_primary) {
    // Check if there are other wallets
    const { count } = await supabase
      .from('wallets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId);

    if (count && count > 1) {
      throw new Error('Cannot remove primary wallet. Set another wallet as primary first.');
    }
  }

  // Delete the wallet
  const { error } = await supabase
    .from('wallets')
    .delete()
    .eq('id', walletId)
    .eq('user_id', session.userId);

  if (error) {
    console.error('Error removing wallet:', error);
    throw error;
  }
}

/**
 * Link Solana Wallet (for server actions)
 */
export async function linkSolanaWalletAction(
  address: string,
  signature: string,
  message: string
): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const supabase = createClient();

  // Check if wallet already exists
  const { data: existing } = await supabase
    .from('wallets')
    .select('id')
    .eq('user_id', session.userId)
    .eq('chain', 'SOLANA')
    .eq('address', address)
    .single();

  if (existing) {
    throw new Error('Wallet already added');
  }

  // Insert new Solana wallet as SECONDARY
  const { error } = await supabase.from('wallets').insert({
    user_id: session.userId,
    chain: 'SOLANA',
    address,
    is_primary: false,
    wallet_role: 'SECONDARY',
    verified_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Error adding Solana wallet:', error);
    throw error;
  }
}
