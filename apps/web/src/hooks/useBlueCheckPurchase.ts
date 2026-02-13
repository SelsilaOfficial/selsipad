/**
 * Custom hook for Blue Check purchase via smart contract
 *
 * Handles chain validation (BSC Testnet only) and graceful error handling.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
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

// BlueCheckRegistry deployed to BSC Testnet (Chain ID: 97)
const BLUECHECK_CONTRACT_ADDRESS = '0x57d4789062F3f2DbB504d11A98Fc9AeA390Be8E2' as `0x${string}`;
const REQUIRED_CHAIN_ID = 97; // BSC Testnet

interface UseBlueCheckPurchaseReturn {
  requiredBNB: string;
  requiredBNBRaw: bigint;
  hasPurchased: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  error: string | null;
  isWrongChain: boolean;
  purchaseBlueCheck: () => Promise<void>;
  checkPurchaseStatus: () => Promise<boolean>;
  switchToBSCTestnet: () => Promise<void>;
}

export function useBlueCheckPurchase(): UseBlueCheckPurchaseReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [requiredBNB, setRequiredBNB] = useState<string>('0');
  const [requiredBNBRaw, setRequiredBNBRaw] = useState<bigint>(0n);
  const [hasPurchased, setHasPurchased] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isWrongChain = chainId !== REQUIRED_CHAIN_ID;

  // Switch to BSC Testnet
  const switchToBSCTestnet = useCallback(async () => {
    try {
      await switchChain({ chainId: REQUIRED_CHAIN_ID });
      setError(null);
    } catch (err: any) {
      console.error('Failed to switch chain:', err);
      setError('Failed to switch to BSC Testnet. Please switch manually in your wallet.');
    }
  }, [switchChain]);

  // Fetch required BNB on mount (only on correct chain)
  useEffect(() => {
    if (publicClient && !isWrongChain) {
      fetchRequiredBNB();
      if (address) {
        checkPurchaseStatus();
      }
    } else if (isWrongChain) {
      // Clear any stale error when on wrong chain
      setError(null);
      setRequiredBNB('0');
      setRequiredBNBRaw(0n);
    }
  }, [publicClient, address, isWrongChain]);

  const fetchRequiredBNB = async () => {
    if (!publicClient || isWrongChain) return;

    try {
      setIsLoading(true);
      setError(null);
      const result = await publicClient.readContract({
        address: BLUECHECK_CONTRACT_ADDRESS,
        abi: BLUECHECK_ABI,
        functionName: 'getRequiredBNB',
      });

      setRequiredBNBRaw(result);
      setRequiredBNB(formatEther(result));
    } catch (err: any) {
      console.error('Error fetching required BNB:', err);
      // Provide a user-friendly error message
      if (err.message?.includes('returned no data') || err.message?.includes('0x')) {
        setError(
          'Unable to read contract. Please ensure you are connected to BSC Testnet (Chain ID: 97).'
        );
      } else if (err.message?.includes('Price not set')) {
        setError('Contract price has not been configured yet. Please contact support.');
      } else {
        setError('Failed to fetch BNB price. Please try again or switch to BSC Testnet.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkPurchaseStatus = async (): Promise<boolean> => {
    if (!publicClient || !address || isWrongChain) return false;

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

    if (isWrongChain) {
      setError('Please switch to BSC Testnet before purchasing.');
      return;
    }

    if (hasPurchased) {
      setError('Already purchased Blue Check');
      return;
    }

    if (requiredBNBRaw === 0n) {
      setError('Price not loaded. Please refresh and try again.');
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

      // Translate common wallet errors
      if (err.message?.includes('User rejected') || err.message?.includes('user rejected')) {
        setError('Transaction cancelled by user.');
      } else if (err.message?.includes('insufficient funds')) {
        setError('Insufficient BNB balance for this transaction.');
      } else {
        setError(err.shortMessage || err.message || 'Failed to purchase Blue Check');
      }
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
    isWrongChain,
    purchaseBlueCheck,
    checkPurchaseStatus,
    switchToBSCTestnet,
  };
}
