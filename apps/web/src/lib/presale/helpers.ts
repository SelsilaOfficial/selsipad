/**
 * Presale Helper Functions
 * Token calculation utilities for presale escrow deposits
 */

/**
 * Calculate total tokens required for presale escrow deposit.
 *
 * Formula (matches PresaleFactory.sol + PresaleRound.sol):
 *   totalEscrow = tokensForSale + lpTokens + teamVestingTokens
 *
 * Where:
 *   lpTokens = tokensForSale × (lpLockPercentage / 100)
 *
 * Note: If presale only reaches softcap (not hardcap), unsold tokens
 * are automatically burned on-chain by PresaleRound.finalizeSuccess().
 */
export function calculatePresaleEscrowTokens(params: {
  tokensForSale: string;
  teamVestingTokens: string;
  lpLockPercentage: number;
}): number {
  const tokensForSale = parseFloat(params.tokensForSale);
  const teamVesting = parseFloat(params.teamVestingTokens) || 0;

  // LP tokens = percentage of tokens for sale allocated for DEX liquidity
  const lpTokens = tokensForSale * (params.lpLockPercentage / 100);

  return tokensForSale + Math.ceil(lpTokens) + teamVesting;
}

/**
 * Get escrow breakdown for display in UI
 */
export function getEscrowBreakdown(params: {
  tokensForSale: string;
  teamVestingTokens: string;
  lpLockPercentage: number;
}): {
  sale: number;
  lp: number;
  team: number;
  total: number;
} {
  const sale = parseFloat(params.tokensForSale);
  const team = parseFloat(params.teamVestingTokens) || 0;
  const lp = sale * (params.lpLockPercentage / 100);
  const total = sale + Math.ceil(lp) + team;

  return { sale, lp: Math.ceil(lp), team, total };
}
