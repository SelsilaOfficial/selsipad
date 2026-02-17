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
 *
 * Referral counts are derived from BOTH:
 * - referral_relationships (explicit sign-up via ref link)
 * - referral_ledger (unique referee_ids who generated earnings)
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

    // 1. Get referral_relationships (explicit sign-ups via ref link)
    const { data: relationships, error: relError } = await supabase
      .from('referral_relationships')
      .select('id, referee_id, activated_at, created_at')
      .eq('referrer_id', session.userId)
      .order('created_at', { ascending: false });

    if (relError) {
      console.error('Error fetching relationships:', relError);
      return { success: false, error: relError.message };
    }

    // 2. Get earnings from referral_ledger (amounts in wei)
    const { data: ledgerEntries } = await supabase
      .from('referral_ledger')
      .select('amount, source_type, status, chain, referee_id, created_at')
      .eq('referrer_id', session.userId);

    // 3. Build a MERGED set of unique referees from both sources
    //    referral_relationships tracks sign-ups, referral_ledger tracks earnings
    const refereeMap = new Map<
      string,
      {
        fromRelationship: boolean;
        activated_at: string | null;
        created_at: string;
        totalEarningsWei: number;
        contributionCount: number;
      }
    >();

    // Add from referral_relationships
    (relationships || []).forEach((rel: any) => {
      refereeMap.set(rel.referee_id, {
        fromRelationship: true,
        activated_at: rel.activated_at,
        created_at: rel.created_at,
        totalEarningsWei: 0,
        contributionCount: 0,
      });
    });

    // Add from referral_ledger (may add new referees not in relationships)
    let totalEarningsNative = { evm: 0, solana: 0 };
    let claimedEarningsNative = { evm: 0, solana: 0 };
    let pendingNative = { evm: 0, solana: 0 };
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
      } else {
        pendingNative[chainType] += nativeAmount;
      }

      const src = entry.source_type as string;
      if (src in earningsBySource) {
        earningsBySource[src] = (earningsBySource[src] ?? 0) + nativeAmount;
      }

      // Track per-referee earnings
      if (entry.referee_id) {
        const existing = refereeMap.get(entry.referee_id);
        if (existing) {
          existing.totalEarningsWei += Number(entry.amount || 0);
          existing.contributionCount += 1;
        } else {
          // New referee not in referral_relationships — they contributed with the ref code
          refereeMap.set(entry.referee_id, {
            fromRelationship: false,
            activated_at: entry.created_at, // They're active since they contributed
            created_at: entry.created_at,
            totalEarningsWei: Number(entry.amount || 0),
            contributionCount: 1,
          });
        }
      }
    });

    // 4. Compute counts from merged refereeMap
    const totalReferrals = refereeMap.size;
    let activeReferrals = 0;
    refereeMap.forEach((info) => {
      if (info.activated_at || info.contributionCount > 0) {
        activeReferrals++;
      }
    });
    const pendingReferrals = totalReferrals - activeReferrals;

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

    // 7. Get profiles for all referees (from merged map)
    const allRefereeIds = Array.from(refereeMap.keys());
    const { data: profiles } =
      allRefereeIds.length > 0
        ? await supabase
            .from('profiles')
            .select('user_id, username, avatar_url')
            .in('user_id', allRefereeIds)
        : { data: [] };

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    // 8. Build referred users list from merged refereeMap
    const referredUsers = await Promise.all(
      allRefereeIds.map(async (refereeId) => {
        const info = refereeMap.get(refereeId)!;
        const profile = profileMap.get(refereeId);

        // Get contribution count from DB
        const { data: contributions } = await supabase
          .from('contributions')
          .select('amount')
          .eq('user_id', refereeId);

        let totalContributions = contributions?.length || 0;
        let contributionAmountNative = 0;

        contributions?.forEach((c) => {
          contributionAmountNative += weiToNative(c.amount || '0');
        });

        // Also check for Blue Check purchase
        const { data: bcProfile } = await supabase
          .from('profiles')
          .select('bluecheck_status')
          .eq('user_id', refereeId)
          .single();

        if (bcProfile?.bluecheck_status === 'ACTIVE') {
          totalContributions += 1;
        }

        // Calculate reward amount from ledger entries for this referee
        const refereeEarnings = weiToNative(String(info.totalEarningsWei));

        const isActive = !!(info.activated_at || info.contributionCount > 0);

        return {
          userId: refereeId,
          username: profile?.username || `user_${refereeId.substring(0, 6)}`,
          avatarUrl: profile?.avatar_url || undefined,
          status: (isActive ? 'ACTIVE' : 'PENDING') as 'ACTIVE' | 'PENDING',
          joinedAt: info.created_at,
          activatedAt: info.activated_at || undefined,
          totalContributions,
          contributionAmount: (contributionAmountNative > 0
            ? contributionAmountNative
            : refereeEarnings
          ).toFixed(4),
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
