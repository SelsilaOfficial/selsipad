// Data layer for User Profile and Wallets - REAL API INTEGRATION
// Replaces stub data with Supabase queries

import { createClient } from '@/lib/supabase/client';
import { getServerSession } from '@/lib/auth/session';

export interface Wallet {
  id: string;
  address: string;
  network: 'SOL' | 'EVM';
  is_primary: boolean;
  label?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  bluecheck_status: 'active' | 'pending' | 'rejected' | 'none';
  bluecheck_expires_at?: string;
  kyc_status: 'verified' | 'pending' | 'rejected' | 'not_started';
  kyc_submitted_at?: string;
  total_contributions: number;
  total_claimed: number;
  follower_count: number;
  following_count: number;
  wallets: Wallet[];
}

/**
 * Get User Profile
 *
 * Fetches authenticated user's profile with wallets and stats
 * WALLET ISOLATION: Only returns data for the current connected wallet
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const session = await getServerSession();

    if (!session) {
      console.warn('User not authenticated');
      return null;
    }

    const supabase = createClient();

    // Fetch profile (shared across all wallets for same user)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      // Return null if profile not found
      return null;
    }

    // WALLET ISOLATION: Only fetch current wallet
    const { data: currentWallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', session.walletId)
      .single();

    const wallets = currentWallet ? [currentWallet] : [];

    // WALLET ISOLATION: Calculate stats based on current wallet only
    const stats = await getUserStats(session.userId, session.walletId);

    // Map to frontend format
    return {
      id: profile.user_id, // Use user_id for ownership checks (matches post.author.id)
      username: profile.username || profile.nickname, // Try username first, fallback to nickname
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      bluecheck_status: mapBlueCheckStatus(profile.bluecheck_status),
      bluecheck_expires_at: undefined, // TODO: Add to DB schema
      kyc_status: mapKYCStatus(profile.kyc_status),
      kyc_submitted_at: profile.kyc_submitted_at,
      total_contributions: stats.totalContributions,
      total_claimed: stats.totalClaimed,
      follower_count: profile.follower_count || 0,
      following_count: profile.following_count || 0,
      wallets: wallets.map((w) => ({
        id: w.id,
        address: w.address,
        network: mapChainToNetwork(w.chain),
        is_primary: w.is_primary,
        label: undefined,
        created_at: w.created_at,
      })),
    };
  } catch (err) {
    console.error('Unexpected error in getUserProfile:', err);
    return null; // Return null instead of re-throwing
  }
}

// Helper function for KYC status mapping
function mapKYCStatus(
  dbStatus: string | null
): 'verified' | 'pending' | 'rejected' | 'not_started' {
  switch (dbStatus) {
    case 'verified':
      return 'verified';
    case 'pending':
      return 'pending';
    case 'rejected':
      return 'rejected';
    case 'not_started':
    default:
      return 'not_started';
  }
}

/**
 * Get User Wallets
 *
 * Fetches all wallets for authenticated user
 */
export async function getUserWallets(): Promise<Wallet[]> {
  try {
    const session = await getServerSession();

    if (!session) {
      console.warn('User not authenticated');
      return [];
    }

    const supabase = createClient();

    // Fetch wallets
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wallets:', error);
      return [];
    }

    // Map to frontend format
    return (data || []).map((wallet) => ({
      id: wallet.id,
      address: wallet.address,
      network: mapChainToNetwork(wallet.chain),
      is_primary: wallet.is_primary,
      label: undefined, // TODO: Add label to wallets table
      created_at: wallet.created_at,
    }));
  } catch (err) {
    console.error('Unexpected error in getUserWallets:', err);
    return [];
  }
}

/**
 * Set Primary Wallet
 *
 * Updates a wallet to be the user's primary wallet
 */
export async function setPrimaryWallet(walletId: string): Promise<void> {
  const supabase = createClient();

  try {
    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // First, unset all primary wallets for this user
    await supabase.from('wallets').update({ is_primary: false }).eq('user_id', user.id);

    // Then set the new primary wallet
    const { error } = await supabase
      .from('wallets')
      .update({ is_primary: true })
      .eq('id', walletId)
      .eq('user_id', user.id); // Ensure user owns this wallet

    if (error) {
      console.error('Error setting primary wallet:', error);
      throw error;
    }
  } catch (err) {
    console.error('Unexpected error in setPrimaryWallet:', err);
    throw err;
  }
}

/**
 * Remove Wallet
 *
 * Deletes a wallet from the user's account
 * Cannot remove primary wallet if there are other wallets
 */
export async function removeWallet(walletId: string): Promise<void> {
  const supabase = createClient();

  try {
    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // Check if this is the primary wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('is_primary')
      .eq('id', walletId)
      .eq('user_id', user.id)
      .single();

    if (wallet?.is_primary) {
      // Check if there are other wallets
      const { count } = await supabase
        .from('wallets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (count && count > 1) {
        throw new Error('Cannot remove primary wallet. Set another wallet as primary first.');
      }
    }

    // Delete the wallet
    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('id', walletId)
      .eq('user_id', user.id); // Ensure user owns this wallet

    if (error) {
      console.error('Error removing wallet:', error);
      throw error;
    }
  } catch (err) {
    console.error('Unexpected error in removeWallet:', err);
    throw err;
  }
}

