/**
 * Fairlaunch Contract Integration Utilities
 * Handles contract interactions for Fairlaunch deployment and management
 */

import { encodeFunctionData, parseEther, type Address } from 'viem';
import FairlaunchFactoryABI from './abis/FairlaunchFactory.json';
import FairlaunchABI from './abis/Fairlaunch.json';
import TeamVestingABI from './abis/TeamVesting.json';

// ===== CONTRACT ADDRESSES =====
// These will be updated after testnet/mainnet deployment
export const FACTORY_ADDRESSES: Record<string, Address> = {
  localhost: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // Local Hardhat
  ethereum: '0x0000000000000000000000000000000000000000', // TBD
  bnb: '0x0000000000000000000000000000000000000000',      // TBD
  base: '0x0000000000000000000000000000000000000000',     // TBD
  sepolia: '0x6eA1044Caf6CEdf36A9F7D978384a634a3f04FbE',  // ✅ Deployed 2026-01-29
  bsc_testnet: '0x10250DAee0baB6bf0f776Ad17b11E09dA9dB2B81', // ✅ Deployed 2026-02-01 (Fixed LP calc)
  base_sepolia: '0x6eA1044Caf6CEdf36A9F7D978384a634a3f04FbE', // ✅ Deployed 2026-01-29
} as const;

// ===== TYPE DEFINITIONS =====

export interface CreateFairlaunchParams {
  projectToken: Address;
  paymentToken: Address; // address(0) for native
  softcap: bigint;
  tokensForSale: bigint;
  minContribution: bigint;
  maxContribution: bigint;
  startTime: bigint;
  endTime: bigint;
  projectOwner: Address;
  listingPremiumBps: number;
}

export interface TeamVestingParams {
  beneficiary: Address;
  startTime: bigint;
  durations: bigint[];
  amounts: bigint[];
}

export interface LPLockPlan {
  lockMonths: bigint;
  liquidityPercent: bigint;
  dexId: `0x${string}`;
}

// ===== NETWORK CONFIGURATIONS =====

/**
 * Payment token addresses by network
 */
