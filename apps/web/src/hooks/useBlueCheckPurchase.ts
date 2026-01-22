/**
 * Custom hook for Blue Check purchase via smart contract
 */

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';

// Contract ABI (simplified)
const BLUECHECK_ABI = [
  {
    inputs: [],
    name: 'purchaseBlueCheck',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getRequiredBNB',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'hasBlueCheck',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// BlueCheckRegistry deployed to BSC Testnet
const BLUECHECK_CONTRACT_ADDRESS = '0x57d4789062F3f2DbB504d11A98Fc9AeA390Be8E2' as `0x${string}`;

interface UseBlueCheckPurchaseReturn {
  requiredBNB: string;
  requiredBNBRaw: bigint;
  hasPurchased: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  error: string | null;
  purchaseBlueCheck: () => Promise<void>;
  checkPurchaseStatus: () => Promise<boolean>;
}

export function useBlueCheckPurchase(): UseBlueCheckPurchaseReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [requiredBNB, setRequiredBNB] = useState<string>('0');
  const [requiredBNBRaw, setRequiredBNBRaw] = useState<bigint>(0n);
  const [hasPurchased, setHasPurchased] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch required BNB on mount
  useEffect(() => {
    if (publicClient) {
      fetchRequiredBNB();
      if (address) {
        checkPurchaseStatus();
      }
    }
  }, [publicClient, address]);

  const fetchRequiredBNB = async () => {
    if (!publicClient) return;

    try {
      setIsLoading(true);
      const result = await publicClient.readContract({
        address: BLUECHECK_CONTRACT_ADDRESS,
        abi: BLUECHECK_ABI,
        functionName: 'getRequiredBNB',
      });

      setRequiredBNBRaw(result);
      setRequiredBNB(formatEther(result));
    } catch (err: any) {
      console.error('Error fetching required BNB:', err);
      setError(err.message || 'Failed to fetch price');
    } finally {
      setIsLoading(false);
    }
  };

  const checkPurchaseStatus = async (): Promise<boolean> => {
    if (!publicClient || !address) return false;

    try {
      const result = await publicClient.readContract({
        address: BLUECHECK_CONTRACT_ADDRESS,
        abi: BLUECHECK_ABI,
        functionName: 'hasBlueCheck',
        args: [address],
      });

      setHasPurchased(result);
      return result;
    } catch (err: any) {
      console.error('Error checking purchase status:', err);
      return false;
    }
  };

  const purchaseBlueCheck = async () => {
    if (!walletClient || !address || !publicClient) {
      setError('Wallet not connected');
      return;
    }

    if (hasPurchased) {
      setError('Already purchased Blue Check');
      return;
    }

    try {
      setIsPurchasing(true);
      setError(null);

      // Execute transaction
      const hash = await walletClient.writeContract({
        address: BLUECHECK_CONTRACT_ADDRESS,
        abi: BLUECHECK_ABI,
        functionName: 'purchaseBlueCheck',
        value: requiredBNBRaw,
      });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        // Call backend to verify and update database
        await verifyPurchaseOnBackend(address, hash);

        setHasPurchased(true);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err: any) {
      console.error('Error purchasing Blue Check:', err);
      setError(err.message || 'Failed to purchase Blue Check');
      throw err;
    } finally {
      setIsPurchasing(false);
    }
  };

  const verifyPurchaseOnBackend = async (userAddress: string, txHash: string) => {
    try {
      const response = await fetch('/api/bluecheck/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: userAddress,
          tx_hash: txHash,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify purchase on backend');
      }
    } catch (err) {
      console.error('Backend verification error:', err);
      // Don't throw - purchase still succeeded on-chain
    }
  };

  return {
    requiredBNB,
    requiredBNBRaw,
    hasPurchased,
    isLoading,
    isPurchasing,
    error,
    purchaseBlueCheck,
    checkPurchaseStatus,
  };
}
