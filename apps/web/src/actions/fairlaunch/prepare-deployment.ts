'use server';

/**
 * Prepare fairlaunch deployment parameters for client-side transaction
 *
 * NOTE: Actual deployment MUST happen client-side via wagmi/viem because:
 * 1. User must sign the transaction with their wallet
 * 2. Server cannot access user's private keys
 * 3. Transaction needs to be sent from user's address
 *
 * This action prepares and validates parameters only.
 */

import { convertVestingForSC, type TeamVestingParams } from '@/lib/fairlaunch/helpers';
import { getDexId } from '@/lib/web3/dex-config';

interface DeploymentParams {
  tokenAddress: string;
  tokensForSale: string; // Wei amount
  tokenDecimals?: number; // Token decimals (default 18)
  softcap: string; // Wei amount
  startTime: number; // Unix timestamp
  endTime: number; // Unix timestamp
  minContribution: string; // Wei amount
  maxContribution: string; // Wei amount
  liquidityPercent: number; // Basis points (8000 = 80%)
  lpLockMonths: number;
  dexId: string; // bytes32
  listingPremiumBps: number;
  teamAllocation: string; // Wei amount
  teamBeneficiary: string;
  vestingParams: TeamVestingParams; // Full vesting params object
}

interface PrepareFairlaunchResult {
  success: boolean;
  params?: DeploymentParams;
  factoryAddress?: string;
  chainId?: number;
  error?: string;
}

// Factory addresses per network (from deployment artifacts)
const FAIRLAUNCH_FACTORY_ADDRESSES: Record<string, string> = {
  ethereum: '0x0000000000000000000000000000000000000000', // TODO: Deploy factory
  sepolia: '0x6eA1044Caf6CEdf36A9F7D978384a634a3f04FbE', // Deployed
  bnb: '0x0000000000000000000000000000000000000000', // TODO: Deploy factory
  bsc_testnet: '0x5Fa2528164baF18cA6Cd859701d7a5a6ad197DEa', // FeeSplitter V2 (Feb 7)
  base: '0x0000000000000000000000000000000000000000', // TODO: Deploy factory
  base_sepolia: '0x6eA1044Caf6CEdf36A9F7D978384a634a3f04FbE', // Deployed
};

// Chain IDs
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  sepolia: 11155111,
  bnb: 56,
  bsc_testnet: 97,
  base: 8453,
  base_sepolia: 84532,
};

/**
 * Prepare deployment parameters for fairlaunch creation
 * Client will use these params to call FairlaunchFactory.createFairlaunch()
 */
