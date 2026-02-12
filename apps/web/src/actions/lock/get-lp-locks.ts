'use server';

import { createClient } from '@/lib/supabase/server';

export interface LPLockItem {
  id: string;
  projectName: string;
  symbol: string;
  type: 'PRESALE' | 'FAIRLAUNCH' | 'BONDING';
  chain: string;
  chainId: number;
  tokenAddress: string;
  contractAddress: string | null;
  poolAddress: string | null;
  lockStatus: string;
  lockDurationMonths: number;
  liquidityPercent: number;
  dexPlatform: string;
  totalRaised: string;
  status: string;
  // LP lock details (from liquidity_locks table)
  lockId: number | null;
  lpTokenAddress: string | null;
  lockerAddress: string | null;
  lockAmount: string | null;
  lockedAt: string | null;
  lockedUntil: string | null;
  lockTxHash: string | null;
  beneficiary: string | null;
  logoUrl: string | null;
}

/**
 * Fetch all LP lock data from all project types (presale, fairlaunch, bonding)
 * Joins with liquidity_locks for on-chain lock details
 */
export async function getLPLocks(): Promise<LPLockItem[]> {
  const supabase = createClient();

  const { data: rounds, error } = await supabase
    .from('launch_rounds')
    .select(
      `
      id,
      type,
      chain,
      chain_id,
      token_address,
      contract_address,
      pool_address,
      lock_status,
      total_raised,
      status,
      params,
      deployed_at,
      project:projects!inner(
        name,
        symbol,
        logo_url
      ),
      liquidity_locks(
        lock_id,
        lp_token_address,
        locker_contract_address,
        lock_amount,
        locked_at,
        locked_until,
        lock_tx_hash,
        status
      )
    `
    )
    .in('status', ['DEPLOYED', 'LIVE', 'ENDED', 'FINALIZED', 'SUCCESS', 'FINALIZED_SUCCESS'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[LP Lock] Failed to fetch rounds:', error);
    return [];
  }

  return (rounds || []).map((r: any) => {
    // Get the first (latest) liquidity lock record
    const lockRecord = r.liquidity_locks?.[0] || null;

    return {
      id: r.id,
      projectName: r.project?.name || 'Unknown',
      symbol: r.project?.symbol || '???',
      type: r.type || 'FAIRLAUNCH',
      chain: r.chain || '97',
      chainId: r.chain_id || 97,
      tokenAddress: r.token_address || '',
      contractAddress: r.contract_address || null,
      poolAddress: r.pool_address || null,
      lockStatus: lockRecord?.status || r.lock_status || 'NONE',
      lockDurationMonths: r.params?.lp_lock_months || r.params?.lp_lock?.duration_months || 0,
      liquidityPercent: r.params?.liquidity_percent || r.params?.lp_lock?.percentage || 0,
      dexPlatform: r.params?.dex_platform || r.params?.lp_lock?.platform || 'PancakeSwap',
      totalRaised: r.total_raised || '0',
      status: r.status || 'UNKNOWN',
      // On-chain lock data from liquidity_locks
      lockId: lockRecord?.lock_id ?? null,
      lpTokenAddress: lockRecord?.lp_token_address || null,
      lockerAddress: lockRecord?.locker_contract_address || null,
      lockAmount: lockRecord?.lock_amount || null,
      lockedAt: lockRecord?.locked_at || r.deployed_at || null,
      lockedUntil: lockRecord?.locked_until || null,
      lockTxHash: lockRecord?.lock_tx_hash || r.params?.lock_tx_hash || null,
      beneficiary: null,
      logoUrl: r.project?.logo_url || null,
    };
  });
}
