// Data layer for Rewards and Referrals - REAL API INTEGRATION
// Connects to /api/v1/referral/* endpoints which use server-side auth

/** Base URL for API calls - required on server (prerender/build) where relative URLs fail */
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

export interface Reward {
  id: string;
  type: 'referral' | 'contribution' | 'social' | 'milestone';
  amount: number;
  currency: string;
  description: string;
  claimed: boolean;
  created_at: string;
  chain: string;
  asset: string;
  source_type: string;
}

export interface ReferralStats {
  total_referrals: number;
  active_referrals: number;
  total_earnings: number;
  pending_rewards: number;
  referral_code: string;
  earnings_by_source: {
    FAIRLAUNCH: number;
    PRESALE: number;
    BONDING: number;
    BLUECHECK: number;
  };
}

/**
 * Get Rewards
 *
 * Fetches rewards from referral_ledger via API
 * Optionally filter by claimed status
 */
export async function getRewards(claimedFilter?: boolean): Promise<Reward[]> {
  try {
    const status =
      claimedFilter === true ? 'CLAIMED' : claimedFilter === false ? 'CLAIMABLE' : undefined;
    const path = status
      ? `/api/v1/referral/rewards?status=${status}`
      : `/api/v1/referral/rewards`;
    const url = `${getApiBaseUrl()}${path}`;

    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      console.error('Failed to fetch rewards:', response.status);
      return [];
    }

    const data = await response.json();
    const rewards = data.rewards || [];

    return rewards.map((entry: any) => ({
      id: entry.id,
      type: 'referral' as const,
      amount: parseFloat(entry.amount || '0') / 1e18, // Convert from wei to ether
      currency: getCurrencyLabel(entry.chain, entry.asset),
      description: `Referral reward from ${entry.source_type}`,
      claimed: entry.status === 'CLAIMED',
      created_at: entry.created_at,
      chain: entry.chain,
      asset: entry.asset,
      source_type: entry.source_type,
    }));
  } catch (err) {
    console.error('Unexpected error in getRewards:', err);
    return [];
  }
}

/**
 * Get Claimable Rewards
 *
 * Fetches unclaimed rewards from referral_ledger
 */
export async function getClaimableRewards(): Promise<Reward[]> {
  return getRewards(false);
}

/**
 * Get Referral Stats
 *
 * Fetches real referral statistics via server action API
 */
export async function getReferralStats(): Promise<ReferralStats> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/referral/stats`, {
      credentials: 'include',
    });
    if (!response.ok) {
      console.warn('Failed to fetch referral stats:', response.status);
      return getDefaultReferralStats();
    }

    const data = await response.json();
    if (!data.success || !data.stats) {
      return getDefaultReferralStats();
    }

    const stats = data.stats;
    return {
      total_referrals: stats.totalReferrals || 0,
      active_referrals: stats.activeReferrals || 0,
      total_earnings: parseFloat(stats.totalEarnings || '0') / 1e18,
      pending_rewards: parseFloat(stats.pendingEarnings || '0') / 1e18,
      referral_code: stats.referralCode || '',
      earnings_by_source: {
        FAIRLAUNCH: parseFloat(stats.earningsBySource?.FAIRLAUNCH || '0') / 1e18,
        PRESALE: parseFloat(stats.earningsBySource?.PRESALE || '0') / 1e18,
        BONDING: parseFloat(stats.earningsBySource?.BONDING || '0') / 1e18,
        BLUECHECK: parseFloat(stats.earningsBySource?.BLUECHECK || '0') / 1e18,
      },
    };
  } catch (err) {
    console.error('Unexpected error in getReferralStats:', err);
    return getDefaultReferralStats();
  }
}

/**
 * Claim Reward
 *
 * Claims a specific reward via the claim API endpoint
 */
export async function claimReward(rewardId: string): Promise<void> {
  try {
    // First get the reward details to know chain/asset
    const rewards = await getClaimableRewards();
    const reward = rewards.find((r) => r.id === rewardId);

    if (!reward) {
      throw new Error('Reward not found');
    }

    const response = await fetch(`${getApiBaseUrl()}/api/v1/referral/claim`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `claim-${rewardId}-${Date.now()}`,
      },
      body: JSON.stringify({
        chain: reward.chain,
        asset: reward.asset,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to claim reward');
    }
  } catch (err) {
    console.error('Unexpected error in claimReward:', err);
    throw err;
  }
}

/**
 * Claim All Rewards
 *
 * Claims all unclaimed rewards grouped by chain/asset
 */
export async function claimAllRewards(): Promise<void> {
  try {
    const rewards = await getClaimableRewards();
    if (rewards.length === 0) return;

    // Group rewards by chain+asset for batch claiming
    const groups = new Map<string, { chain: string; asset: string }>();
    rewards.forEach((r) => {
      const key = `${r.chain}-${r.asset}`;
      if (!groups.has(key)) {
        groups.set(key, { chain: r.chain, asset: r.asset });
      }
    });

    // Claim each group
    const errors: string[] = [];
    for (const [, group] of groups) {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/referral/claim`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `claim-all-${group.chain}-${group.asset}-${Date.now()}`,
          },
          body: JSON.stringify({
            chain: group.chain,
            asset: group.asset,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          errors.push(errorData.error || `Failed for ${group.chain}/${group.asset}`);
        }
      } catch (e: any) {
        errors.push(e.message);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Some claims failed: ${errors.join(', ')}`);
    }
  } catch (err) {
    console.error('Unexpected error in claimAllRewards:', err);
    throw err;
  }
}

// Helper functions

function getDefaultReferralStats(): ReferralStats {
  return {
    total_referrals: 0,
    active_referrals: 0,
    total_earnings: 0,
    pending_rewards: 0,
    referral_code: '',
    earnings_by_source: {
      FAIRLAUNCH: 0,
      PRESALE: 0,
      BONDING: 0,
      BLUECHECK: 0,
    },
  };
}

/**
 * Get human-readable currency label from chain ID and asset
 */
function getCurrencyLabel(chain: string, asset: string): string {
  if (asset && asset !== 'NATIVE' && asset !== '0x0000000000000000000000000000000000000000') {
    return asset; // Return token symbol/address
  }

  // Native currency by chain ID
  switch (chain) {
    case '56':
    case '97':
      return 'BNB';
    case '1':
    case '11155111':
      return 'ETH';
    case '8453':
    case '84532':
      return 'ETH';
    case '137':
      return 'MATIC';
    default:
      return 'BNB'; // Default for BSC
  }
}

export interface ClaimRequirements {
  canClaim: boolean;
  blockedReason: string | null;
  requirements: {
    blueCheck: {
      met: boolean;
      status: string;
    };
    activeReferrals: {
      met: boolean;
      count: number;
      required: number;
    };
  };
}

/**
 * Get Claim Requirements
 *
 * Check if user meets referral claim requirements
 */
export async function getClaimRequirements(): Promise<ClaimRequirements | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/referral/claim-requirements`, {
      credentials: 'include',
    });
    if (!response.ok) {
      console.error('Failed to fetch claim requirements');
      return null;
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching claim requirements:', error);
    return null;
  }
}