const PAYMENT_TOKEN_ADDRESSES: Record<string, Record<string, Address>> = {
  ethereum: {
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  bnb: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
  base: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  sepolia: {
    USDT: '0x0000000000000000000000000000000000000000', // Mock
    USDC: '0x0000000000000000000000000000000000000000', // Mock
  },
  bsc_testnet: {
    USDT: '0x0000000000000000000000000000000000000000', // Mock
    USDC: '0x0000000000000000000000000000000000000000', // Mock
  },
};

/**
 * DEX IDs (bytes32 encoded)
 */
const DEX_IDS: Record<string, `0x${string}`> = {
  pancakeswap: '0x70616e63616b6573776170000000000000000000000000000000000000000000',
  uniswap: '0x756e697377617000000000000000000000000000000000000000000000000000',
  'uniswap-v3': '0x756e69737761702d76330000000000000000000000000000000000000000000',
};

/**
 * Deployment fees by network (in native token)
 */
const DEPLOYMENT_FEES: Record<string, bigint> = {
  localhost: parseEther('0.01'),    // Local testing
  ethereum: parseEther('0.1'),
  bnb: parseEther('0.2'),
  base: parseEther('0.05'),
  sepolia: parseEther('0.01'), // Testnet
  bsc_testnet: parseEther('0.2'), // Testnet - Matches deployed contract
  base_sepolia: parseEther('0.005'), // Testnet
};

// ===== HELPER FUNCTIONS =====

/**
 * Get payment token address for network
 */
export function getPaymentTokenAddress(token: string, network: string): Address {
  if (token === 'NATIVE') {
    return '0x0000000000000000000000000000000000000000';
  }
  
  const address = PAYMENT_TOKEN_ADDRESSES[network]?.[token];
  if (!address) {
    throw new Error(`Payment token ${token} not supported on ${network}`);
  }
  
  return address;
}

/**
 * Get DEX ID (bytes32)
 */
export function getDexId(platform: string): `0x${string}` {
  const normalized = platform.toLowerCase();
  const dexId = DEX_IDS[normalized];
  
  if (!dexId) {
    // Default to pancakeswap
    return DEX_IDS.pancakeswap!;
  }
  
  return dexId;
}

/**
 * Get deployment fee for network
 */
export function getDeploymentFee(network: string): bigint {
  return DEPLOYMENT_FEES[network] || parseEther('0.1');
}

// ===== MAIN PARSER =====

/**
 * Parse wizard data to contract parameters
 */
export function parseWizardDataToContractParams(wizardData: any, walletAddress: Address): {
  params: CreateFairlaunchParams;
  vestingParams: TeamVestingParams;
  lpPlan: LPLockPlan;
  deploymentFee: bigint;
} {
  const network = wizardData.basics?.network || 'ethereum';

  // Parse CreateFairlaunchParams struct
  const params: CreateFairlaunchParams = {
    projectToken: wizardData.params?.token_address as Address,
    paymentToken: getPaymentTokenAddress(
      wizardData.params?.payment_token || 'NATIVE',
      network
    ),
    softcap: parseEther(wizardData.params?.softcap || '1'),
    tokensForSale: parseEther(wizardData.params?.tokens_for_sale || '1000000'),
    minContribution: parseEther(wizardData.params?.min_contribution || '0.01'),
    maxContribution: parseEther(wizardData.params?.max_contribution || '10'),
    startTime: BigInt(Math.floor(new Date(wizardData.params?.start_at).getTime() / 1000)),
    endTime: BigInt(Math.floor(new Date(wizardData.params?.end_at).getTime() / 1000)),
    projectOwner: walletAddress,
    listingPremiumBps: 1000, // 10% default
  };

  // Parse TeamVestingParams struct
  const vestingSchedule = wizardData.vesting?.schedule || [];
  const teamAllocation = wizardData.vesting?.team_allocation || '0';
  
  const vestingParams: TeamVestingParams = {
    beneficiary: walletAddress,
    startTime: params.endTime, // Start vesting after fairlaunch ends
    durations: vestingSchedule.map((s: any) => BigInt(s.month * 30 * 24 * 3600)),
    amounts: vestingSchedule.map((s: any) => 
      (parseEther(teamAllocation) * BigInt(s.percentage)) / 100n
    ),
  };

  // Parse LPLockPlan struct
  const lpPlan: LPLockPlan = {
    lockMonths: BigInt(wizardData.liquidity?.lp_lock_months || 12),
    // Convert percentage (70) to basis points (7000) if needed
    liquidityPercent: BigInt(
      wizardData.liquidity?.liquidity_percent 
        ? (wizardData.liquidity.liquidity_percent < 1000 
            ? wizardData.liquidity.liquidity_percent * 100  // It's a percentage, convert to bps
            : wizardData.liquidity.liquidity_percent)        // Already in bps
        : 7000  // Default: 70% = 7000 bps
    ),
    dexId: getDexId(wizardData.liquidity?.listing_platform || 'pancakeswap'),
  };

  // Get deployment fee
  const deploymentFee = getDeploymentFee(network);

  return { params, vestingParams, lpPlan, deploymentFee };
}

/**
 * Encode createFairlaunch function call
 */
export function encodeCreateFairlaunch(
  params: CreateFairlaunchParams,
  vestingParams: TeamVestingParams,
  lpPlan: LPLockPlan
): `0x${string}` {
  return encodeFunctionData({
    abi: FairlaunchFactoryABI.abi,
    functionName: 'createFairlaunch',
    args: [params, vestingParams, lpPlan],
  });
}

// ===== STATUS ENUMS =====

/**
 * Fairlaunch status enum (matches contract)
 */
export enum FairlaunchStatus {
  UPCOMING = 0,
  LIVE = 1,
  ENDED = 2,
  SUCCESS = 3,
  FAILED = 4,
  CANCELLED = 5,
}

/**
 * Status labels for UI
 */
export const FAIRLAUNCH_STATUS_LABELS: Record<FairlaunchStatus, string> = {
  [FairlaunchStatus.UPCOMING]: 'Upcoming',
  [FairlaunchStatus.LIVE]: 'Live',
  [FairlaunchStatus.ENDED]: 'Ended',
  [FairlaunchStatus.SUCCESS]: 'Successful',
  [FairlaunchStatus.FAILED]: 'Failed',
  [FairlaunchStatus.CANCELLED]: 'Cancelled',
};

/**
 * Status colors for badges
 */
export const FAIRLAUNCH_STATUS_COLORS: Record<FairlaunchStatus, string> = {
  [FairlaunchStatus.UPCOMING]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [FairlaunchStatus.LIVE]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [FairlaunchStatus.ENDED]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  [FairlaunchStatus.SUCCESS]: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  [FairlaunchStatus.FAILED]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  [FairlaunchStatus.CANCELLED]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

// ===== EXPORTS =====

export { FairlaunchFactoryABI, FairlaunchABI, TeamVestingABI };
