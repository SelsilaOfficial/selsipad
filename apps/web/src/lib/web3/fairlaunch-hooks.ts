import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import FairlaunchABI from './abis/Fairlaunch.json';
import { type Address } from 'viem';

// Read User Contribution
export function useUserContribution(
  contractAddress?: Address,
  userAddress?: Address
): ReturnType<typeof useReadContract> {
  return useReadContract({
    address: contractAddress,
    abi: FairlaunchABI.abi,
    functionName: 'getUserContribution',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!contractAddress && !!userAddress,
    },
  });
}

// Read If User Has Claimed
export function useHasClaimed(
  contractAddress?: Address,
  userAddress?: Address
): ReturnType<typeof useReadContract> {
  return useReadContract({
    address: contractAddress,
    abi: FairlaunchABI.abi,
    functionName: 'hasClaimed',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!contractAddress && !!userAddress,
    },
  });
}

// Claim Tokens (Write)
export function useFairlaunchClaim(): {
  claim: (contractAddress: Address) => Promise<void>;
  hash: `0x${string}` | undefined;
  error: Error | null;
  isPending: boolean;
} {
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const claim = async (contractAddress: Address) => {
    writeContract({
      address: contractAddress,
      abi: FairlaunchABI.abi,
      functionName: 'claimTokens',
      args: [],
    });
  };

  return { claim, hash, error, isPending };
}

// Refund (Write)
export function useFairlaunchRefund(): {
  refund: (contractAddress: Address) => Promise<void>;
  hash: `0x${string}` | undefined;
  error: Error | null;
  isPending: boolean;
} {
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const refund = async (contractAddress: Address) => {
    writeContract({
      address: contractAddress,
      abi: FairlaunchABI.abi,
      functionName: 'refund',
      args: [],
    });
  };

  return { refund, hash, error, isPending };
}
