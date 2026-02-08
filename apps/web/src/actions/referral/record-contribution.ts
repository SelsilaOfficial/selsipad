'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';

/**
 * Record a contribution event for referral tracking
 * Fee distribution per Modul 15:
 *   Presale/Fairlaunch: 5% fee → 50% Treasury, 40% Referral, 10% SBT Staking
 *   Bonding: 1.5% fee → 50% Treasury, 50% Referral
 *   BlueCheck: $10 fee → 70% Treasury, 30% Referral
 */
export async function recordContribution(params: {
  userId: string;
  sourceType: 'PRESALE' | 'FAIRLAUNCH' | 'BONDING' | 'BLUECHECK';
  sourceId: string;
  amount: string; // bigint as string
  asset: string; // token address
  chain: string;
  txHash: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceRoleClient();

    // 1. Check if referee has a referrer
    const { data: relationship } = await supabase
      .from('referral_relationships')
      .select('id, referrer_id, activated_at')
      .eq('referee_id', params.userId)
      .single();

    // 2. If this is their first contribution, activate the referral relationship
    if (relationship && !relationship.activated_at) {
      await supabase
        .from('referral_relationships')
        .update({ activated_at: new Date().toISOString() })
        .eq('id', relationship.id);

      // Increment referrer's active_referral_count
      await supabase.rpc('increment_active_referral_count', {
        user_id: relationship.referrer_id,
      });
    }

    // 3. Create fee split record (will be processed by worker)
    // Fee percentages per Modul 15:
    let feePercent: number;
    let treasuryPercent: number;
    let referralPercent: number;
    let stakingPercent: number;

    switch (params.sourceType) {
      case 'PRESALE':
      case 'FAIRLAUNCH':
        feePercent = 5; // 5% of contribution
        treasuryPercent = 50; // 50% of fee → 2.5% total
        referralPercent = 40; // 40% of fee → 2% total
        stakingPercent = 10; // 10% of fee → 0.5% total
        break;
      case 'BONDING':
        feePercent = 1.5; // 1.5% of swap
        treasuryPercent = 50; // 50/50 split
        referralPercent = 50;
        stakingPercent = 0;
        break;
      case 'BLUECHECK':
        feePercent = 100; // Full amount is the fee ($10)
        treasuryPercent = 70; // 70/30 split
        referralPercent = 30;
        stakingPercent = 0;
        break;
    }

    const totalAmount = BigInt(params.amount);
    const feeAmount = (totalAmount * BigInt(Math.round(feePercent * 100))) / BigInt(10000);
    const treasuryAmount = (feeAmount * BigInt(treasuryPercent)) / BigInt(100);
    const referralPoolAmount = (feeAmount * BigInt(referralPercent)) / BigInt(100);
    const stakingPoolAmount = (feeAmount * BigInt(stakingPercent)) / BigInt(100);

    // Insert fee split
    const { error: feeSplitError } = await supabase.from('fee_splits').insert({
      source_type: params.sourceType,
      source_id: params.sourceId,
      total_amount: feeAmount.toString(),
      treasury_amount: treasuryAmount.toString(),
      referral_pool_amount: referralPoolAmount.toString(),
      staking_pool_amount: stakingPoolAmount.toString(),
      asset: params.asset,
      chain: params.chain,
      processed: false,
    });

    if (feeSplitError) {
      // If duplicate, ignore (already recorded)
      if (!feeSplitError.message.includes('duplicate')) {
        console.error('Fee split error:', feeSplitError);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('recordContribution error:', error);
    return {
      success: false,
      error: error.message || 'Failed to record contribution',
    };
  }
}

/**
 * Get contribution stats for a user
 */
export async function getUserContributionStats(userId?: string): Promise<{
  success: boolean;
  stats?: {
    totalContributions: number;
    totalVolume: Record<string, bigint>; // By asset
    firstContribution?: Date;
  };
  error?: string;
}> {
  try {
    const supabase = createServiceRoleClient();

    let targetUserId = userId;
    if (!targetUserId) {
      const session = await getServerSession();
      targetUserId = session?.userId;
    }

    if (!targetUserId) {
      return { success: false, error: 'User not found' };
    }

    // Get all contributions for user
    const { data: contributions, error } = await supabase
      .from('contributions')
      .select('amount, asset, chain, created_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    // Aggregate stats
    const volumeByAsset: Record<string, bigint> = {};

    contributions?.forEach((c) => {
      const amount = BigInt(c.amount || '0');
      const assetKey = c.asset || c.chain || 'UNKNOWN';
      if (!volumeByAsset[assetKey]) {
        volumeByAsset[assetKey] = BigInt(0);
      }
      volumeByAsset[assetKey] += amount;
    });

    return {
      success: true,
      stats: {
        totalContributions: contributions?.length || 0,
        totalVolume: volumeByAsset,
        firstContribution: contributions?.[0]?.created_at
          ? new Date(contributions[0].created_at)
          : undefined,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
