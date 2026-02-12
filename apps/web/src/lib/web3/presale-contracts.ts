/**
 * Presale Smart Contract ABIs and Addresses
 *
 * IMPORTANT: These ABIs are extracted from compiled Hardhat artifacts.
 * Only essential functions are included to reduce bundle size.
 */

// Minimal ABI for PresaleRound contract
export const PRESALE_ROUND_ABI = [
  // View functions
  {
    name: 'status',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    name: 'totalRaised',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'softCap',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'hardCap',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'startTime',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'endTime',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'contributions',
    type: 'function',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'projectOwner',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'vestingVault',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'tgeTimestamp',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'minContribution',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'maxContribution',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },

  // Write functions
  {
    name: 'contribute',
    type: 'function',
    inputs: [{ type: 'uint256' }, { type: 'address' }],
    outputs: [],
    stateMutability: 'payable',
  },
  { name: 'claimRefund', type: 'function', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  {
    name: 'finalizeSuccess',
    type: 'function',
    inputs: [{ type: 'bytes32' }, { type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // V2.4: 6-param finalizeSuccessEscrow
  {
    name: 'finalizeSuccessEscrow',
    type: 'function',
    inputs: [
      { type: 'bytes32' }, // _merkleRoot
      { type: 'uint256' }, // totalVestingAllocation
      { type: 'uint256' }, // unsoldToBurn
      { type: 'uint256' }, // tokensForLP
      { type: 'uint256' }, // tokenMinLP
      { type: 'uint256' }, // bnbMinLP
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'finalizeFailed',
    type: 'function',
    inputs: [{ type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // V2.4: Phase flags
  {
    name: 'vestingFunded',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'feePaid',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'lpCreated',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'ownerPaid',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'burnedAmount',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'lpLockId',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // V2.4: sweepExcess
  {
    name: 'sweepExcess',
    type: 'function',
    inputs: [{ type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // V2.4: feeConfig view
  {
    name: 'feeConfig',
    type: 'function',
    inputs: [],
    outputs: [
      { type: 'uint256', name: 'totalBps' },
      { type: 'uint256', name: 'treasuryBps' },
      { type: 'uint256', name: 'referralPoolBps' },
      { type: 'uint256', name: 'sbtStakingBps' },
    ],
    stateMutability: 'view',
  },
] as const;

// Minimal ABI for MerkleVesting contract
export const MERKLE_VESTING_ABI = [
  // View functions
  {
    name: 'tgeUnlockBps',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'cliffDuration',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'vestingDuration',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'tgeTimestamp',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'claimed',
    type: 'function',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getClaimable',
    type: 'function',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'scheduleSalt',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    name: 'token',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },

  // Write functions
  {
    name: 'claim',
    type: 'function',
    inputs: [{ type: 'uint256' }, { type: 'bytes32[]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// Contract addresses by network (V2.4 — deployed 2026-02-12)
export const CONTRACTS = {
  bsc_testnet: {
    chainId: 97,
    factory: '0x67c3DAE448B55C3B056C39B173118d69b7891866' as `0x${string}`,
    feeSplitter: '0x9CE09C9e370a3974f4D0c55D6a15C4d9F186d161' as `0x${string}`,
    timelockExecutor: '0x95D94D86CfC550897d2b80672a3c94c12429a90D' as `0x${string}`,
    dexRouter: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1' as `0x${string}`,
    lpLocker: '0x762ef3C6573473F7DeE7520B5c014825b64EB0DF' as `0x${string}`,
    deployBlock: 89830908,
    // Previous v2.3: factory 0xb6AB0db764dF5Ae4BBE8464289A22F5AcE0DdcAB, feeSplitter 0xDCE874B2E99C6318Dc88157DA313Cc11D957d2aF
  },
} as const;

// Status enum matching on-chain (V2.4 — includes FINALIZING)
export enum PresaleStatus {
  UPCOMING = 0,
  ACTIVE = 1,
  ENDED = 2,
  FINALIZING = 3, // V2.4: snapshot taken, phases in progress
  FINALIZED_SUCCESS = 4, // was 3 in V2.3
  FINALIZED_FAILED = 5, // was 4 in V2.3
  CANCELLED = 6, // was 5 in V2.3
}

// Status labels for UI
export const STATUS_LABELS: Record<PresaleStatus, string> = {
  [PresaleStatus.UPCOMING]: 'Upcoming',
  [PresaleStatus.ACTIVE]: 'Active',
  [PresaleStatus.ENDED]: 'Ended',
  [PresaleStatus.FINALIZING]: 'Finalizing',
  [PresaleStatus.FINALIZED_SUCCESS]: 'Successful',
  [PresaleStatus.FINALIZED_FAILED]: 'Failed',
  [PresaleStatus.CANCELLED]: 'Cancelled',
};

// Status colors for badges
export const STATUS_COLORS: Record<PresaleStatus, string> = {
  [PresaleStatus.UPCOMING]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [PresaleStatus.ACTIVE]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [PresaleStatus.ENDED]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  [PresaleStatus.FINALIZING]:
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  [PresaleStatus.FINALIZED_SUCCESS]:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  [PresaleStatus.FINALIZED_FAILED]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  [PresaleStatus.CANCELLED]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

// Aliases used by admin pages
export const PresaleStatusLabel = STATUS_LABELS;
export const PresaleStatusColor = STATUS_COLORS;
