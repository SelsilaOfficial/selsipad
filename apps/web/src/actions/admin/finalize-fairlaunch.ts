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
    // #region agent log
    fetch('http://localhost:7243/ingest/653da906-68d5-4a8f-a095-0a4e33372f15', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'finalize-fairlaunch.ts:entry',
        message: 'finalizeFairlaunch entry',
        data: { roundId },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'fairlaunch-time-debug',
        hypothesisId: 'H1',
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

    // Get round details (include start_at, end_at for time-debug)
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('id, status, chain, contract_address, total_raised, params, start_at, end_at')
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

    const dbEndAtRaw = round.end_at ?? null;
    const dbStartAtRaw = round.start_at ?? null;
    const dbEndAtMs = dbEndAtRaw != null ? new Date(dbEndAtRaw).getTime() : null;
    const dbEndAtSec = dbEndAtMs != null ? Math.floor(dbEndAtMs / 1000) : null;
    const serverNowSec = Math.floor(Date.now() / 1000);
    // #region agent log
    fetch('http://localhost:7243/ingest/653da906-68d5-4a8f-a095-0a4e33372f15', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'finalize-fairlaunch.ts:roundLoaded',
        message: 'round loaded from db with timing',
        data: {
          roundId,
          chain: round.chain,
          contractAddress: round.contract_address,
          dbStatus: round.status,
          totalRaised,
          softcap,
          softcapReached,
          dbStartAtRaw,
          dbEndAtRaw,
          dbEndAtSec,
          serverNowSec,
          serverPastDbEnd: dbEndAtSec != null ? serverNowSec >= dbEndAtSec : null,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'fairlaunch-time-debug',
        hypothesisId: 'H1',
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

      // Contract ABI - finalize + view functions for pre-checks
      const fairlaunchAbi = [
        'function finalize() external',
        'function isFinalized() view returns (bool)',
        'function status() view returns (uint8)',
        'function getStatus() view returns (uint8)',
        'function startTime() view returns (uint256)',
        'function endTime() view returns (uint256)',
        'function lpLockerAddress() view returns (address)',
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

      // Pre-check: LP Locker must be set or finalize() will revert with "LP Locker not configured"
      const lpLockerAddr = await (contract as any).lpLockerAddress().catch(() => null);
      const lpLockerZero =
        lpLockerAddr == null ||
        lpLockerAddr === ethers.ZeroAddress ||
        (typeof lpLockerAddr === 'string' && lpLockerAddr.toLowerCase() === '0x0000000000000000000000000000000000000000');
      if (lpLockerZero) {
        console.log('[finalizeFairlaunch] Blocked: LP Locker not set on contract');
        return {
          success: false,
          error:
            'LP Locker not configured on contract. Admin must call setLPLocker() first (e.g. via API POST /api/admin/fairlaunch/setup-lp-locker with contract_address in body).',
          contractAddress: round.contract_address,
        };
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

      const dbEndAtSecForCompare = dbEndAtSec ?? null;
      const chainEndVsDbEnd =
        endTimeNum != null && dbEndAtSecForCompare != null
          ? { chainEndTime: endTimeNum, dbEndAtSec: dbEndAtSecForCompare, match: endTimeNum === dbEndAtSecForCompare }
          : null;
      // #region agent log
      fetch('http://localhost:7243/ingest/653da906-68d5-4a8f-a095-0a4e33372f15', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'finalize-fairlaunch.ts:onchainSnapshot',
          message: 'on-chain vs DB timing before finalize',
          data: {
            chainId: round.chain,
            contractAddress: round.contract_address,
            isFinalized,
            storedStatus: storedStatus?.toString?.() ?? storedStatus,
            calculatedStatus: calculatedStatus?.toString?.() ?? calculatedStatus,
            chainStartTime: startTime?.toString?.() ?? startTime,
            chainEndTime: endTime?.toString?.() ?? endTime,
            chainNow,
            chainNowGteEnd: chainNow != null && endTimeNum != null ? chainNow >= endTimeNum : null,
            dbEndAtRaw,
            dbEndAtSec: dbEndAtSecForCompare,
            serverNowSec,
            chainEndVsDbEnd,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'fairlaunch-time-debug',
          hypothesisId: 'H1',
        }),
      }).catch(() => {});
      // #endregion

      // Guard: do not call finalize() until chain block time >= endTime. UI/DB can show "ended" earlier (timezone/client time).
      const endTimeISO = endTimeNum != null ? new Date(endTimeNum * 1000).toISOString() : null;
      const chainNowISO = chainNow != null ? new Date(chainNow * 1000).toISOString() : null;
      const waitSec = endTimeNum != null && chainNow != null ? endTimeNum - chainNow : null;
      if (waitSec != null && waitSec > 0) {
        const message = `Sale has not ended on-chain yet. Contract end time (UTC): ${endTimeISO}. Current block time: ${chainNowISO}. Try again in ~${Math.ceil(waitSec / 60)} minutes.`;
        console.log('[finalizeFairlaunch] Blocked by time guard:', { waitSec, endTimeNum, chainNow });
        return {
          success: false,
          error: message,
          contractAddress: round.contract_address,
          chainEndTimeUTC: endTimeISO,
          blockTimeUTC: chainNowISO,
        };
      }

      console.log('[finalizeFairlaunch] Calling finalize() on contract...');

      // Call finalize() on contract
      // NOTE: Use gasLimit override because _updateStatus() state change
      // causes gas estimation to fail when status != ENDED
      // #region agent log
      fetch('http://localhost:7243/ingest/653da906-68d5-4a8f-a095-0a4e33372f15', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'finalize-fairlaunch.ts:sendTx',
          message: 'sending finalize tx',
          data: {
            contractAddress: round.contract_address,
            from: adminWallet.address,
            gasLimit: 5000000,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'fairlaunch-time-debug',
          hypothesisId: 'H5',
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

      // #region agent log
      fetch('http://localhost:7243/ingest/653da906-68d5-4a8f-a095-0a4e33372f15', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'finalize-fairlaunch.ts:receipt',
          message: 'finalize tx receipt',
          data: {
            txHash: tx?.hash,
            blockNumber: receipt?.blockNumber,
            status: receipt?.status,
            gasUsed: receipt?.gasUsed?.toString?.() ?? null,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'fairlaunch-time-debug',
          hypothesisId: 'H5',
        }),
      }).catch(() => {});
      // #endregion
    } catch (contractError: any) {
      // Log full error for debugging (revert reason often in .data or .info)
      const revertData =
        contractError?.data ??
        contractError?.info?.error?.data ??
        contractError?.error?.data ??
        contractError?.receipt ??
        null;
      console.error('[finalizeFairlaunch] Contract call failed:', {
        message: contractError?.message,
        code: contractError?.code,
        reason: contractError?.reason,
        data: typeof revertData === 'string' ? revertData : revertData ? JSON.stringify(revertData).slice(0, 500) : null,
      });

      // Attempt to decode custom error data (if present)
      let decodedError: string | null = null;
      try {
        const dataStr = typeof revertData === 'string' ? revertData : null;
        if (dataStr && dataStr.startsWith('0x') && dataStr.length >= 10) {
          const iface = new ethers.Interface(fairlaunchAbi);
          const parsed = iface.parseError(dataStr);
          decodedError = parsed?.name ?? null;
          if (decodedError) console.error('[finalizeFairlaunch] Decoded revert:', decodedError, parsed?.args);
        }
      } catch {
        decodedError = null;
      }

      // #region agent log (debug-session)
      fetch('http://localhost:7243/ingest/653da906-68d5-4a8f-a095-0a4e33372f15', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'finalize-fairlaunch.ts:contractError',
          message: 'contract finalize failed',
          data: {
            name: contractError?.name,
            code: contractError?.code,
            message: contractError?.message,
            shortMessage: contractError?.shortMessage,
            reason: contractError?.reason,
            decodedError,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'fairlaunch-time-debug',
          hypothesisId: 'H1',
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