/**
 * Add Wallet
 *
 * Adds a new wallet to the user's account
 * TODO: Implement signature verification for security
 *
 * Flow for signature verification:
 * 1. Generate nonce and save to wallet_link_nonces
 * 2. Client signs message with nonce
 * 3. Verify signature matches address
 * 4. Insert wallet if verified
 */
export async function addWallet(
  address: string,
  network: 'SOL' | 'EVM',
  signature?: string
): Promise<Wallet> {
  const supabase = createClient();

  try {
    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // TODO: Verify signature before adding wallet
    // For now, we'll add without verification (unsafe!)

    const chain = mapNetworkToChain(network);

    // Check if wallet already exists
    const { data: existing } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', user.id)
      .eq('chain', chain)
      .eq('address', address)
      .single();

    if (existing) {
      throw new Error('Wallet already added');
    }

    // Check if user has any wallets (first wallet becomes primary)
    const { count } = await supabase
      .from('wallets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const isPrimary = count === 0;

    // Insert new wallet
    const { data: newWallet, error } = await supabase
      .from('wallets')
      .insert({
        user_id: user.id,
        chain,
        address,
        is_primary: isPrimary,
        verified_at: new Date().toISOString(), // TODO: Only set after signature verification
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding wallet:', error);
      throw error;
    }

    return {
      id: newWallet.id,
      address: newWallet.address,
      network,
      is_primary: newWallet.is_primary,
      created_at: newWallet.created_at,
    };
  } catch (err) {
    console.error('Unexpected error in addWallet:', err);
    throw err;
  }
}

// Helper functions

function mapBlueCheckStatus(dbStatus: string): 'active' | 'pending' | 'rejected' | 'none' {
  switch (dbStatus) {
    case 'ACTIVE':
    case 'VERIFIED':
      return 'active';
    case 'PENDING':
      return 'pending';
    case 'REVOKED':
      return 'rejected';
    case 'NONE':
    default:
      return 'none';
  }
}

function mapChainToNetwork(chain: string): 'SOL' | 'EVM' {
  if (chain === 'SOLANA') return 'SOL';
  return 'EVM'; // EVM_1, EVM_56, etc.
}

function mapNetworkToChain(network: 'SOL' | 'EVM'): string {
  if (network === 'SOL') return 'SOLANA';
  return 'EVM_56'; // Default to BSC, could be made configurable
}

async function getUserStats(
  userId: string,
  walletId?: string
): Promise<{
  totalContributions: number;
  totalClaimed: number;
}> {
  const supabase = createClient();

  try {
    // WALLET ISOLATION: Get current wallet address if walletId provided
    let walletAddress: string | undefined;
    if (walletId) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('address')
        .eq('id', walletId)
        .single();
      walletAddress = wallet?.address;
    }

    // Get total contributions from transactions
    // WALLET ISOLATION: Filter by wallet_address if provided
    const transactionsQuery = supabase
      .from('transactions')
      .select('metadata')
      .eq('user_id', userId)
      .eq('type', 'CONTRIBUTE')
      .eq('status', 'CONFIRMED');

    if (walletAddress) {
      transactionsQuery.eq('wallet_address', walletAddress);
    }

    const { data: transactions } = await transactionsQuery;

    const totalContributions = (transactions || []).reduce((sum, tx) => {
      const amount = tx.metadata?.amount || 0;
      return sum + amount;
    }, 0);

    // Get total claimed from vesting_claims
    // WALLET ISOLATION: Filter by wallet_address if provided
    const claimsQuery = supabase
      .from('vesting_claims')
      .select('claim_amount')
      .eq('user_id', userId)
      .eq('status', 'CONFIRMED');

    if (walletAddress) {
      claimsQuery.eq('wallet_address', walletAddress);
    }

    const { data: claims } = await claimsQuery;

    const totalClaimed = (claims || []).reduce((sum, claim) => {
      return sum + parseFloat(claim.claim_amount || '0');
    }, 0);

    return {
      totalContributions,
      totalClaimed,
    };
  } catch (err) {
    console.error('Error calculating user stats:', err);
    return {
      totalContributions: 0,
      totalClaimed: 0,
    };
  }
}

function createDefaultProfile(userId: string, email?: string): UserProfile {
  return {
    id: userId,
    username: email?.split('@')[0],
    bluecheck_status: 'none',
    kyc_status: 'not_started',
    total_contributions: 0,
    total_claimed: 0,
    follower_count: 0,
    following_count: 0,
    wallets: [],
  };
}

/**
 * Get User Active Badges
 * Returns list of active badges for a user
 */
export async function getUserActiveBadges(userId: string) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('badge_instances')
      .select(
        `
        badge_id,
        status,
        awarded_at,
        badge_definitions:badge_id (
          badge_key,
          name,
          description,
          icon_url,
          badge_type
        )
      `
      )
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .order('awarded_at', { ascending: false });

    if (error) {
      console.error('Error fetching user badges:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error in getUserActiveBadges:', err);
    return [];
  }
}
