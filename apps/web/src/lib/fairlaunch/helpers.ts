/**
 * Fairlaunch Helper Functions
 * Fee calculations, vesting conversion, and utilities
 */

import { parseUnits } from 'viem';

/**
 * Calculate total upfront cost for creating a fairlaunch
 */
export function calculateTotalUpfrontCost(
  network: string,
  tokenSource: 'factory' | 'existing'
): { amount: string; symbol: string } {
  const isBSC = network === 'bnb' || network === 'bsc_testnet';
  const symbol = isBSC ? 'BNB' : 'ETH';
  
  // Deployment fee
  const deploymentFee = isBSC ? 0.2 : 0.1;
  
  // Token creation fee (only if factory)
  const tokenCreationFee = tokenSource === 'factory' 
    ? (isBSC 
        ? 0.2 
        : network === 'base' 
          ? 0.05 
          : 0.01
      )
    : 0;
  
  const total = deploymentFee + tokenCreationFee;
  
  return {
    amount: total.toString(),
    symbol: symbol
  };
}

/**
 * Calculate deployment fee based on network
 */
export function getDeploymentFee(network: string): { amount: string; symbol: string } {
  const isBSC = network === 'bnb' || network === 'bsc_testnet';
  
  return {
    amount: isBSC ? '0.2' : '0.1',
    symbol: isBSC ? 'BNB' : 'ETH'
  };
}

/**
 * Calculate success fee split (5% total)
 */
export function calculateSuccessFeeSplit(totalRaised: string) {
  const raised = parseFloat(totalRaised);
  const platformFee = raised * 0.05; // 5%
  
  return {
    total: platformFee,
    treasury: platformFee * 0.5,       // 2.5% of raised = 50% of fee
    referralPool: platformFee * 0.4,   // 2.0% of raised = 40% of fee
    sbtStaking: platformFee * 0.1,     // 0.5% of raised = 10% of fee
    netRaised: raised - platformFee    // 95%
  };
}

/**
 * Calculate distribution breakdown
 */
export function calculateDistribution(params: {
  totalRaised: string;
  tokensForSale: string;
  liquidityPercent: number;
}) {
  const { totalRaised, tokensForSale, liquidityPercent } = params;
  
  const raised = parseFloat(totalRaised);
  const tokens = parseFloat(tokensForSale);
  
  // Platform fee (5%)
  const platformFee = raised * 0.05;
  const netRaised = raised - platformFee;
  
  // CRITICAL: Factory contract calculates liquidity tokens as percentage of tokensForSale
  // NOT from raised funds!
  const liquidityTokens = tokens * (liquidityPercent / 100);
  const liquidityFunds = netRaised * (liquidityPercent / 100);
  
  // Project owner gets remainder
  const ownerFunds = netRaised - liquidityFunds;
  
  return {
    platformFee: {
      total: platformFee,
      treasury: platformFee * 0.5,
      referralPool: platformFee * 0.4,
      sbtStaking: platformFee * 0.1,
    },
    netRaised,
    liquidity: {
      funds: liquidityFunds,
      tokens: liquidityTokens,
      percent: liquidityPercent,
    },
    projectOwner: {
      funds: ownerFunds,
      percent: 100 - liquidityPercent,
    },
  };
}

/**
 * Calculate total tokens required for escrow deposit
 * Includes: tokensForSale + liquidityTokens + teamVestingTokens
 */
export function calculateTotalTokensRequired(params: {
  tokensForSale: string;
  teamVestingTokens: string;
  softcap: string;
  liquidityPercent: number;
  listingPremiumBps?: number;
}): number {
  const tokensForSale = parseFloat(params.tokensForSale);
  const teamVesting = parseFloat(params.teamVestingTokens) || 0;
  
  // CRITICAL: Factory contract calculates liquidity as percentage of tokensForSale
  // liquidityTokens = tokensForSale * (liquidityPercent / 100)
  // NOT from raised funds!
  const liquidityTokens = tokensForSale * (params.liquidityPercent / 100);
  
  return tokensForSale + Math.ceil(liquidityTokens) + teamVesting;
}

/**
 * Convert UI vesting schedule to smart contract format
 */
export interface VestingScheduleUI {
  month: number;
  percentage: number;
}

export interface TeamVestingParams {
  beneficiary: string;
  startTime: number;
  durations: number[];
  amounts: bigint[];
}

export function convertVestingForSC(
  schedule: VestingScheduleUI[],
  totalAllocation: string,
  saleEndTime: number,
  beneficiary: string,
  tokenDecimals: number = 18 // ✅ NEW: Token decimals for proper conversion
): TeamVestingParams {
  // ✅ FIXED: Use parseUnits to properly convert human-readable amount to base units
  const totalAllocationBigInt = parseUnits(totalAllocation, tokenDecimals);
  
  // Convert months to seconds (30 days per month)
  const SECONDS_PER_MONTH = 30 * 24 * 60 * 60;
  
  const durations = schedule.map(s => s.month * SECONDS_PER_MONTH);
  
  // Calculate token amounts based on percentages
  // Use basis points (multiply by 100) to avoid decimals, then divide by 10000
  const amounts = schedule.map(s => {
    // Convert percentage to basis points (e.g., 8.33 -> 833)
    const basisPoints = Math.round(s.percentage * 100);
    return (totalAllocationBigInt * BigInt(basisPoints)) / 10000n;
  });
  
  return {
    beneficiary,
    startTime: saleEndTime,
    durations,
    amounts,
  };
}

/**
 * Vesting schedule presets
 */
export function getVestingPreset(presetName: string): VestingScheduleUI[] {
  const presets: Record<string, VestingScheduleUI[]> = {
    'linear-12m': Array.from({ length: 12 }, (_, i) => ({
      month: i,
      percentage: Math.round(100 / 12 * 100) / 100,
    })),
    
    'cliff-6m': [
      { month: 6, percentage: 20 },
      ...Array.from({ length: 12 }, (_, i) => ({
        month: 6 + i + 1,
        percentage: Math.round((80 / 12) * 100) / 100,
      })),
    ],
    
    'standard': [
      { month: 0, percentage: 20 },  // 20% TGE
      ...Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        percentage: Math.round((80 / 12) * 100) / 100,
      })),
    ],
  };
  
  return presets[presetName] || [];
}

/**
 * Calculate unlock date for LP tokens
 */
export function calculateUnlockDate(endTime: string, lockMonths: number): string {
  const endDate = new Date(endTime);
  const unlockDate = new Date(endDate);
  unlockDate.setMonth(unlockDate.getMonth() + lockMonths);
  
  return unlockDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Calculate duration in days
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Estimate price at softcap
 */
export function estimatePriceAtSoftcap(params: {
  softcap: string;
  tokensForSale: string;
}): string {
  const { softcap, tokensForSale } = params;
  
  const softcapNum = parseFloat(softcap);
  const tokensNum = parseFloat(tokensForSale);
  
  if (tokensNum === 0) return '0';
  
  const price = softcapNum / tokensNum;
  return price.toFixed(10); // High precision for small values
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number | string): string {
  const numValue = typeof num === 'string' ? parseFloat(num) : num;
  return numValue.toLocaleString('en-US');
}

/**
 * Validate wallet address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
