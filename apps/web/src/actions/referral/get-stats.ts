'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';

export interface ReferralStats {
  // Basic counts
  totalReferrals: number;
  activeReferrals: number;
  pendingReferrals: number;

  // Earnings in USD (formatted)
  totalEarningsUsd: string;
  pendingEarningsUsd: string;
  claimedEarningsUsd: string;

  // Per-chain totals in USD
  evmTotalUsd: string;
  solanaTotalUsd: string;

  // Per-chain pending in native coin (human-readable)
  evmPendingNative: string;
  solanaPendingNative: string;

  // Breakdown by source
  earningsBySource: {
    FAIRLAUNCH: string;
    PRESALE: string;
    BONDING: string;
    BLUECHECK: string;
  };

  // Claim requirements
  hasBlueCheck: boolean;
  hasActiveReferral: boolean;

  // Referred users
  referredUsers: Array<{
    userId: string;
    username: string;
    avatarUrl?: string;
    status: 'PENDING' | 'ACTIVE';
    joinedAt: string;
    activatedAt?: string;
    totalContributions: number;
    contributionAmount: string;
  }>;
}

// EVM chain IDs (BSC Mainnet + Testnet, Ethereum, etc.)
const EVM_CHAIN_IDS = ['56', '97', '1', '5', '11155111', 'evm'];
// Solana chain identifiers
const SOLANA_CHAIN_IDS = ['solana', 'sol', 'devnet', 'mainnet-beta'];

/**
 * Determine if a chain value is EVM or Solana
 */
function getChainType(chain: string | null): 'evm' | 'solana' {
  if (!chain) return 'evm'; // Default to EVM
  const lower = chain.toLowerCase();
  if (SOLANA_CHAIN_IDS.includes(lower)) return 'solana';
  return 'evm'; // All numeric chain IDs are EVM
}

/**
 * Convert wei (18 decimals) to human-readable native coin amount
 */
function weiToNative(weiStr: string): number {
  try {
    const wei = BigInt(weiStr || '0');
    return Number(wei) / 1e18;
  } catch {
    // If not a valid BigInt, try parseFloat
    const val = parseFloat(weiStr || '0');
    // If value is extremely large, it's probably wei
    if (val > 1e12) return val / 1e18;
    return val;
  }
}

/**
 * Fetch native coin prices from CoinGecko (BNB + SOL)
 */
async function getCoinPricesUsd(): Promise<{ bnb: number; sol: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,solana&vs_currencies=usd',
      { signal: controller.signal, cache: 'no-store' }
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error('CoinGecko API error');
    const data = await res.json();
    return {
      bnb: data?.binancecoin?.usd || 300,
      sol: data?.solana?.usd || 150,
    };
  } catch {
    // Fallback prices if API fails or times out
    return { bnb: 300, sol: 150 };
  }
}

/**
 * Get comprehensive referral statistics for the current user
 * Supports multi-chain (EVM + Solana) with USD conversion via oracle
 */
