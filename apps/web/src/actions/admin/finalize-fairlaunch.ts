'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { ethers } from 'ethers';

/**
 * Admin action to finalize a fairlaunch
 * Automatically calls the contract finalize() function on-chain
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
    const softcapReached = totalRaised >= softcap;

    console.log('[finalizeFairlaunch] Round ready for finalization:', {
      roundId,
      contractAddress: round.contract_address,
      totalRaised,
      softcap,
      softcapReached,
    });

    // ===== NEW: Automatic On-Chain Finalization =====
    try {
      // Get admin private key from environment
      const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY || process.env.PRIVATE_KEY;
      if (!adminPrivateKey) {
        return { success: false, error: 'Admin private key not configured in environment' };
      }

      // Setup provider based on chain
      const rpcUrls: Record<string, string> = {
        '97': process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545',
        '56': process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed.binance.org',
      };

      const rpcUrl = rpcUrls[round.chain];
      if (!rpcUrl) {
        return { success: false, error: `Unsupported chain: ${round.chain}` };
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

      console.log('[finalizeFairlaunch] Admin wallet:', adminWallet.address);

      // Contract ABI - just finalize function
      const fairlaunchAbi = [
        'function finalize() external',
        'function isFinalized() view returns (bool)',
      ];

      const contract = new ethers.Contract(
        round.contract_address,
        fairlaunchAbi,
        adminWallet
      );

      // Check if already finalized
      const isFinalized = await contract.isFinalized();
      if (isFinalized) {
        return { success: false, error: 'Contract already finalized' };
      }

      console.log('[finalizeFairlaunch] Calling finalize() on contract...');

      // Call finalize() on contract
      const tx = await contract.finalize();
      console.log('[finalizeFairlaunch] Transaction sent:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('[finalizeFairlaunch] Transaction confirmed in block:', receipt.blockNumber);

    } catch (contractError: any) {
      console.error('[finalizeFairlaunch] Contract call failed:', contractError);
      return { 
        success: false, 
        error: `Contract finalization failed: ${contractError.message}` 
      };
    }

    // ===== Update Database Status =====
    const newStatus = softcapReached ? 'ENDED' : 'FAILED';
    
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({ status: newStatus })
      .eq('id', roundId);

    if (updateError) {
      console.error('Error updating status:', updateError);
      return { success: false, error: 'Failed to update status' };
    }

    return {
      success: true,
      message: softcapReached 
        ? 'Fairlaunch finalized successfully! LP created and claims enabled.'
        : 'Fairlaunch marked as FAILED. Refunds are now enabled for all contributors.',
      contractAddress: round.contract_address,
      chain: round.chain,
      totalRaised,
      softcap,
      status: newStatus,
    };
  } catch (error: any) {
    console.error('finalizeFairlaunch error:', error);
    return {
      success: false,
      error: error.message || 'Failed to finalize fairlaunch',
    };
  }
}
