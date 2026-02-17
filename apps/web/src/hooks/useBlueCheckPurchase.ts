/**
 * Custom hook for Blue Check purchase via smart contract
 *
 * Supports BSC Testnet (97) and BSC Mainnet (56).
 * Auto-detects chain from connected wallet.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { formatEther } from 'viem';

// Contract ABI (simplified)
const BLUECHECK_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'referrer', type: 'address' }],
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

// Per-network BlueCheck contract addresses
const BLUECHECK_ADDRESSES: Record<number, `0x${string}`> = {
  97: '0xfFaB42EcD7Eb0a85b018516421C9aCc088aC7157', // BSC Testnet
  56: '0x7d33B957D8B27133Fa9e7765A18306A7BA60D275', // BSC Mainnet
};

// Supported chain IDs for BlueCheck
const SUPPORTED_CHAIN_IDS = [97, 56];
// Default chain for switch prompt
const DEFAULT_CHAIN_ID = 56; // BSC Mainnet

function getBlueCheckAddress(chainId: number): `0x${string}` | null {
  return BLUECHECK_ADDRESSES[chainId] || null;
}

function getChainLabel(chainId: number): string {
  if (chainId === 56) return 'BSC Mainnet';
  if (chainId === 97) return 'BSC Testnet';
  return `Chain ${chainId}`;
}

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

  const isWrongChain = !SUPPORTED_CHAIN_IDS.includes(chainId);
  const contractAddress = getBlueCheckAddress(chainId);

  // Switch to default BSC chain
  const switchToBSCTestnet = useCallback(async () => {
    try {
      await switchChain({ chainId: DEFAULT_CHAIN_ID });
      setError(null);
    } catch (err: any) {
      console.error('Failed to switch chain:', err);
      setError(
        `Failed to switch to ${getChainLabel(DEFAULT_CHAIN_ID)}. Please switch manually in your wallet.`
      );
    }
  }, [switchChain]);

  // Fetch required BNB on mount (only on supported chain)
  useEffect(() => {
    if (publicClient && !isWrongChain && contractAddress) {
      fetchRequiredBNB();
      if (address) {
        checkPurchaseStatus();
      }
    } else if (isWrongChain) {
      setError(null);
      setRequiredBNB('0');
      setRequiredBNBRaw(0n);
    }
  }, [publicClient, address, isWrongChain, chainId]);

  const fetchRequiredBNB = async () => {
    if (!publicClient || isWrongChain || !contractAddress) return;

    try {
      setIsLoading(true);
      setError(null);
      const result = await publicClient.readContract({
        address: contractAddress,
        abi: BLUECHECK_ABI,
        functionName: 'getRequiredBNB',
      });

      setRequiredBNBRaw(result);
      setRequiredBNB(formatEther(result));
    } catch (err: any) {
      console.error('Error fetching required BNB:', err);
      if (err.message?.includes('returned no data') || err.message?.includes('0x')) {
        setError(
          `Unable to read contract on ${getChainLabel(chainId)}. Please ensure you are connected to BSC.`
        );
      } else if (err.message?.includes('Price not set')) {
        setError('Contract price has not been configured yet. Please contact support.');
      } else {
        setError(`Failed to fetch BNB price on ${getChainLabel(chainId)}. Please try again.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkPurchaseStatus = async (): Promise<boolean> => {
    if (!publicClient || !address || isWrongChain || !contractAddress) return false;

    try {
      const result = await publicClient.readContract({
        address: contractAddress,
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

    if (isWrongChain || !contractAddress) {
      setError(`Please switch to BSC Mainnet or BSC Testnet before purchasing.`);
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

      // Fetch referrer address from backend
      const referrerAddress = await fetchReferrerAddress();

      // Execute transaction with referrer parameter
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: BLUECHECK_ABI,
        functionName: 'purchaseBlueCheck',
        args: [referrerAddress],
        value: requiredBNBRaw,
      });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        // Call backend to verify and update database — include chainId
        await verifyPurchaseOnBackend(address, hash, chainId);

        setHasPurchased(true);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err: any) {
      console.error('Error purchasing Blue Check:', err);

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

  const fetchReferrerAddress = async (): Promise<`0x${string}`> => {
    try {
      const response = await fetch('/api/bluecheck/get-referrer');
      const data = await response.json();

      if (data.referrer_address) {
        console.log('Using referrer address:', data.referrer_address);
        return data.referrer_address as `0x${string}`;
      }
    } catch (err) {
      console.error('Failed to fetch referrer:', err);
    }

    // Fallback: zero address (contract will use treasury)
    console.log('No referrer found, using zero address (treasury fallback)');
    return '0x0000000000000000000000000000000000000000';
  };

  const verifyPurchaseOnBackend = async (userAddress: string, txHash: string, chain: number) => {
    try {
      const response = await fetch('/api/bluecheck/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: userAddress,
          tx_hash: txHash,
          chain_id: chain,
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
