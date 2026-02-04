// FairlaunchFactory Contract Configuration
// Auto-generated from artifacts

import { Address } from 'viem';

/**
 * FairlaunchFactory addresses per network
 */
export const FAIRLAUNCH_FACTORY_ADDRESS: Record<number, Address> = {
  97: '0xa7CA8Ada6a76E43D2BB9F43C8E95b99D253419d2', // BSC Testnet - NEW with token transfer! 
  11155111: '0x6eA1044Caf6CEdf36A9F7D978384a634a3f04FbE', // Sepolia
  84532: '0x6eA1044Caf6CEdf36A9F7D978384a634a3f04FbE', // Base Sepolia
} as const;

/**
 * Simple Token Factory addresses per network
 */
export const SIMPLE_TOKEN_FACTORY_ADDRESS: Record<number, Address> = {
  97: '0x4924e4Dc79f3673a25ea29D26822A5Ee3535Ce6B', // BSC Testnet
  11155111: '0x2aDF8E4a91dC34d992e12FA51d78a4F7E06a5D6b', // Sepolia
  84532: '0x2aDF8E4a91dC34d992e12FA51d78a4F7E06a5D6b', // Base Sepolia
} as const;

/**
 * FeeSplitter addresses per network
 */
export const FEE_SPLITTER_ADDRESS: Record<number, Address> = {
  97: '0x2672af17eA89bc5e46BB52385C45Cb42e5eC8C48', // BSC Testnet
  11155111: '0x99470899b8C0e229d79ad0c96619210CbDD07755', // Sepolia
  84532: '0x99470899b8C0e229d79ad0c96619210CbDD07755', // Base Sepolia
} as const;

/**
 * Deployment fee in wei per network
 */
export const DEPLOYMENT_FEE: Record<number, bigint> = {
  97: BigInt('200000000000000000'), // 0.2 BNB (BSC Testnet)
  11155111: BigInt('10000000000000000'), // 0.01 ETH (Sepolia)
  84532: BigInt('10000000000000000'), // 0.01 ETH (Base Sepolia)
} as const;

/**
 * Token creation fee in wei per network
 */
export const TOKEN_CREATION_FEE: Record<number, bigint> = {
  97: BigInt('200000000000000000'), // 0.2 BNB (BSC Testnet)
  11155111: BigInt('10000000000000000'), // 0.01 ETH (Sepolia)
  84532: BigInt('10000000000000000'), // 0.01 ETH (Base Sepolia)
} as const;

/**
 * Fairlaunch Factory ABI (only functions we need)
 */
export const FAIRLAUNCH_FACTORY_ABI = [
  {
    inputs: [],
    name: 'DEPLOYMENT_FEE',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'projectToken', type: 'address' },
          { internalType: 'address', name: 'paymentToken', type: 'address' },
          { internalType: 'uint256', name: 'softcap', type: 'uint256' },
          { internalType: 'uint256', name: 'tokensForSale', type: 'uint256' },
          { internalType: 'uint256', name: 'minContribution', type: 'uint256' },
          { internalType: 'uint256', name: 'maxContribution', type: 'uint256' },
          { internalType: 'uint256', name: 'startTime', type: 'uint256' },
          { internalType: 'uint256', name: 'endTime', type: 'uint256' },
          { internalType: 'address', name: 'projectOwner', type: 'address' },
          { internalType: 'uint16', name: 'listingPremiumBps', type: 'uint16' },
        ],
        internalType: 'struct FairlaunchFactory.CreateFairlaunchParams',
        name: 'params',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'address', name: 'beneficiary', type: 'address' },
          { internalType: 'uint256', name: 'startTime', type: 'uint256' },
          { internalType: 'uint256[]', name: 'durations', type: 'uint256[]' },
          { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
        ],
        internalType: 'struct FairlaunchFactory.TeamVestingParams',
        name: 'vestingParams',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'uint256', name: 'lockMonths', type: 'uint256' },
          { internalType: 'uint256', name: 'liquidityPercent', type: 'uint256' },
          { internalType: 'bytes32', name: 'dexId', type: 'bytes32' },
        ],
        internalType: 'struct FairlaunchFactory.LPLockPlan',
        name: 'lpPlan',
        type: 'tuple',
      },
    ],
    name: 'createFairlaunch',
    outputs: [
      { internalType: 'address', name: 'fairlaunch', type: 'address' },
      { internalType: 'address', name: 'vesting', type: 'address' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'fairlaunchId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'fairlaunch', type: 'address' },
      { indexed: true, internalType: 'address', name: 'vesting', type: 'address' },
      { indexed: false, internalType: 'address', name: 'projectToken', type: 'address' },
    ],
    name: 'FairlaunchCreated',
    type: 'event',
  },
] as const;
