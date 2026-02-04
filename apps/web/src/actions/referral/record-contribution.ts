'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * Record a contribution event for referral tracking
 * This should be called whenever a user makes a qualifying action:
 * - Fairlaunch contribution
 * - Presale contribution
 * - Bonding curve swap
 * - Blue Check purchase
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
    const supabase = createClient();
    
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
    // Fee percentages based on source type:
    // PRESALE/FAIRLAUNCH: 5% success fee
    // BONDING: 1.5% swap fee  
    // BLUECHECK: Fixed $10 (amount will be $10 equivalent)
    
    let feePercent: number;
    let treasuryPercent: number;
    let referralPercent: number;
    
    switch (params.sourceType) {
      case 'PRESALE':
      case 'FAIRLAUNCH':
        feePercent = 5; // 5% of contribution
        treasuryPercent = 70; // 70% of fee to treasury
        referralPercent = 30; // 30% of fee to referral pool
        break;
      case 'BONDING':
        feePercent = 1.5; // 1.5% of swap
        treasuryPercent = 50; // 50/50 split
        referralPercent = 50;
        break;
      case 'BLUECHECK':
        feePercent = 100; // Full amount is the fee
        treasuryPercent = 70;
        referralPercent = 30;
        break;
    }
    
    const totalAmount = BigInt(params.amount);
    const feeAmount = (totalAmount * BigInt(feePercent * 100)) / BigInt(10000); // Basis points
    const treasuryAmount = (feeAmount * BigInt(treasuryPercent)) / BigInt(100);
    const referralPoolAmount = (feeAmount * BigInt(referralPercent)) / BigInt(100);
    
    // Insert fee split
    const { error: feeSplitError } = await supabase
      .from('fee_splits')
      .insert({
        source_type: params.sourceType,
        source_id: params.sourceId,
        total_amount: feeAmount.toString(),
        treasury_amount: treasuryAmount.toString(),
        referral_pool_amount: referralPoolAmount.toString(),
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
    const supabase = createClient();
    
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
      .select('amount, asset, created_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: true });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Aggregate stats
    const volumeByAsset: Record<string, bigint> = {};
    
    contributions?.forEach((c) => {
      const amount = BigInt(c.amount || '0');
      if (!volumeByAsset[c.asset]) {
        volumeByAsset[c.asset] = BigInt(0);
      }
      volumeByAsset[c.asset] += amount;
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
