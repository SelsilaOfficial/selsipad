'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getAdminSession } from '@/lib/auth/admin-session';
import { ethers } from 'ethers';
import { revalidatePath } from 'next/cache';
import { getDeployerPrivateKey } from '@/lib/web3/deployer-wallet';

const RPC_URLS: Record<string, string> = {
  '97': process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com',
  '56': process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
};

/**
 * Admin action to cancel a presale on-chain.
 * Calls PresaleRound.finalizeFailed() to set status = CANCELLED, enabling refunds.
 */
export async function cancelPresale(roundId: string, reason: string = 'Cancelled by admin') {
  try {
    const session = await getAdminSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createServiceRoleClient();

    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('id, status, type, chain, contract_address, round_address, project_id')
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return { success: false, error: 'Round not found' };
    }

    if (round.type !== 'PRESALE') {
      return { success: false, error: 'Not a presale round' };
    }

    const contractAddress = round.round_address || round.contract_address;

    // If no contract deployed, just update DB
    if (!contractAddress) {
      const { error: updateError } = await supabase
        .from('launch_rounds')
        .update({
          status: 'FINALIZED',
          result: 'CANCELED',
          finalized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', roundId);

      if (updateError) {
        return { success: false, error: 'Failed to update status' };
      }

      revalidatePath('/admin');
      return { success: true, status: 'CANCELED', onchain: false };
    }

    // On-chain cancel
    const chainId = parseInt(round.chain) || 97;
    const adminPrivateKey = getDeployerPrivateKey(chainId);

    const rpcUrl = RPC_URLS[round.chain];
    if (!rpcUrl) {
      return { success: false, error: `Unsupported chain: ${round.chain}` };
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

    // PresaleRound uses finalizeFailed() or cancel() depending on status
    const presaleAbi = [
      'function finalizeFailed(string reason) external',
      'function status() view returns (uint8)',
    ];
    const contract = new ethers.Contract(contractAddress, presaleAbi, adminWallet);

    const onchainStatus = await (contract as any).status().catch(() => null);
    console.log('[cancelPresale] On-chain status:', onchainStatus?.toString());

    const tx = await (contract as any).finalizeFailed(reason, { gasLimit: 500000 });
    console.log('[cancelPresale] Cancel tx sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('[cancelPresale] Confirmed, block:', receipt.blockNumber);

    // Update DB
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'FINALIZED',
        result: 'CANCELED',
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    if (updateError) {
      return { success: false, error: 'Contract canceled but DB update failed' };
    }

    // Update project status
    if (round.project_id) {
      await supabase
        .from('projects')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('id', round.project_id);
    }

    revalidatePath('/admin');
    return { success: true, status: 'CANCELED', onchain: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[cancelPresale] Error:', error);
    return { success: false, error: error.message || 'Failed to cancel presale' };
  }
}