export async function getReferralStats(): Promise<{
  success: boolean;
  stats?: ReferralStats;
  error?: string;
}> {
  try {
    const session = await getServerSession();

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createServiceRoleClient();

    // Fetch coin prices for USD conversion
    const prices = await getCoinPricesUsd();

    // 1. Get all referral relationships
    const { data: relationships, error: relError } = await supabase
      .from('referral_relationships')
      .select('id, referee_id, activated_at, created_at')
      .eq('referrer_id', session.userId)
      .order('created_at', { ascending: false });

    if (relError) {
      console.error('Error fetching relationships:', relError);
      return { success: false, error: relError.message };
    }

    // 2. Get profiles for all referees
    const refereeIds = relationships?.map((r) => r.referee_id) || [];
    const { data: profiles } =
      refereeIds.length > 0
        ? await supabase
            .from('profiles')
            .select('user_id, username, avatar_url')
            .in('user_id', refereeIds)
        : { data: [] };

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    const totalReferrals = relationships?.length || 0;
    const activeReferrals = relationships?.filter((r) => r.activated_at).length || 0;
    const pendingReferrals = totalReferrals - activeReferrals;

    // 3. Get earnings from referral_ledger (amounts in wei)
    const { data: ledgerEntries } = await supabase
      .from('referral_ledger')
      .select('amount, source_type, status, chain')
      .eq('referrer_id', session.userId);

    let totalEarningsNative = { evm: 0, solana: 0 };
    let claimedEarningsNative = { evm: 0, solana: 0 };
    const earningsBySource: Record<string, number> = {
      FAIRLAUNCH: 0,
      PRESALE: 0,
      BONDING: 0,
      BLUECHECK: 0,
    };

    ledgerEntries?.forEach((entry) => {
      const nativeAmount = weiToNative(entry.amount || '0');
      const chainType = getChainType(entry.chain as string);

      totalEarningsNative[chainType] += nativeAmount;

      if (entry.status === 'CLAIMED') {
        claimedEarningsNative[chainType] += nativeAmount;
      }

      const src = entry.source_type as string;
      if (src in earningsBySource) {
        earningsBySource[src] = (earningsBySource[src] ?? 0) + nativeAmount;
      }
    });

    // 4. Get pending earnings from fee_splits (amounts in wei)
    const { data: feeSplits } = await supabase
      .from('fee_splits')
      .select('referral_pool_amount, chain')
      .eq('processed', false);

    let pendingNative = { evm: 0, solana: 0 };
    feeSplits?.forEach((split) => {
      const nativeAmount = weiToNative(split.referral_pool_amount || '0');
      const chainType = getChainType(split.chain as string);
      pendingNative[chainType] += nativeAmount;
    });

    // 5. Convert to USD
    const evmTotalUsd = totalEarningsNative.evm * prices.bnb;
    const solanaTotalUsd = totalEarningsNative.solana * prices.sol;
    const evmPendingUsd = pendingNative.evm * prices.bnb;
    const solanaPendingUsd = pendingNative.solana * prices.sol;
    const totalEarningsUsd = evmTotalUsd + solanaTotalUsd;
    const pendingEarningsUsd = evmPendingUsd + solanaPendingUsd;
    const claimedEarningsUsd =
      claimedEarningsNative.evm * prices.bnb + claimedEarningsNative.solana * prices.sol;

    const formatUsd = (n: number) =>
      n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // 6. Check Blue Check badge status
    const { data: blueCheck } = await supabase
      .from('blue_check_purchases')
      .select('status')
      .eq('user_id', session.userId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    const hasBlueCheck = !!blueCheck;
    const hasActiveReferral = activeReferrals > 0;

    // 7. Get contribution stats for each referred user
    const referredUsers = await Promise.all(
      (relationships || []).map(async (rel: any) => {
        const { data: contributions } = await supabase
          .from('contributions')
          .select('amount')
          .eq('user_id', rel.referee_id);

        const totalContributions = contributions?.length || 0;
        let contributionAmount = 0;

        contributions?.forEach((c) => {
          contributionAmount += weiToNative(c.amount || '0');
        });

        const profile = profileMap.get(rel.referee_id);

        return {
          userId: rel.referee_id,
          username: profile?.username || `user_${rel.referee_id.substring(0, 6)}`,
          avatarUrl: profile?.avatar_url || undefined,
          status: (rel.activated_at ? 'ACTIVE' : 'PENDING') as 'ACTIVE' | 'PENDING',
          joinedAt: rel.created_at,
          activatedAt: rel.activated_at,
          totalContributions,
          contributionAmount: contributionAmount.toFixed(4),
        };
      })
    );

    return {
      success: true,
      stats: {
        totalReferrals,
        activeReferrals,
        pendingReferrals,
        totalEarningsUsd: formatUsd(totalEarningsUsd),
        pendingEarningsUsd: formatUsd(pendingEarningsUsd),
        claimedEarningsUsd: formatUsd(claimedEarningsUsd),
        evmTotalUsd: formatUsd(evmTotalUsd),
        solanaTotalUsd: formatUsd(solanaTotalUsd),
        evmPendingNative: pendingNative.evm.toFixed(6),
        solanaPendingNative: pendingNative.solana.toFixed(6),
        hasBlueCheck,
        hasActiveReferral,
        earningsBySource: {
          FAIRLAUNCH: formatUsd((earningsBySource.FAIRLAUNCH ?? 0) * prices.bnb),
          PRESALE: formatUsd((earningsBySource.PRESALE ?? 0) * prices.bnb),
          BONDING: formatUsd((earningsBySource.BONDING ?? 0) * prices.sol),
          BLUECHECK: formatUsd((earningsBySource.BLUECHECK ?? 0) * prices.bnb),
        },
        referredUsers,
      },
    };
  } catch (error: any) {
    console.error('getReferralStats error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch referral stats',
    };
  }
}
