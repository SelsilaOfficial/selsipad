'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';
import { recordContribution } from '@/actions/referral/record-contribution';
import { revalidatePath } from 'next/cache';

/**
 * Save fairlaunch contribution to database and trigger referral tracking.
 *
 * NOTE: The DB has a trigger `increment_round_totals` on `contributions` table
 * that automatically increments `total_raised` and `total_participants` on
 * `launch_rounds` when a contribution with status='CONFIRMED' is inserted.
 * So we do NOT need to manually update those fields here.
 */
export async function saveFairlaunchContribution(params: {
  roundId: string;
  amount: string; // in wei
  txHash: string;
  chain: string;
  walletAddress: string; // Wallet address from client
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current session (optional for referral tracking)
    const session = await getServerSession();

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
    const amountInEther = Number(params.amount) / 1e18;

    // Save contribution to database
    // The DB trigger `increment_round_totals` will automatically update
    // total_raised and total_participants on launch_rounds
    const { error: insertError } = await supabase.from('contributions').insert({
      round_id: params.roundId,
      user_id: session?.userId || null,
      wallet_address: params.walletAddress.toLowerCase(),
      amount: amountInEther,
      chain: params.chain,
      tx_hash: params.txHash,
      status: 'CONFIRMED',
      confirmed_at: new Date().toISOString(),
    });

    if (insertError) {
      // If duplicate tx_hash, ignore (already recorded)
      if (!insertError.message.includes('duplicate') && !insertError.message.includes('unique')) {
        console.error('[saveFairlaunchContribution] Insert error:', insertError);
        return { success: false, error: insertError.message };
      }
      console.log('[saveFairlaunchContribution] Duplicate contribution, skipping:', params.txHash);
    }

    // ✅ Record for referral tracking
    if (session?.userId) {
      try {
        await recordContribution({
          userId: session.userId,
          sourceType: 'FAIRLAUNCH',
          sourceId: params.roundId,
          amount: params.amount,
          asset: round.raise_asset || 'NATIVE',
          chain: params.chain,
          txHash: params.txHash,
        });
      } catch (refErr: any) {
        console.warn(
          '[saveFairlaunchContribution] Referral tracking (non-fatal):',
          refErr?.message
        );
      }
    }

    // Revalidate project pages so progress bar updates
    revalidatePath(`/project/${params.roundId}`);
    revalidatePath(`/fairlaunch/${params.roundId}`);

    return { success: true };
  } catch (error: any) {
    console.error('[saveFairlaunchContribution] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to save contribution',
    };
  }
}
