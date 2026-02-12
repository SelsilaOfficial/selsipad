'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ethers } from 'ethers';

/**
 * LPLocker ABI fragment for parsing TokensLocked events
 */
const LP_LOCKER_EVENT_ABI = [
  'event TokensLocked(uint256 indexed lockId, address indexed lpToken, address indexed owner, address beneficiary, uint256 amount, uint256 unlockTime)',
];

/**
 * LP Locker addresses per chain
 * Updated when LPLocker is deployed to each network
 */
export const LP_LOCKER_ADDRESSES: Record<string, string> = {
  '97': '0xd15Fb6D4f57C9948A0FA7d079F8F658e0c486822', // BSC Testnet — deployed 2026-02-12
  '56': '', // BSC Mainnet — fill after deployment
};

/**
 * Parse TokensLocked events from a transaction receipt and save to DB
 *
 * Called after:
 * - PresaleRound.finalizeSuccessEscrow() — LP auto-locked during finalization
 * - Fairlaunch.adminLockLP() — LP locked in step-based finalization
 *
 * @param receipt Transaction receipt containing logs
 * @param roundId Launch round ID (for DB reference)
 * @param chain Chain ID string (e.g., '97', '56')
 * @param lockerAddress LP Locker contract address
 */
export async function recordLPLock(
  receipt: ethers.TransactionReceipt,
  roundId: string,
  chain: string,
  lockerAddress?: string
): Promise<{ success: boolean; lockId?: number; error?: string }> {
  try {
    const effectiveLocker = lockerAddress || LP_LOCKER_ADDRESSES[chain];
    if (!effectiveLocker) {
      console.warn('[recordLPLock] No locker address configured for chain:', chain);
      return { success: false, error: 'No locker address configured' };
    }

    const iface = new ethers.Interface(LP_LOCKER_EVENT_ABI);

    // Find TokensLocked event in receipt logs
    let lockEvent: ethers.LogDescription | null = null;
    let lockTxHash = receipt.hash;

    for (const log of receipt.logs) {
      try {
        // Only parse logs from the LP locker contract
        if (log.address.toLowerCase() === effectiveLocker.toLowerCase()) {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.name === 'TokensLocked') {
            lockEvent = parsed;
            break;
          }
        }
      } catch {
        // Not our event, skip
      }
    }

    if (!lockEvent) {
      // Try parsing without address filter (for MockLPLocker or proxy patterns)
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.name === 'TokensLocked') {
            lockEvent = parsed;
            break;
          }
        } catch {
          // Not our event, skip
        }
      }
    }

    if (!lockEvent) {
      console.log('[recordLPLock] No TokensLocked event found in tx:', receipt.hash);
      return { success: false, error: 'No TokensLocked event in receipt' };
    }

    const lockId = Number(lockEvent.args[0]); // lockId
    const lpToken = lockEvent.args[1]; // lpToken address
    const owner = lockEvent.args[2]; // owner (launch contract)
    const beneficiary = lockEvent.args[3]; // beneficiary
    const amount = lockEvent.args[4]; // amount (BigInt)
    const unlockTime = lockEvent.args[5]; // unlockTime (BigInt)

    console.log('[recordLPLock] Found lock event:', {
      lockId,
      lpToken,
      owner,
      beneficiary,
      amount: ethers.formatEther(amount),
      unlockTime: new Date(Number(unlockTime) * 1000).toISOString(),
    });

    // Save to DB
    const supabase = createServiceRoleClient();
    const { error: dbError } = await supabase.from('liquidity_locks').upsert(
      {
        round_id: roundId,
        lock_id: lockId,
        lp_token: lpToken,
        locker_address: effectiveLocker,
        amount: ethers.formatEther(amount),
        locked_at: new Date().toISOString(),
        locked_until: new Date(Number(unlockTime) * 1000).toISOString(),
        beneficiary: beneficiary,
        lock_tx_hash: lockTxHash,
        chain: chain,
        status: 'LOCKED',
      },
      { onConflict: 'round_id' }
    );

    if (dbError) {
      console.error('[recordLPLock] DB error:', dbError);
      return { success: false, error: `DB save failed: ${dbError.message}` };
    }

    // Also update lock_status on launch_rounds
    await supabase
      .from('launch_rounds')
      .update({
        lock_status: 'LOCKED',
        pool_address: lpToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    console.log(`[recordLPLock] ✅ Lock #${lockId} saved for round ${roundId}`);
    return { success: true, lockId };
  } catch (err: any) {
    console.error('[recordLPLock] Error:', err);
    return { success: false, error: err.message };
  }
}
