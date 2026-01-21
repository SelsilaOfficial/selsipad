/**
 * Multi-Chain Statistics Data Layer
 * Aggregates contributions and rewards by blockchain
 */

import { createClient } from '@/lib/supabase/server';
import { getNativeToken } from '@/lib/utils/chain';
import type { ChainStats, RewardStats, UserStatsMultiChain } from '@/types/multi-chain';

/**
 * Get user statistics aggregated by chain
 * Returns contributions and rewards separated by blockchain
 */
export async function getUserStatsMultiChain(userId: string): Promise<UserStatsMultiChain> {
  const supabase = createClient();

  try {
    // Get contributions grouped by chain
    const { data: contributionsData, error: contributionsError } = await supabase
      .from('contributions')
      .select('chain, amount')
      .eq('user_id', userId);

    if (contributionsError) {
      console.error('Error fetching contributions:', contributionsError);
    }

    // Aggregate contributions by chain
    const contributionsByChain = (contributionsData || []).reduce((acc, contrib) => {
      const chain = contrib.chain || 'BSC'; // Default to BSC for backward compat
      const existing = acc.find((c) => c.chain === chain);

      if (existing) {
        existing.totalContributed += parseFloat(contrib.amount || '0');
      } else {
        acc.push({
          chain,
          totalContributed: parseFloat(contrib.amount || '0'),
          nativeToken: getNativeToken(chain),
        });
      }

      return acc;
    }, [] as ChainStats[]);

    // Get rewards grouped by chain
    const { data: rewardsData, error: rewardsError } = await supabase
      .from('referral_ledger')
      .select('chain, amount, token')
      .eq('referrer_id', userId)
      .eq('status', 'PENDING'); // Only unclaimed rewards

    if (rewardsError) {
      console.error('Error fetching rewards:', rewardsError);
    }

    // Aggregate rewards by chain and token
    const rewardsByChain = (rewardsData || []).reduce((acc, reward) => {
      const chain = reward.chain || 'BSC';
      const token = reward.reward_token || 'USDT';
      const key = `${chain}-${token}`;

      const existing = acc.find((r) => r.chain === chain && r.token === token);

      if (existing) {
        existing.amount += parseFloat(reward.reward_amount || '0');
      } else {
        acc.push({
          chain,
          amount: parseFloat(reward.reward_amount || '0'),
          token,
        });
      }

      return acc;
    }, [] as RewardStats[]);
    */

    const rewardsByChain: RewardStats[] = []; // Empty until referral_ledger exists

    return {
      contributions: contributionsByChain,
      rewards: rewardsByChain,
      totalContributedUSD: 0, // TODO: Calculate with price oracle
      totalRewardsUSD: 0, // TODO: Calculate with price oracle
    };
  } catch (error) {
    console.error('Error fetching multi-chain stats:', error);
    return {
      contributions: [],
      rewards: [],
      totalContributedUSD: 0,
      totalRewardsUSD: 0,
    };
  }
}

/**
 * Get total contributions for a specific chain
 */
export async function getUserContributionsByChain(userId: string, chain: string): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('contributions')
    .select('amount')
    .eq('user_id', userId)
    .eq('chain', chain);

  if (error) {
    console.error('Error fetching contributions by chain:', error);
    return 0;
  }

  return (data || []).reduce((total, contrib) => {
    return total + parseFloat(contrib.amount || '0');
  }, 0);
}

/**
 * Get claimable rewards for a specific chain
 */
export async function getUserRewardsByChain(userId: string, chain: string): Promise<RewardStats[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('referral_ledger')
    .select('reward_amount, reward_token, chain')
    .eq('referrer_id', userId)
    .eq('chain', chain);
  // TODO: Add .eq('claimed', false) when column exists

  if (error) {
    console.error('Error fetching rewards by chain:', error);
    return [];
  }

  // Group by token
  const rewardsByToken = (data || []).reduce((acc, reward) => {
    const token = reward.reward_token || 'USDT';
    const existing = acc.find((r) => r.token === token);

    if (existing) {
      existing.amount += parseFloat(reward.reward_amount || '0');
    } else {
      acc.push({
        chain: reward.chain || chain,
        amount: parseFloat(reward.reward_amount || '0'),
        token,
      });
    }

    return acc;
  }, [] as RewardStats[]);

  return rewardsByToken;
}
