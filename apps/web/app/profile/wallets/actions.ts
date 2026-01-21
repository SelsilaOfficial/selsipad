import { getServerSession } from '@/lib/auth/session';
'use server';

import { createClient } from '@/lib/supabase/server';

export interface Wallet {
  id: string;
  user_id: string;
  address: string;
  network: 'SOL' | 'EVM';
  is_primary: boolean;
  label?: string;
  added_at: string;
}

/**
 * Set Primary Wallet
 */
export async function setPrimaryWalletAction(walletId: string): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  const supabase = createClient();

  // Verify wallet ownership
  const { data: wallet } = await supabase
    .from('wallets')
    .select('user_id')
    .eq('id', walletId)
    .single();

  if (!wallet || wallet.user_id !== session.userId) {
    throw new Error('Wallet not found or access denied');
  }

  // Update all wallets for this user
  await supabase.from('wallets').update({ is_primary: false }).eq('user_id', session.userId);

  // Set new primary
  const { error } = await supabase.from('wallets').update({ is_primary: true }).eq('id', walletId);

  if (error) throw error;
}

/**
 * Remove Wallet
 */
export async function removeWalletAction(walletId: string): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  const supabase = createClient();

  // Verify wallet ownership and not primary
  const { data: wallet } = await supabase
    .from('wallets')
    .select('user_id, is_primary')
    .eq('id', walletId)
    .single();

  if (!wallet || wallet.user_id !== session.userId) {
    throw new Error('Wallet not found or access denied');
  }

  if (wallet.is_primary) {
    throw new Error('Cannot remove primary wallet');
  }

  const { error } = await supabase.from('wallets').delete().eq('id', walletId);

  if (error) throw error;
}

/**
 * Add Wallet
 */
export async function addWalletAction(address: string, network: 'SOL' | 'EVM'): Promise<Wallet> {
  const session = await getServerSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  const supabase = createClient();

  // Check if wallet already exists
  const { data: existing } = await supabase
    .from('wallets')
    .select('id')
    .eq('address', address)
    .single();

  if (existing) {
    throw new Error('Wallet already registered');
  }

  // Check user wallet count
  const { count } = await supabase
    .from('wallets')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.userId);

  const is_primary = (count || 0) === 0; // First wallet is primary

  const { data: newWallet, error } = await supabase
    .from('wallets')
    .insert({
      user_id: session.userId,
      address,
      network,
      is_primary,
    })
    .select()
    .single();

  if (error) throw error;

  return newWallet;
}
