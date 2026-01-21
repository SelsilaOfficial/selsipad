/**
 * Contribution Recording with Chain Tracking
 * Records presale/fairlaunch contributions with blockchain info
 */

import { createClient } from '@/lib/supabase/server';

interface ContributionData {
  roundId: string;
  userId: string;
  walletAddress: string;
  amount: number;
  chain: string; // BSC, ETHEREUM, POLYGON, etc.
  txHash: string;
  status?: 'PENDING' | 'CONFIRMED' | 'FAILED';
}

/**
 * Record a contribution to database with chain info
 * Called after on-chain transaction is submitted
 */
export async function recordContribution(data: ContributionData): Promise<string> {
  const supabase = createClient();

  const { data: contribution, error } = await supabase
    .from('contributions')
    .insert({
      round_id: data.roundId,
      user_id: data.userId,
      wallet_address: data.walletAddress,
      amount: data.amount,
      chain: data.chain,
      tx_hash: data.txHash,
      status: data.status || 'PENDING',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error recording contribution:', error);
    throw new Error('Failed to record contribution');
  }

  return contribution.id;
}

/**
 * Update contribution status after confirmation
 */
export async function updateContributionStatus(
  contributionId: string,
  status: 'CONFIRMED' | 'FAILED'
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('contributions')
    .update({
      status,
      confirmed_at: status === 'CONFIRMED' ? new Date().toISOString() : null,
    })
    .eq('id', contributionId);

  if (error) {
    console.error('Error updating contribution status:', error);
    throw new Error('Failed to update contribution status');
  }
}

/**
 * Create referral reward with chain inheritance
 * Reward chain = Contribution chain
 */
export async function createReferralReward(
  contributionId: string,
  referrerId: string,
  refereeId: string,
  rewardAmount: number,
  chain: string,
  sourceType: 'PRESALE' | 'FAIRLAUNCH' | 'BONDING'
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from('referral_ledger').insert({
    referrer_id: referrerId,
    source_type: sourceType,
    source_id: contributionId,
    amount: rewardAmount,
    asset: 'USDT', // Default reward token
    chain, // IMPORTANT: Same chain as contribution
    status: 'CLAIMABLE',
  });

  if (error) {
    console.error('Error creating referral reward:', error);
    throw new Error('Failed to create referral reward');
  }
}

/**
 * Get chain from round/project
 * Used to determine contribution chain
 */
export async function getChainFromRound(roundId: string): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('launch_rounds')
    .select('chain')
    .eq('id', roundId)
    .single();

  if (error || !data) {
    console.error('Error fetching round chain:', error);
    return 'BSC'; // Default fallback
  }

  return data.chain;
}