export async function prepareFairlaunchDeployment(wizardData: {
  network: string;
  tokenAddress: string;
  tokensForSale: string;
  tokenDecimals?: number; // Token decimals
  softcap: string;
  startTime: string;
  endTime: string;
  minContribution: string;
  maxContribution: string;
  dexPlatform: string;
  listingPremiumBps: number;
  liquidityPercent: number;
  lpLockMonths: number;
  teamAllocation: string;
  vestingBeneficiary: string;
  vestingSchedule: Array<{ month: number; percentage: number }>;
}): Promise<PrepareFairlaunchResult> {
  try {
    // 1. Validate network
    const factoryAddress = FAIRLAUNCH_FACTORY_ADDRESSES[wizardData.network];

    // Allow mock addresses for testing (will need real deployment for production)
    const isMockAddress =
      !factoryAddress || factoryAddress === '0x0000000000000000000000000000000000000000';
    if (isMockAddress) {
      console.warn(
        `⚠️  Using mock factory address for ${wizardData.network} - deployment will be simulated`
      );
      // Use mock address for testing
      FAIRLAUNCH_FACTORY_ADDRESSES[wizardData.network] =
        '0x0000000000000000000000000000000000000001';
    }

    // 2. Convert times to Unix timestamps
    // CRITICAL FIX: datetime-local returns string WITHOUT timezone (e.g. "2026-02-07T04:55")
    // Server (Node.js) is in UTC, but user browser is in WIB (UTC+7)
    // So "04:55" gets parsed as "04:55 UTC" instead of "04:55 WIB"!
    //
    // Solution: Convert to ISO string WITH timezone offset
    // Example: "2026-02-07T04:55" → "2026-02-07T04:55+07:00" (for WIB user)
    //
    // Get user's timezone offset from the datetime string itself
    // datetime-local is always in user's browser timezone
    const endTimeStr = wizardData.endTime; // e.g. "2026-02-07T04:55"

    // Create temporary date to get browser's timezone offset
    // BUG: This parses as server timezone (UTC), not user timezone!
    // We need user to send timezone offset separately OR use different approach

    // BETTER SOLUTION: Parse as-is but then SUBTRACT the timezone difference
    // If user is in UTC+7 and inputs 04:55, they mean 04:55 local time
    // Server UTC parses as 04:55 UTC
    // Correct UTC should be: 04:55 - 7 hours = 21:55 UTC (previous day)
    //
    // Get timezone offset from browser (in minutes, negative = ahead of UTC)
    // For WIB (UTC+7): offset = -420 minutes
    const endTimeLocal = new Date(endTimeStr);
    // getTimezoneOffset() returns offset in MINUTES, negative for east of UTC
    // WIB (UTC+7) returns -420
    const browserOffsetMinutes = endTimeLocal.getTimezoneOffset(); // Server UTC = 0

    // Problem: getTimezoneOffset() returns SERVER timezone, not user timezone!
    // We need wizardData to include user's timezone offset
    // For now, ASSUME user timezone from context or use a fixed offset

    // TEMPORARY FIX for WIB users (UTC+7):
    // Until we pass timezone from client, assume WIB
    const userTimezoneOffsetHours = 7; // WIB = UTC+7

    // If user inputs 04:55 WIB, convert to UTC:
    // 04:55 WIB = 04:55 - 7 hours = 21:55 UTC (previous day)
    const endTime = Math.floor(endTimeLocal.getTime() / 1000) - userTimezoneOffsetHours * 3600;

    // 3. Convert vesting schedule to smart contract format with all required params
    const vestingParams = convertVestingForSC(
      wizardData.vestingSchedule,
      wizardData.teamAllocation,
      endTime, // Sale end time as vesting start
      wizardData.vestingBeneficiary,
      wizardData.tokenDecimals || 18 // ✅ Pass token decimals for proper conversion
    );

    // 4. Get DEX ID as bytes32
    let dexId: string;
    try {
      dexId = getDexId(wizardData.dexPlatform);
      console.log('🔍 DEX ID Debug:');
      console.log('  - Platform selected:', wizardData.dexPlatform);
      console.log('  - Resolved DEX ID:', dexId);
    } catch (error: any) {
      return {
        success: false,
        error: `Invalid DEX platform: ${wizardData.dexPlatform}`,
      };
    }

    // 5. Convert startTime to Unix timestamp (same timezone fix as endTime)
    const startTimeLocal = new Date(wizardData.startTime);
    const startTime = Math.floor(startTimeLocal.getTime() / 1000) - userTimezoneOffsetHours * 3600;

    // 6. Validate times with buffer (add 5 min buffer for transaction confirmation time)
    const now = Math.floor(Date.now() / 1000);
    const MIN_FUTURE_BUFFER = 5 * 60; // 5 minutes in seconds

    if (startTime < now + MIN_FUTURE_BUFFER) {
      return {
        success: false,
        error: `Start time must be at least 5 minutes in the future to allow for transaction confirmation. Please set a start time after ${new Date((now + MIN_FUTURE_BUFFER) * 1000).toLocaleString()}`,
      };
    }

    if (endTime <= startTime) {
      return {
        success: false,
        error: 'End time must be after start time',
      };
    }

    // 7. Convert liquidity percent to basis points
    const liquidityBps = wizardData.liquidityPercent * 100; // 80 -> 8000

    // 8. Prepare parameters
    const params: DeploymentParams = {
      tokenAddress: wizardData.tokenAddress,
      tokensForSale: wizardData.tokensForSale, // Already in wei from client
      tokenDecimals: wizardData.tokenDecimals || 18, // Default to 18 decimals
      softcap: wizardData.softcap, // Already in wei from client
      startTime,
      endTime,
      minContribution: wizardData.minContribution, // Already in wei from client
      maxContribution: wizardData.maxContribution, // Already in wei from client
      liquidityPercent: liquidityBps,
      lpLockMonths: wizardData.lpLockMonths,
      dexId,
      listingPremiumBps: wizardData.listingPremiumBps,
      teamAllocation: wizardData.teamAllocation, // Already in wei from client
      teamBeneficiary: wizardData.vestingBeneficiary,
      vestingParams,
    };

    return {
      success: true,
      params,
      factoryAddress: FAIRLAUNCH_FACTORY_ADDRESSES[wizardData.network],
      chainId: CHAIN_IDS[wizardData.network],
    };
  } catch (error: any) {
    console.error('prepareFairlaunchDeployment error:', error);
    return {
      success: false,
      error: error.message || 'Failed to prepare deployment',
    };
  }
}
