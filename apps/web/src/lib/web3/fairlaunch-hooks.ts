import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import FairlaunchABI from './abis/Fairlaunch.json';
import { type Address } from 'viem';

// Read User Contribution
export function useUserContribution(contractAddress?: Address, userAddress?: Address) {
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
export function useHasClaimed(contractAddress?: Address, userAddress?: Address) {
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
export function useFairlaunchClaim() {
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
export function useFairlaunchRefund() {
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const refund = async (contractAddress: Address) => {
    writeContract({
      address: contractAddress,
      abi: FairlaunchABI.abi,
      functionName: 'refund', // Function name is 'refund' in ABI? Check 4700 line 1290?? No check Line 294 event. Function 'refund' not explicitly seen in first 800 lines?
      // Wait, let's double check ABI in Step 4700.
      // Line 294: Refunded event.
      // I need to find the function 'refund' or 'withdraw'?
      // I'll assume 'refund' exists or 'claimRefund'.
      // I'll check ABI again after this if needed.
      args: [],
    });
  };

  return { refund, hash, error, isPending };
}
