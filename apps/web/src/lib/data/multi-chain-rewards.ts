/**
 * Multi-Chain Rewards Data Layer
 * Fetch and group rewards by blockchain
 */

import { createClient } from '@/lib/supabase/server';
import type { RewardStats } from '@/types/multi-chain';
import { formatChainName } from '@/lib/utils/chain';

export interface RewardDetail {
  id: string;
  chain: string;
  amount: number;
  token: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
  usdEstimate?: number;
}

export interface ChainRewards {
  chain: string;
  chainName: string;
  rewards: RewardDetail[];
  totalAmount: number;
  totalUSD: number;
}

/**
 * Get rewards grouped by chain for display
 */
export async function getRewardsByChain(userId: string): Promise<ChainRewards[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('referral_ledger')
    .select('id, chain, amount, asset, source_type, source_id, created_at')
    .eq('referrer_id', userId)
    .in('status', ['PENDING', 'CLAIMABLE'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching rewards:', error);
    return [];
  }

  // Group by chain
  const rewardsByChain: Record<string, RewardDetail[]> = {};

  (data || []).forEach((reward) => {
    const chain = reward.chain || 'BSC';
    if (!rewardsByChain[chain]) {
      rewardsByChain[chain] = [];
    }

    rewardsByChain[chain].push({
      id: reward.id,
      chain,
      amount: parseFloat(reward.amount || '0'),
      token: reward.asset || 'USDT',
      sourceType: reward.source_type,
      sourceId: reward.source_id,
      createdAt: reward.created_at,
    });
  });

  // Convert to array format
  return Object.entries(rewardsByChain).map(([chain, rewards]) => {
    const totalAmount = rewards.reduce((sum, r) => sum + r.amount, 0);

    return {
      chain,
      chainName: formatChainName(chain),
      rewards,
      totalAmount,
      totalUSD: 0, // Will be calculated with price oracle
    };
  });
}

/**
 * Get source type display name
 */
export function getSourceTypeName(sourceType: string): string {
  const mapping: Record<string, string> = {
    PRESALE: 'Presale Referral',
    FAIRLAUNCH: 'Fairlaunch Referral',
    BONDING: 'Bonding Curve Referral',
    BLUECHECK: 'Blue Check Subscription',
  };
  return mapping[sourceType] || sourceType;
}
