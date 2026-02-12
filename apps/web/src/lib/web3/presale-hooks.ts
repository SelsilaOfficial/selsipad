/**
 * Wagmi Hooks for Presale Smart Contracts
 *
 * Provides type-safe hooks for reading and writing to PresaleRound and MerkleVesting contracts.
 * All hooks use wagmi v2 API.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { PRESALE_ROUND_ABI, MERKLE_VESTING_ABI } from './presale-contracts';
import type { Address } from 'viem';

// ============================================================================
// PresaleRound Read Hooks
// ============================================================================

export function usePresaleStatus(address: Address | undefined) {
  return useReadContract({
    address,
    abi: PRESALE_ROUND_ABI,
    functionName: 'status',
    query: {
      enabled: !!address,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });
}

export function usePresaleTotalRaised(address: Address | undefined) {
  return useReadContract({
    address,
    abi: PRESALE_ROUND_ABI,
    functionName: 'totalRaised',
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });
}

export function usePresaleConfig(address: Address | undefined) {
  const softCap = useReadContract({
    address,
    abi: PRESALE_ROUND_ABI,
    functionName: 'softCap',
  });

  const hardCap = useReadContract({
    address,
    abi: PRESALE_ROUND_ABI,
    functionName: 'hardCap',
  });

  const startTime = useReadContract({
    address,
    abi: PRESALE_ROUND_ABI,
    functionName: 'startTime',
  });

  const endTime = useReadContract({
    address,
    abi: PRESALE_ROUND_ABI,
    functionName: 'endTime',
  });

  const minContribution = useReadContract({
    address,
    abi: PRESALE_ROUND_ABI,
    functionName: 'minContribution',
  });

  const maxContribution = useReadContract({
    address,
    abi: PRESALE_ROUND_ABI,
    functionName: 'maxContribution',
  });

  return {
    softCap: softCap.data,
    hardCap: hardCap.data,
    startTime: startTime.data,
    endTime: endTime.data,
    minContribution: minContribution.data,
    maxContribution: maxContribution.data,
    isLoading: softCap.isLoading || hardCap.isLoading || startTime.isLoading || endTime.isLoading,
  };
}

export function useUserContribution(
  roundAddress: Address | undefined,
  userAddress: Address | undefined
) {
  return useReadContract({
    address: roundAddress,
    abi: PRESALE_ROUND_ABI,
    functionName: 'contributions',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!roundAddress && !!userAddress,
      refetchInterval: 10000,
    },
  });
}

export function usePresaleVestingVault(address: Address | undefined) {
  return useReadContract({
    address,
    abi: PRESALE_ROUND_ABI,
    functionName: 'vestingVault',
  });
}

export function usePresaleTgeTimestamp(address: Address | undefined) {
  return useReadContract({
    address,
    abi: PRESALE_ROUND_ABI,
    functionName: 'tgeTimestamp',
  });
}

// ============================================================================
// MerkleVesting Read Hooks
// ============================================================================

export function useVestingSchedule(address: Address | undefined) {
  const tgeUnlockBps = useReadContract({
    address,
    abi: MERKLE_VESTING_ABI,
    functionName: 'tgeUnlockBps',
  });

  const cliffDuration = useReadContract({
    address,
    abi: MERKLE_VESTING_ABI,
    functionName: 'cliffDuration',
  });

  const vestingDuration = useReadContract({
    address,
    abi: MERKLE_VESTING_ABI,
    functionName: 'vestingDuration',
  });

  const tgeTimestamp = useReadContract({
    address,
    abi: MERKLE_VESTING_ABI,
    functionName: 'tgeTimestamp',
  });

  return {
    tgeUnlockBps: tgeUnlockBps.data,
    cliffDuration: cliffDuration.data,
    vestingDuration: vestingDuration.data,
    tgeTimestamp: tgeTimestamp.data,
    isLoading: tgeUnlockBps.isLoading || cliffDuration.isLoading,
  };
}

export function useClaimableAmount(
  vestingAddress: Address | undefined,
  userAddress: Address | undefined,
  totalAllocation: bigint | undefined
) {
  return useReadContract({
    address: vestingAddress,
    abi: MERKLE_VESTING_ABI,
    functionName: 'getClaimable',
    args: userAddress && totalAllocation ? [userAddress, totalAllocation] : undefined,
    query: {
      enabled: !!vestingAddress && !!userAddress && !!totalAllocation,
      refetchInterval: 30000, // 30 seconds
    },
  });
}

export function useClaimedAmount(
  vestingAddress: Address | undefined,
  userAddress: Address | undefined
) {
  return useReadContract({
    address: vestingAddress,
    abi: MERKLE_VESTING_ABI,
    functionName: 'claimed',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!vestingAddress && !!userAddress,
    },
  });
}

// ============================================================================
// Write Hooks
// ============================================================================

/**
 * Hook for contributing to a presale
 * Usage:
 *   const { write, data: hash, isPending } = useContribute();
 *   await write({ roundAddress, amount, referrer });
 */
