/**
 * Vesting Claim Utils (Stub)
 * TODO: Implement actual vesting claim utilities
 */

export interface VestingAllocation {
  id: string;
  user_id: string;
  schedule_id: string;
  total_tokens: string;
  claimed_tokens: string;
  total_claims: number;
  last_claim_at: string | null;
  [key: string]: any;
}

export interface VestingSchedule {
  id: string;
  tge_percentage: number;
  tge_at: string;
  cliff_months: number;
  vesting_months: number;
  interval_type: string;
  chain: string;
  [key: string]: any;
}

export interface ClaimableResult {
  claimable: bigint;
  claimableFormatted: string;
  nextUnlock: {
    amountFormatted: string;
    unlockAt: Date | null;
    daysUntil: number;
  } | null;
  vestingProgress: {
    total: bigint;
    claimed: bigint;
    unlocked: bigint;
    locked: bigint;
    percentUnlocked: number;
  };
}

export function calculateClaimableAmount(
  allocation: VestingAllocation,
  schedule: VestingSchedule
): ClaimableResult {
  // Stub implementation - returns zero claimable
  const total = BigInt(allocation.total_tokens || '0');
  const claimed = BigInt(allocation.claimed_tokens || '0');

  return {
    claimable: 0n,
    claimableFormatted: '0',
    nextUnlock: null,
    vestingProgress: {
      total,
      claimed,
      unlocked: 0n,
      locked: total - claimed,
      percentUnlocked: 0,
    },
  };
}

export function generateClaimIdempotencyKey(allocationId: string): string {
  const hourBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  return `VESTING_CLAIM:${allocationId}:${hourBucket}`;
}

export async function getClaimableAmount(allocationId: string) {
  // Stub implementation
  return '0';
}

export async function processClaim(allocationId: string, userAddress: string) {
  // Stub implementation
  throw new Error('Not implemented');
}
