/**
 * FASE 4: Pool Utility Functions
 * Helper functions for pool calculations and status checks
 */

import type {
  LaunchRound,
  PoolType,
  PoolStatus,
  PoolResult,
  PresaleParams,
  FairlaunchParams,
  PoolStatistics,
  PoolEligibilityCheck,
} from '../types/fase4';

// ============================================
// Pool Status Checks
// ============================================

/**
 * Check if pool is currently live
 */
export function isPoolLive(pool: LaunchRound): boolean {
  const now = new Date();
  const startAt = new Date(pool.start_at);
  const endAt = new Date(pool.end_at);

  return pool.status === 'LIVE' && now >= startAt && now < endAt;
}

/**
 * Check if pool has ended
 */
export function isPoolEnded(pool: LaunchRound): boolean {
  const now = new Date();
  const endAt = new Date(pool.end_at);

  return now >= endAt || pool.status === 'ENDED' || pool.status === 'FINALIZED';
}

/**
 * Check if pool can be finalized
 */
export function canFinalize(pool: LaunchRound): boolean {
  return pool.status === 'ENDED' && pool.result === 'NONE';
}

/**
 * Check if pool is in draft state (editable)
 */
export function isPoolDraft(pool: LaunchRound): boolean {
  return pool.status === 'DRAFT';
}

/**
 * Check if pool can be submitted
 */
export function canSubmit(pool: LaunchRound): boolean {
  return pool.status === 'DRAFT';
}

/**
 * Check if contributions are allowed
 */
export function canContribute(pool: LaunchRound): boolean {
  return isPoolLive(pool);
}

// ============================================
// Pool Calculations
// ============================================

/**
 * Calculate presale allocation for a contribution
 */
export function calculatePresaleAllocation(
  contributedAmount: number,
  params: PresaleParams
): number {
  return contributedAmount / params.price;
}

/**
 * Calculate fairlaunch allocation for a contribution
 */
export function calculateFairlaunchAllocation(
  contributedAmount: number,
  totalRaised: number,
  params: FairlaunchParams
): number {
  if (totalRaised === 0) return 0;

  // User's share of total contributions
  const sharePercentage = contributedAmount / totalRaised;

  // Multiply by total tokens for sale
  return params.token_for_sale * sharePercentage;
}

/**
 * Calculate fairlaunch final price
 */
export function calculateFairlaunchFinalPrice(
  totalRaised: number,
  params: FairlaunchParams
): number {
  if (params.token_for_sale === 0) return 0;
  return totalRaised / params.token_for_sale;
}

/**
 * Calculate listing price (for fairlaunch with premium)
 */
export function calculateListingPrice(finalPrice: number, listingPremiumBps: number = 0): number {
  return finalPrice * (1 + listingPremiumBps / 10000);
}

/**
 * Calculate pool progress percentage (for presale)
 */
export function calculatePoolProgress(pool: LaunchRound): number {
  if (pool.type !== 'PRESALE') return 0;

  const params = pool.params as PresaleParams;
  if (params.hardcap === 0) return 0;

  return Math.min((pool.total_raised / params.hardcap) * 100, 100);
}

/**
 * Calculate softcap progress percentage
 */
export function calculateSoftcapProgress(pool: LaunchRound): number {
  const softcap =
    pool.type === 'PRESALE'
      ? (pool.params as PresaleParams).softcap
      : (pool.params as FairlaunchParams).softcap;

  if (softcap === 0) return 0;

  return Math.min((pool.total_raised / softcap) * 100, 100);
}

// ============================================
// Pool Time Calculations
// ============================================

/**
 * Get time remaining until pool ends (in seconds)
 */
export function getTimeRemaining(pool: LaunchRound): number | null {
  const now = new Date();
  const endAt = new Date(pool.end_at);

  if (now >= endAt) return null;

  return Math.floor((endAt.getTime() - now.getTime()) / 1000);
}

/**
 * Get time until pool starts (in seconds)
 */
export function getTimeUntilStart(pool: LaunchRound): number | null {
  const now = new Date();
  const startAt = new Date(pool.start_at);

  if (now >= startAt) return null;

  return Math.floor((startAt.getTime() - now.getTime()) / 1000);
}

/**
 * Get pool time status
 */
export function getPoolTimeStatus(pool: LaunchRound): 'upcoming' | 'live' | 'ended' {
  const now = new Date();
  const startAt = new Date(pool.start_at);
  const endAt = new Date(pool.end_at);

  if (now < startAt) return 'upcoming';
  if (now >= startAt && now < endAt) return 'live';
  return 'ended';
}

// ============================================
// Pool Statistics
// ============================================

/**
 * Generate pool statistics
 */
