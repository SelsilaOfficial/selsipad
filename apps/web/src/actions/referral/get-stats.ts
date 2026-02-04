'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

export interface ReferralStats {
  // Basic counts
  totalReferrals: number;
  activeReferrals: number;
  pendingReferrals: number;
  
  // Earnings (as strings to handle BigInt)
  totalEarnings: string;
  pendingEarnings: string;
  claimedEarnings: string;
  
  // Breakdown by source
  earningsBySource: {
    FAIRLAUNCH: string;
    PRESALE: string;
    BONDING: string;
    BLUECHECK: string;
  };
  
  // Referred users
  referredUsers: Array<{
    userId: string;
    username: string;
    avatarUrl?: string;
    status: 'PENDING' | 'ACTIVE';
    joinedAt: string;
    activatedAt?: string;
    totalContributions: number;
    contributionAmount: string;
  }>;
}

/**
 * Get comprehensive referral statistics for the current user
 */
export async function getReferralStats(): Promise<{
  success: boolean;
  stats?: ReferralStats;
  error?: string;
}> {
  try {
    const session = await getServerSession();
    
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const supabase = createClient();
    
    // 1. Get all referral relationships (without FK hint to avoid schema cache issue)
    const { data: relationships, error: relError } = await supabase
      .from('referral_relationships')
      .select('id, referee_id, activated_at, created_at')
      .eq('referrer_id', session.userId)
      .order('created_at', { ascending: false });
    
    if (relError) {
      console.error('Error fetching relationships:', relError);
      return { success: false, error: relError.message };
    }
    
    // 2. Get profiles for all referees manually
    const refereeIds = relationships?.map(r => r.referee_id) || [];
    const { data: profiles } = refereeIds.length > 0
      ? await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', refereeIds)
      : { data: [] };
    
    // Create a map for quick profile lookups
    const profileMap = new Map(
      (profiles || []).map(p => [p.user_id, p])
    );

    
    const totalReferrals = relationships?.length || 0;
    const activeReferrals = relationships?.filter(r => r.activated_at).length || 0;
    const pendingReferrals = totalReferrals - activeReferrals;
    
    // 2. Get earnings from referral_ledger (claimed and unclaimed)
    const { data: ledgerEntries } = await supabase
      .from('referral_ledger')
      .select('reward_amount, source, claimed')
      .eq('referrer_id', session.userId);
    
    let totalEarnings = BigInt(0);
    let claimedEarnings = BigInt(0);
    const earningsBySource: Record<string, bigint> = {
      FAIRLAUNCH: BigInt(0),
      PRESALE: BigInt(0),
      BONDING: BigInt(0),
      BLUECHECK: BigInt(0),
    };
    
    ledgerEntries?.forEach(entry => {
      const amount = BigInt(entry.reward_amount || '0');
      totalEarnings += amount;
      
      if (entry.claimed) {
        claimedEarnings += amount;
      }
      
      if (entry.source in earningsBySource) {
        earningsBySource[entry.source] += amount;
      }
    });
    
    // 3. Get pending earnings from fee_splits (not yet processed)
    const { data: feeSplits } = await supabase
      .from('fee_splits')
      .select('referral_pool_amount')
      .eq('processed', false);
    
    let pendingEarnings = BigInt(0);
    feeSplits?.forEach(split => {
      // Only count splits related to this user's referrals
      // For now, we'll use a simplified calculation
      // In Phase 4, the worker will process these and create ledger entries
      const amount = BigInt(split.referral_pool_amount || '0');
      pendingEarnings += amount;
    });
    
    // 4. Get contribution stats for each referred user
    const referredUsers = await Promise.all(
      (relationships || []).map(async (rel: any) => {
        // Get contribution count and total for this user
        const { data: contributions } = await supabase
          .from('contributions')
          .select('amount')
          .eq('user_id', rel.referee_id);
        
        const totalContributions = contributions?.length || 0;
        let contributionAmount = BigInt(0);
        
        contributions?.forEach(c => {
          contributionAmount += BigInt(c.amount || '0');
        });
        
        const profile = profileMap.get(rel.referee_id);
        
        return {
          userId: rel.referee_id,
          username: profile?.username || `user_${rel.referee_id.substring(0, 6)}`,
          avatarUrl: profile?.avatar_url,
          status: rel.activated_at ? 'ACTIVE' : 'PENDING' as const,
          joinedAt: rel.created_at,
          activatedAt: rel.activated_at,
          totalContributions,
          contributionAmount: contributionAmount.toString(),
        };
      })
    );
    
    return {
      success: true,
      stats: {
        totalReferrals,
        activeReferrals,
        pendingReferrals,
        totalEarnings: totalEarnings.toString(),
        pendingEarnings: pendingEarnings.toString(),
        claimedEarnings: claimedEarnings.toString(),
        earningsBySource: {
          FAIRLAUNCH: earningsBySource.FAIRLAUNCH.toString(),
          PRESALE: earningsBySource.PRESALE.toString(),
          BONDING: earningsBySource.BONDING.toString(),
          BLUECHECK: earningsBySource.BLUECHECK.toString(),
        },
        referredUsers,
      },
    };
  } catch (error: any) {
    console.error('getReferralStats error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch referral stats',
    };
  }
}
