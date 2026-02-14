'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';

interface ClaimResult {
  success: boolean;
  claimedAmount?: string;
  currency?: string;
  error?: string;
}

/**
 * Claim pending referral rewards for a specific chain
 *
 * Requirements (both must be met):
 * 1. User must have an ACTIVE Blue Check badge
 * 2. User must have at minimum 1 active referral
 *
 * Claim is paid in native coin (BNB for EVM, SOL for Solana)
 */
export async function claimRewards(chain: 'evm' | 'solana'): Promise<ClaimResult> {
  try {
    const session = await getServerSession();

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createServiceRoleClient();

    // 1. Validate Blue Check badge is ACTIVE
    const { data: blueCheck } = await supabase
      .from('blue_check_purchases')
      .select('status')
      .eq('user_id', session.userId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!blueCheck) {
      return {
        success: false,
        error: 'Active Blue Check badge required to claim rewards',
      };
    }

    // 2. Validate at least 1 active referral
    const { data: activeRefs } = await supabase
      .from('referral_relationships')
      .select('id')
      .eq('referrer_id', session.userId)
      .not('activated_at', 'is', null)
      .limit(1);

    if (!activeRefs || activeRefs.length === 0) {
      return {
        success: false,
        error: 'Minimum 1 active referral required to claim rewards',
      };
    }

    // EVM chain IDs (BSC Mainnet + Testnet, Ethereum, etc.)
    const evmChainIds = ['56', '97', '1', '5', '11155111', 'evm'];
    const solanaChainIds = ['solana', 'sol', 'devnet', 'mainnet-beta'];
    const chainIds = chain === 'evm' ? evmChainIds : solanaChainIds;

    // 3. Get unclaimed rewards for the specified chain
    const { data: unclaimedRewards } = await supabase
      .from('referral_ledger')
      .select('id, amount')
      .eq('referrer_id', session.userId)
      .eq('status', 'CLAIMABLE')
      .in('chain', chainIds);

    if (!unclaimedRewards || unclaimedRewards.length === 0) {
      return {
        success: false,
        error: `No pending rewards to claim on ${chain === 'evm' ? 'EVM' : 'Solana'}`,
      };
    }

    // 4. Calculate total claimable amount
    const totalAmount = unclaimedRewards.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);

    // 5. Mark rewards as CLAIMED
    const rewardIds = unclaimedRewards.map((r) => r.id);
    const { error: updateError } = await supabase
      .from('referral_ledger')
      .update({
        status: 'CLAIMED',
        claimed_at: new Date().toISOString(),
      })
      .in('id', rewardIds);

    if (updateError) {
      console.error('Failed to update rewards:', updateError);
      return {
        success: false,
        error: 'Failed to process claim. Please try again.',
      };
    }

    // 6. TODO: Trigger on-chain payout from treasury
    // For now, we mark them as claimed in the database.
    // On-chain payout will be implemented via backend worker
    // that monitors CLAIMED status and sends native coin.

    const currency = chain === 'evm' ? 'BNB' : 'SOL';

    return {
      success: true,
      claimedAmount: totalAmount.toFixed(6),
      currency,
    };
  } catch (error: any) {
    console.error('claimRewards error:', error);
    return {
      success: false,
      error: error.message || 'Failed to claim rewards',
    };
  }
}