export function getPoolStatistics(pool: LaunchRound): PoolStatistics {
  const timeStatus = getPoolTimeStatus(pool);
  const timeRemainingSeconds = getTimeRemaining(pool);

  let pricePerToken = 0;
  if (pool.type === 'PRESALE') {
    pricePerToken = (pool.params as PresaleParams).price;
  } else if (pool.type === 'FAIRLAUNCH') {
    const params = pool.params as FairlaunchParams;
    pricePerToken = params.final_price || calculateFairlaunchFinalPrice(pool.total_raised, params);
  }

  const averageContribution =
    pool.total_participants > 0 ? pool.total_raised / pool.total_participants : 0;

  const progressPercentage = calculatePoolProgress(pool);

  return {
    total_raised: pool.total_raised,
    total_participants: pool.total_participants,
    average_contribution: averageContribution,
    progress_percentage: progressPercentage,
    price_per_token: pricePerToken,
    time_status: timeStatus,
    time_remaining_seconds: timeRemainingSeconds,
  };
}

// ============================================
// Pool Eligibility Checks
// ============================================

/**
 * Check if project is eligible to create a pool
 */
export function checkPoolEligibility(project: {
  kyc_status: string;
  sc_scan_status: string;
}): PoolEligibilityCheck {
  const kycVerified = project.kyc_status === 'VERIFIED';
  const scScanPassed = project.sc_scan_status === 'PASSED';

  const checks = {
    kyc_verified: kycVerified,
    sc_scan_passed: scScanPassed,
    pool_live: true, // Not applicable for creation
    wallet_connected: true, // Checked client-side
  };

  const reasons: string[] = [];
  if (!kycVerified) reasons.push('KYC verification required');
  if (!scScanPassed) reasons.push('Smart contract scan must pass');

  return {
    is_eligible: kycVerified && scScanPassed,
    reasons,
    checks,
  };
}

/**
 * Check if user can contribute to pool
 */
export function checkContributionEligibility(
  pool: LaunchRound,
  userContributed: number = 0,
  contributionAmount: number = 0
): PoolEligibilityCheck {
  const poolLive = isPoolLive(pool);
  const walletConnected = true; // Assumed - checked client-side

  const reasons: string[] = [];
  const checks: PoolEligibilityCheck['checks'] = {
    kyc_verified: true, // User KYC not required by default
    sc_scan_passed: true, // Pool already passed during creation
    pool_live: poolLive,
    wallet_connected: walletConnected,
  };

  if (!poolLive) {
    reasons.push('Pool is not currently live');
  }

  // Check contribution limits for presale
  if (pool.type === 'PRESALE') {
    const params = pool.params as PresaleParams;

    if (params.min_contribution) {
      const minMet = contributionAmount >= params.min_contribution;
      checks.min_contribution_met = minMet;
      if (!minMet) {
        reasons.push(`Minimum contribution is ${params.min_contribution}`);
      }
    }

    if (params.max_contribution) {
      const newTotal = userContributed + contributionAmount;
      const maxNotExceeded = newTotal <= params.max_contribution;
      checks.max_contribution_not_exceeded = maxNotExceeded;
      if (!maxNotExceeded) {
        reasons.push(`Maximum contribution is ${params.max_contribution}`);
      }
    }
  }

  const isEligible = poolLive && reasons.length === 0;

  return {
    is_eligible: isEligible,
    reasons,
    checks,
  };
}

// ============================================
// Pool Finalization Logic
// ============================================

/**
 * Determine pool result based on total raised
 */
export function determinePoolResult(pool: LaunchRound): PoolResult {
  const softcap =
    pool.type === 'PRESALE'
      ? (pool.params as PresaleParams).softcap
      : (pool.params as FairlaunchParams).softcap;

  if (pool.total_raised >= softcap) {
    return 'SUCCESS';
  }

  return 'FAILED';
}

/**
 * Check if pool reached softcap
 */
export function reachedSoftcap(pool: LaunchRound): boolean {
  return determinePoolResult(pool) === 'SUCCESS';
}

// ============================================
// Pool Formatting Helpers
// ============================================

/**
 * Format pool status for display
 */
export function formatPoolStatus(status: PoolStatus): string {
  const statusMap: Partial<Record<PoolStatus, string>> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Pending Review',
    APPROVED: 'Approved',
    LIVE: 'Live',
    ENDED: 'Ended',
    FINALIZED: 'Finalized',
    REJECTED: 'Rejected',
  };

  return statusMap[status] || status;
}

/**
 * Format pool result for display
 */
export function formatPoolResult(result: PoolResult): string {
  const resultMap: Record<PoolResult, string> = {
    NONE: 'Pending',
    SUCCESS: 'Success',
    FAILED: 'Failed',
    CANCELED: 'Canceled',
  };

  return resultMap[result] || result;
}

/**
 * Format pool type for display
 */
export function formatPoolType(type: PoolType): string {
  return type === 'PRESALE' ? 'Presale' : 'Fairlaunch';
}

/**
 * Get pool status color for UI
 */
export function getPoolStatusColor(status: PoolStatus): string {
  const colorMap: Partial<Record<PoolStatus, string>> = {
    DRAFT: 'gray',
    SUBMITTED: 'yellow',
    APPROVED: 'blue',
    LIVE: 'green',
    ENDED: 'orange',
    FINALIZED: 'purple',
    REJECTED: 'red',
  };

  return colorMap[status] || 'gray';
}
