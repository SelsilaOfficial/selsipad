'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';
import { recordContribution } from '@/actions/referral/record-contribution';

/**
 * Save fairlaunch contribution to database and trigger referral tracking
 */
export async function saveFairlaunchContribution(params: {
  roundId: string;
  amount: string; // in wei
  txHash: string;
  chain: string;
  walletAddress: string; // Wallet address from client
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Require session for proper referral tracking (consistent with presale)
    const session = await getServerSession();
    if (!session?.userId) {
      // Fallback: try to resolve user_id from wallet address
      const supabaseLookup = createServiceRoleClient();
      const { data: walletRow } = await supabaseLookup
        .from('wallets')
        .select('user_id')
        .ilike('address', params.walletAddress)
        .limit(1)
        .single();

      if (!walletRow?.user_id) {
        console.warn('[saveFairlaunchContribution] No session and wallet not registered:', params.walletAddress);
        return { success: false, error: 'Not authenticated. Please connect and sign in with your wallet.' };
      }

      // Use wallet-resolved userId
      var resolvedUserId = walletRow.user_id;
    }

    const userId = session?.userId || resolvedUserId!;
    const supabase = createServiceRoleClient();

    // Get round details
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('id, chain, raise_asset, token_address')
      .eq('id', params.roundId)
      .single();

    if (roundError || !round) {
      return { success: false, error: 'Round not found' };
    }

    // Convert amount from wei to ether for database storage
    const amountInEther = (Number(params.amount) / 1e18).toString();

    // Save contribution to database
    // IMPORTANT: status must be 'CONFIRMED' to trigger total_raised update
    const { error: insertError } = await supabase.from('contributions').insert({
      round_id: params.roundId,
      user_id: userId, // Always set — from session or wallet lookup
      wallet_address: params.walletAddress.toLowerCase(),
      amount: amountInEther,
      chain: params.chain,
      tx_hash: params.txHash,
      status: 'CONFIRMED',
    });

    if (insertError) {
      // If duplicate tx_hash, ignore (already recorded)
      if (!insertError.message.includes('duplicate') && !insertError.message.includes('unique')) {
        console.error('Insert contribution error:', insertError);
        return { success: false, error: insertError.message };
      }
    }

    // ✅ Record for referral tracking (always runs since userId is guaranteed)
    await recordContribution({
      userId,
      sourceType: 'FAIRLAUNCH',
      sourceId: params.roundId,
      amount: params.amount,
      asset: round.raise_asset || 'NATIVE',
      chain: params.chain,
      txHash: params.txHash,
    });

    return { success: true };
  } catch (error: any) {
    console.error('saveFairlaunchContribution error:', error);
    return {
      success: false,
      error: error.message || 'Failed to save contribution',
    };
  }
}
