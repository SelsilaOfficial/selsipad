'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { ethers } from 'ethers';

/**
 * Admin action to cancel a fairlaunch on-chain (emergency rescue).
 * Calls Fairlaunch.cancel() to set status = CANCELLED so refunds can be enabled.
 */
export async function cancelFairlaunch(roundId: string) {
  try {
    // #region agent log (debug-session)
    fetch('http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'apps/web/src/actions/admin/cancel-fairlaunch.ts:cancelFairlaunch:entry',
        message: 'cancelFairlaunch entry',
        data: { roundId },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'R',
      }),
    }).catch(() => {});
    // #endregion

    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('id, status, chain, contract_address, total_raised, params, result')
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return { success: false, error: 'Round not found' };
    }

    if (!round.contract_address) {
      return { success: false, error: 'No contract address' };
    }

    // ===== On-chain cancel() =====
    try {
      const adminPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
      if (!adminPrivateKey) {
        return { success: false, error: 'DEPLOYER_PRIVATE_KEY not configured in environment' };
      }

      const rpcUrls: Record<string, string> = {
        '97': process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
        '56': process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
      };

      const rpcUrl = rpcUrls[round.chain];
      if (!rpcUrl) {
        return { success: false, error: `Unsupported chain: ${round.chain}` };
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

      const fairlaunchAbi = [
        'function cancel() external',
        'function status() view returns (uint8)',
        'function getStatus() view returns (uint8)',
      ];
      const contract = new ethers.Contract(round.contract_address, fairlaunchAbi, adminWallet);

      const [storedStatus, calculatedStatus, latestBlock] = await Promise.all([
        (contract as any).status().catch(() => null),
        (contract as any).getStatus().catch(() => null),
        provider.getBlock('latest').catch(() => null),
      ]);

      // #region agent log (debug-session)
      fetch('http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'apps/web/src/actions/admin/cancel-fairlaunch.ts:cancelFairlaunch:onchainSnapshot',
          message: 'on-chain snapshot before cancel',
          data: {
            contractAddress: round.contract_address,
            chain: round.chain,
            adminAddress: adminWallet.address,
            storedStatus: storedStatus?.toString?.() ?? storedStatus,
            calculatedStatus: calculatedStatus?.toString?.() ?? calculatedStatus,
            chainNow: latestBlock?.timestamp ?? null,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'R',
        }),
      }).catch(() => {});
      // #endregion

      const tx = await (contract as any).cancel({ gasLimit: 500000 });
      const receipt = await tx.wait();

      // #region agent log (debug-session)
      fetch('http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'apps/web/src/actions/admin/cancel-fairlaunch.ts:cancelFairlaunch:receipt',
          message: 'cancel tx receipt',
          data: { txHash: tx?.hash, status: receipt?.status, blockNumber: receipt?.blockNumber },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'R',
        }),
      }).catch(() => {});
      // #endregion
    } catch (contractError: any) {
      // #region agent log (debug-session)
      fetch('http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'apps/web/src/actions/admin/cancel-fairlaunch.ts:cancelFairlaunch:contractError',
          message: 'contract cancel failed',
          data: {
            name: contractError?.name,
            code: contractError?.code,
            message: contractError?.message,
            shortMessage: contractError?.shortMessage,
            reason: contractError?.reason,
            data: contractError?.data,
            infoErrorMessage: contractError?.info?.error?.message,
            infoErrorData: contractError?.info?.error?.data,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'R',
        }),
      }).catch(() => {});
      // #endregion

      return { success: false, error: `Contract cancel failed: ${contractError.message}` };
    }

    // ===== Update database to refundable state =====
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'FINALIZED',
        // DB enum historically uses "CANCELED" (one L). Keep that for compatibility.
        result: 'CANCELED',
        finalized_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    if (updateError) {
      return { success: false, error: 'Failed to update status' };
    }

    return { success: true, status: 'FINALIZED', result: 'CANCELED' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to cancel fairlaunch' };
  }
}