export function useContribute() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const contribute = async ({
    roundAddress,
    amount,
    referrer = '0x0000000000000000000000000000000000000000',
  }: {
    roundAddress: Address;
    amount: bigint;
    referrer?: Address;
  }) => {
    return writeContract({
      address: roundAddress,
      abi: PRESALE_ROUND_ABI,
      functionName: 'contribute',
      args: [amount, referrer],
      value: amount,
    });
  };

  return {
    contribute,
    hash,
    isPending,
    error,
  };
}

/**
 * Hook for claiming refund from failed presale
 * @param roundAddress - PresaleRound contract address (optional; can pass to claimRefund instead)
 */
export function useClaimRefund(roundAddress?: Address) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const claimRefund = async (address?: Address) => {
    const target = address ?? roundAddress;
    if (!target) throw new Error('Round address required');
    return writeContract({
      address: target,
      abi: PRESALE_ROUND_ABI,
      functionName: 'claimRefund',
    });
  };

  return {
    claimRefund,
    hash,
    isPending,
    error,
  };
}

/**
 * Hook for claiming vested tokens
 * IMPORTANT: totalAllocation and proof must come from backend API, never client
 */
export function useClaimVesting() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const claim = async ({
    vestingAddress,
    totalAllocation,
    proof,
  }: {
    vestingAddress: Address;
    totalAllocation: bigint;
    proof: `0x${string}`[];
  }) => {
    return writeContract({
      address: vestingAddress,
      abi: MERKLE_VESTING_ABI,
      functionName: 'claim',
      args: [totalAllocation, proof],
    });
  };

  return {
    claim,
    hash,
    isPending,
    error,
  };
}

/**
 * Hook for admin finalization (success)
 * Only use when ENABLE_DIRECT_FINALIZE=true in testnet
 */
export function useFinalizeSuccess() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const finalize = async ({
    roundAddress,
    merkleRoot,
    totalAllocation,
  }: {
    roundAddress: Address;
    merkleRoot: `0x${string}`;
    totalAllocation: bigint;
  }) => {
    return writeContract({
      address: roundAddress,
      abi: PRESALE_ROUND_ABI,
      functionName: 'finalizeSuccess',
      args: [merkleRoot, totalAllocation],
    });
  };

  return {
    finalize,
    hash,
    isPending,
    error,
  };
}

/**
 * Hook for admin escrow-based finalization (success)
 * V2.4: Calls finalizeSuccessEscrow(merkleRoot, totalAllocation, unsoldToBurn, tokensForLP, tokenMinLP, bnbMinLP)
 * Use this for presales deployed via Factory v2.4+
 */
export function useFinalizeSuccessEscrow() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const finalize = async ({
    roundAddress,
    merkleRoot,
    totalAllocation,
    unsoldToBurn = 0n,
    tokensForLP = 0n,
    tokenMinLP = 0n,
    bnbMinLP = 0n,
  }: {
    roundAddress: Address;
    merkleRoot: `0x${string}`;
    totalAllocation: bigint;
    unsoldToBurn?: bigint;
    tokensForLP?: bigint;
    tokenMinLP?: bigint;
    bnbMinLP?: bigint;
  }) => {
    return writeContract({
      address: roundAddress,
      abi: PRESALE_ROUND_ABI,
      functionName: 'finalizeSuccessEscrow',
      args: [merkleRoot, totalAllocation, unsoldToBurn, tokensForLP, tokenMinLP, bnbMinLP],
    });
  };

  return {
    finalize,
    hash,
    isPending,
    error,
  };
}

/**
 * Hook for waiting for transaction confirmation
 */
export function useTransactionConfirmation(hash: `0x${string}` | undefined) {
  return useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: !!hash,
    },
  });
}
