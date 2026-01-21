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
      console.error('[Multi-Chain Stats] Error fetching contributions:', contributionsError);
    }

    console.log('[Multi-Chain Stats] Fetched contributions:', {
      userId,
      count: contributionsData?.length || 0,
      data: contributionsData,
    });

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
      .select('chain, amount, asset')
      .eq('referrer_id', userId)
      .in('status', ['PENDING', 'CLAIMABLE']); // Only unclaimed rewards

    if (rewardsError) {
      console.error('Error fetching rewards:', rewardsError);
    }

    // Aggregate rewards by chain and asset (token)
    const rewardsByChain = (rewardsData || []).reduce((acc, reward) => {
      const chain = reward.chain || 'BSC';
      const token = reward.asset || 'USDT';

      const existing = acc.find((r) => r.chain === chain && r.token === token);

      if (existing) {
        existing.amount += parseFloat(reward.amount || '0');
      } else {
        acc.push({
          chain,
          amount: parseFloat(reward.amount || '0'),
          token,
        });
      }

      return acc;
    }, [] as RewardStats[]);

    // Calculate USD estimates using price oracle
    let totalContributedUSD = 0;
    let totalRewardsUSD = 0;

    // Get all unique tokens for batch price fetch
    const contributionTokens = contributionsByChain.map((c) => c.nativeToken);
    const rewardTokens = rewardsByChain.map((r) => r.token);
    const allTokens = [...new Set([...contributionTokens, ...rewardTokens])];

    try {
      // Dynamically import price oracle (server-side only)
      const { getMultipleTokenPrices } = await import('@/lib/services/price-oracle');
      const prices = await getMultipleTokenPrices(allTokens);

      // Add USD estimates to contributions
      contributionsByChain.forEach((contrib) => {
        const price = prices[contrib.nativeToken] || 0;
        contrib.usdEstimate = contrib.totalContributed * price;
        totalContributedUSD += contrib.usdEstimate;
      });

      // Add USD estimates to rewards
      rewardsByChain.forEach((reward) => {
        const price = prices[reward.token] || 0;
        reward.usdEstimate = reward.amount * price;
        totalRewardsUSD += reward.usdEstimate;
      });
    } catch (error) {
      console.error('Error calculating USD estimates:', error);
      // Continue without USD estimates
    }

    return {
      contributions: contributionsByChain,
      rewards: rewardsByChain,
      totalContributedUSD,
      totalRewardsUSD,
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
