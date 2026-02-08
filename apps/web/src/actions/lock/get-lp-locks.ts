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
  // LP lock specific
  lockedAt: string | null;
  unlockedAt: string | null;
  lockerAddress: string | null;
  lockTxHash: string | null;
  logoUrl: string | null;
}

/**
 * Fetch all LP lock data from all project types (presale, fairlaunch, bonding)
 * For investor trust/transparency display
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
      )
    `
    )
    .in('status', ['DEPLOYED', 'LIVE', 'ENDED', 'FINALIZED'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[LP Lock] Failed to fetch rounds:', error);
    return [];
  }

  return (rounds || []).map((r: any) => ({
    id: r.id,
    projectName: r.project?.name || 'Unknown',
    symbol: r.project?.symbol || '???',
    type: r.type || 'FAIRLAUNCH',
    chain: r.chain || '97',
    chainId: r.chain_id || 97,
    tokenAddress: r.token_address || '',
    contractAddress: r.contract_address || null,
    poolAddress: r.pool_address || null,
    lockStatus: r.lock_status || 'NONE',
    lockDurationMonths: r.params?.lp_lock_months || r.params?.lp_lock?.duration_months || 0,
    liquidityPercent: r.params?.liquidity_percent || r.params?.lp_lock?.percentage || 0,
    dexPlatform: r.params?.dex_platform || r.params?.lp_lock?.platform || 'Unknown',
    totalRaised: r.total_raised || '0',
    status: r.status || 'UNKNOWN',
    lockedAt: r.deployed_at || null,
    unlockedAt: null, // Will be computed from locked_at + duration
    lockerAddress: r.params?.locker_contract_address || null,
    lockTxHash: r.params?.lock_tx_hash || null,
    logoUrl: r.project?.logo_url || null,
  }));
}
