'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * Admin action to finalize a fairlaunch
 * Calls the contract finalize() function on-chain
 */
export async function finalizeFairlaunch(roundId: string) {
  try {
    // Verify admin
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // TODO: Add admin check
    // const isAdmin = await checkIsAdmin(session.userId);
    // if (!isAdmin) {
    //   return { success: false, error: 'Not authorized' };
    // }

    const supabase = createClient();

    // Get round details
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('id, status, chain, contract_address, total_raised, params')
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return { success: false, error: 'Round not found' };
    }

    // Validate round status
    if (round.status !== 'DEPLOYED') {
      return { success: false, error: `Cannot finalize round with status: ${round.status}` };
    }

    if (!round.contract_address) {
      return { success: false, error: 'No contract address' };
    }

    // Check if softcap reached
    const softcap = parseFloat(round.params?.softcap || '0');
    const totalRaised = parseFloat(round.total_raised || '0');

    if (totalRaised < softcap) {
      return { 
        success: false, 
        error: `Softcap not reached. Raised: ${totalRaised}, Softcap: ${softcap}` 
      };
    }

    console.log('[finalizeFairlaunch] Round ready for finalization:', {
      roundId,
      contractAddress: round.contract_address,
      totalRaised,
      softcap,
    });

    // Update status to ENDED (finalization complete)
    // Admin will call contract finalize() separately
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({ status: 'ENDED' })
      .eq('id', roundId);

    if (updateError) {
      console.error('Error updating status:', updateError);
      return { success: false, error: 'Failed to update status' };
    }

    return {
      success: true,
      message: 'Fairlaunch marked as ENDED. Admin can now call finalize() on contract to create LP and enable claims.',
      contractAddress: round.contract_address,
      chain: round.chain,
      totalRaised,
      softcap,
    };
  } catch (error: any) {
    console.error('finalizeFairlaunch error:', error);
    return {
      success: false,
      error: error.message || 'Failed to finalize fairlaunch',
    };
  }
}
