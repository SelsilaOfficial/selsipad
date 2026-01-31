/**
 * useFairlaunchContribute Hook
 * 
 * Handles contribution to Fairlaunch smart contracts
 */

import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';
import { FAIRLAUNCH_FACTORY_ABI } from '@/contracts/FairlaunchFactory';

interface ContributeParams {
  fairlaunchAddress: `0x${string}`;
  amount: string; // Amount in ETH/BNB string format
}

interface UseFairlaunchContributeReturn {
  contribute: (params: ContributeParams) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  isContributing: boolean;
  error: string | null;
}

// Fairlaunch Contract ABI (contribute function only)
const FAIRLAUNCH_ABI = [
  {
    inputs: [],
    name: 'contribute',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'contributor', type: 'address' }],
    name: 'contributions',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalRaised',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function useFairlaunchContribute(): UseFairlaunchContributeReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isContributing, setIsContributing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contribute = async ({
    fairlaunchAddress,
    amount,
  }: ContributeParams): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!walletClient || !address || !publicClient) {
      const errorMsg = 'Wallet not connected';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      setIsContributing(true);
      setError(null);

      // Parse amount to wei
      const amountWei = parseEther(amount);

      // Execute contribute transaction
      const hash = await walletClient.writeContract({
        address: fairlaunchAddress,
        abi: FAIRLAUNCH_ABI,
        functionName: 'contribute',
        value: amountWei,
      });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        // Record contribution in database
        await recordContributionInDatabase({
          fairlaunchAddress,
          contributorAddress: address,
          amount,
          txHash: hash,
        });

        return { success: true, txHash: hash };
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err: any) {
      console.error('Error contributing to Fairlaunch:', err);
      const errorMsg = err.message || 'Failed to contribute';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsContributing(false);
    }
  };

  return {
    contribute,
    isContributing,
    error,
  };
}

/**
 * Record contribution in database via API
 */
async function recordContributionInDatabase(params: {
  fairlaunchAddress: string;
  contributorAddress: string;
  amount: string;
  txHash: string;
}) {
  try {
    const response = await fetch('/api/fairlaunch/contribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Failed to record contribution in database');
    }
  } catch (err) {
    console.error('Error recording contribution:', err);
    // Don't throw - contribution succeeded on-chain even if DB record fails
  }
}
