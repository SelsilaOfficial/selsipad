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
    // #region agent log (debug-session)
    fetch('http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'apps/web/src/actions/admin/finalize-fairlaunch.ts:finalizeFairlaunch:entry',
        message: 'finalizeFairlaunch entry',
        data: { roundId },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'A',
      }),
    }).catch(() => {});
    // #endregion

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

    // #region agent log (debug-session)
    fetch('http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'apps/web/src/actions/admin/finalize-fairlaunch.ts:finalizeFairlaunch:roundLoaded',
        message: 'round loaded from db',
        data: {
          roundId,
          chain: round.chain,
          contractAddress: round.contract_address,
          dbStatus: round.status,
          totalRaised,
          softcap,
          softcapReached,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'B',
      }),
    }).catch(() => {});
    // #endregion

    // ===== NEW: Automatic On-Chain Finalization =====
    try {
      // CRITICAL: Use DEPLOYER_PRIVATE_KEY (adminExecutor) to match deploy wallet
      // This ensures consistency - same wallet deploys AND finalizes
      const adminPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
      if (!adminPrivateKey) {
        return { success: false, error: 'DEPLOYER_PRIVATE_KEY not configured in environment' };
      }

      // Setup provider based on chain
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

      console.log('[finalizeFairlaunch] Admin wallet:', adminWallet.address);

      // Contract ABI - just finalize function
      const fairlaunchAbi = [
        'function finalize() external',
        'function isFinalized() view returns (bool)',
        'function status() view returns (uint8)',
        'function getStatus() view returns (uint8)',
        'function startTime() view returns (uint256)',
        'function endTime() view returns (uint256)',
        // Custom errors (newer Fairlaunch deployments)
        'error FeeSplitterCallFailed(bytes reason)',
        'error DexAddLiquidityCallFailed(bytes reason)',
        'error LPLockerCallFailed(bytes reason)',
        'error InvalidStatus()',
      ];

      const contract = new ethers.Contract(round.contract_address, fairlaunchAbi, adminWallet);

      // Check if already finalized
      const isFinalized = await (contract as any).isFinalized();
      if (isFinalized) {
        return { success: false, error: 'Contract already finalized' };
      }

      // Snapshot on-chain timing + status BEFORE finalize()
      const [storedStatus, calculatedStatus, startTime, endTime, latestBlock] = await Promise.all([
        (contract as any).status().catch(() => null),
        (contract as any).getStatus().catch(() => null),
        (contract as any).startTime().catch(() => null),
        (contract as any).endTime().catch(() => null),
        provider.getBlock('latest').catch(() => null),
      ]);

      const chainNow = latestBlock?.timestamp ?? null;
      const startTimeNum = startTime != null ? Number(startTime) : null;
      const endTimeNum = endTime != null ? Number(endTime) : null;

      // #region agent log (debug-session)
      fetch('http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'apps/web/src/actions/admin/finalize-fairlaunch.ts:finalizeFairlaunch:onchainSnapshot',
          message: 'on-chain snapshot before finalize',
          data: {
            chainId: round.chain,
            rpcUrlUsed: rpcUrl ? '[set]' : '[missing]',
            contractAddress: round.contract_address,
            adminAddress: adminWallet.address,
            isFinalized,
            storedStatus: storedStatus?.toString?.() ?? storedStatus,
            calculatedStatus: calculatedStatus?.toString?.() ?? calculatedStatus,
            startTime: startTime?.toString?.() ?? startTime,
            endTime: endTime?.toString?.() ?? endTime,
            chainNow,
            chainNowGteStart: chainNow != null && startTimeNum != null ? chainNow >= startTimeNum : null,
            chainNowGteEnd: chainNow != null && endTimeNum != null ? chainNow >= endTimeNum : null,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
      // #endregion

      console.log('[finalizeFairlaunch] Calling finalize() on contract...');

      // Call finalize() on contract
      // NOTE: Use gasLimit override because _updateStatus() state change
      // causes gas estimation to fail when status != ENDED
      // #region agent log (debug-session)
      fetch('http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'apps/web/src/actions/admin/finalize-fairlaunch.ts:finalizeFairlaunch:sendTx',
          message: 'sending finalize tx',
          data: {
            contractAddress: round.contract_address,
            from: adminWallet.address,
            gasLimit: 5000000,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'E',
        }),
      }).catch(() => {});
      // #endregion

      const tx = await (contract as any).finalize({
        gasLimit: 5000000, // 5M gas limit (safe for finalize + addLiquidity)
      });
      console.log('[finalizeFairlaunch] Transaction sent:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('[finalizeFairlaunch] Transaction confirmed in block:', receipt.blockNumber);

      // #region agent log (debug-session)
      fetch('http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'apps/web/src/actions/admin/finalize-fairlaunch.ts:finalizeFairlaunch:receipt',
          message: 'finalize tx receipt',
          data: {
            txHash: tx?.hash,
            blockNumber: receipt?.blockNumber,
            status: receipt?.status,
            gasUsed: receipt?.gasUsed?.toString?.() ?? null,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'E',
        }),
      }).catch(() => {});
      // #endregion
    } catch (contractError: any) {
      console.error('[finalizeFairlaunch] Contract call failed:', contractError);

      // Attempt to decode custom error data (if present)
      let decodedError: string | null = null;
      try {
        const revertData =
          contractError?.data ??
          contractError?.info?.error?.data ??
          contractError?.error?.data ??
          null;
        if (typeof revertData === 'string' && revertData.startsWith('0x') && revertData.length >= 10) {
          const iface = new ethers.Interface(fairlaunchAbi);
          const parsed = iface.parseError(revertData);
          decodedError = parsed?.name ?? null;
        }
      } catch {
        decodedError = null;
      }

      // #region agent log (debug-session)
      fetch('http://localhost:7242/ingest/e157f851-f607-48b5-9469-ddb77df06b07', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'apps/web/src/actions/admin/finalize-fairlaunch.ts:finalizeFairlaunch:contractError',
          message: 'contract finalize failed',
          data: {
            name: contractError?.name,
            code: contractError?.code,
            message: contractError?.message,
            shortMessage: contractError?.shortMessage,
            reason: contractError?.reason,
            data: contractError?.data,
            // ethers v6 often nests extra details here:
            infoErrorMessage: contractError?.info?.error?.message,
            infoErrorData: contractError?.info?.error?.data,
            decodedError,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'E',
        }),
      }).catch(() => {});
      // #endregion

      return {
        success: false,
        error: `Contract finalization failed: ${decodedError ?? contractError.message}`,
      };
    }

    // ===== Update Database Status =====
    const newStatus = 'ENDED'; // Always ENDED after finalize
    const newResult = softcapReached ? 'SUCCESS' : 'FAILED';

    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: newStatus,
        result: newResult,
        finalized_at: new Date().toISOString(),
      })
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
