'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * Claim tokens from fairlaunch
 * Returns claimable amount and transaction details
 */
export async function claimFairlaunchTokens(roundId: string) {
  try {
    const session = await getServerSession();
    if (!session || !session.address) {
      return { success: false, error: 'Please connect wallet' };
    }

    const supabase = createClient();

    // Get fairlaunch details
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select(`
        id,
        status,
        contract_address,
        chain,
        total_raised,
        params
      `)
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return { success: false, error: 'Fairlaunch not found' };
    }

    // Validate fairlaunch is ended
    if (round.status !== 'ENDED') {
      return {
        success: false,
        error: `Cannot claim yet. Fairlaunch status: ${round.status}`,
      };
    }

    if (!round.contract_address) {
      return { success: false, error: 'Contract not deployed' };
    }

    // Get user contribution (case-insensitive using LOWER)
    console.log('[claimFairlaunchTokens] Querying contribution for wallet:', session.address);
    const { data: contribution, error: contribError } = await supabase
      .from('contributions')
      .select('*')
      .eq('round_id', roundId)
      .eq('wallet_address', session.address.toLowerCase()) // Now all DB addresses are lowercase
      .eq('status', 'CONFIRMED')
      .single();

    console.log('[claimFairlaunchTokens] Contribution query result:', { contribution, contribError });

    if (contribError || !contribution) {
      return {
        success: false,
        error: 'No contribution found for this wallet',
      };
    }

    // Check if already claimed
    if (contribution.claimed_at) {
      return {
        success: false,
        error: 'Tokens already claimed',
        alreadyClaimed: true,
      };
    }

    // Calculate claimable amount
    const totalRaised = parseFloat(round.total_raised || '0');
    const userContribution = parseFloat(contribution.amount || '0');
    const tokensForSale = parseFloat(round.params?.tokens_for_sale || '0');

    if (totalRaised === 0 || tokensForSale === 0) {
      return { success: false, error: 'Invalid fairlaunch parameters' };
    }

    const userShare = userContribution / totalRaised;
    const claimableAmount = tokensForSale * userShare;

    return {
      success: true,
      claimable: claimableAmount.toString(),
      userShare: (userShare * 100).toFixed(2),
      contribution: userContribution.toString(),
      contractAddress: round.contract_address,
      chain: round.chain,
      contributionId: contribution.id,
    };
  } catch (error: any) {
    console.error('claimFairlaunchTokens error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process claim',
    };
  }
}

/**
 * Mark contribution as claimed after successful on-chain transaction
 */
export async function markTokensClaimed(params: {
  contributionId: string;
  txHash: string;
}) {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    const { error } = await supabase
      .from('contributions')
      .update({
        claimed_at: new Date().toISOString(),
        claim_tx_hash: params.txHash,
      })
      .eq('id', params.contributionId);

    if (error) {
      console.error('markTokensClaimed error:', error);
      return { success: false, error: 'Failed to update claim status' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('markTokensClaimed error:', error);
    return {
      success: false,
      error: error.message || 'Failed to mark as claimed',
    };
  }
}
