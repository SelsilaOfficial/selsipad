/**
 * useFairlaunchContribute Hook
 * 
 * Handles contribution to Fairlaunch smart contracts with referral tracking
 */

import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';
import { saveFairlaunchContribution } from '@/actions/fairlaunch/save-contribution';
import { createClient } from '@/lib/supabase/client';

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
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isContributing, setIsContributing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contribute = async ({
    fairlaunchAddress,
    amount,
  }: ContributeParams): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!walletClient || !address || !publicClient || !chain) {
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

      console.log('[Contribute] Transaction sent:', hash);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        console.log('[Contribute] Transaction confirmed, recording in database...');

        // ✅ FIX: Record contribution using server action (enables referral tracking!)
        await recordContributionInDatabase({
          fairlaunchAddress,
          contributorAddress: address,
          amount: amountWei.toString(), // Send as wei string
          txHash: hash,
          chainId: chain.id.toString(),
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
 * ✅ FIXED: Record contribution using server action for referral tracking
 * This now properly triggers referral rewards via saveFairlaunchContribution
 */
async function recordContributionInDatabase(params: {
  fairlaunchAddress: string;
  contributorAddress: string;
  amount: string; // wei
  txHash: string;
  chainId: string;
}) {
  try {
    // Step 1: Lookup roundId from contract address
    const supabase = createClient();
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('id')
      .eq('contract_address', params.fairlaunchAddress.toLowerCase())
      .single();

    if (roundError || !round) {
      console.error('[Contribute] Failed to find round:', roundError);
      throw new Error('Fairlaunch round not found in database');
    }

    console.log('[Contribute] Found roundId:', round.id);

    // Step 2: Call server action to save contribution + trigger referral tracking
    const result = await saveFairlaunchContribution({
      roundId: round.id,
      amount: params.amount, // wei
      txHash: params.txHash,
      chain: params.chainId,
      walletAddress: params.contributorAddress,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to save contribution');
    }

    console.log('[Contribute] ✅ Contribution recorded! Referral tracking activated.');
  } catch (err) {
    console.error('Error recording contribution:', err);
    // Don't throw - contribution succeeded on-chain even if DB record fails
    // But log it clearly for debugging
    console.warn('⚠️ WARNING: Contribution succeeded on-chain but database recording failed!');
    console.warn('⚠️ This means referral rewards may not be tracked for this transaction.');
  }
}
