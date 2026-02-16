'use client';

import { useState } from 'react';
import { type Address, formatEther } from 'viem';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { useClaimRefund, useUserContribution } from '@/lib/web3/presale-hooks';
import { useToast } from '@/components/ui';

interface PresaleRefundClaimerProps {
  contractAddress: string;
  currency?: string;
}

/**
 * Presale Refund Claimer - shown when presale ended but soft cap was NOT met.
 * Users can claim their contributed BNB back from the contract.
 */
export default function PresaleRefundClaimer({
  contractAddress,
  currency = 'BNB',
}: PresaleRefundClaimerProps) {
  const { address } = useAccount();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const roundAddr = contractAddress as Address;

  // Read user's contribution from contract
  const { data: userContribution, isLoading: isLoadingContribution } = useUserContribution(
    roundAddr,
    address as Address | undefined
  );

  // Refund hook
  const {
    claimRefund,
    hash: txHash,
    isPending: isRefunding,
    error: refundError,
  } = useClaimRefund(roundAddr);

  // Wait for TX confirmation
  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isRefunded = receipt?.status === 'success';
  const contributionAmount = userContribution ? Number(formatEther(userContribution as bigint)) : 0;
  const hasContribution = contributionAmount > 0;

  const handleRefund = async () => {
    setError(null);
    try {
      await claimRefund();
      showToast('success', 'Refund transaction sent! Waiting for confirmation...');
    } catch (err: any) {
      const msg = err?.message || 'Refund failed';
      setError(msg);
      showToast('error', msg);
    }
  };

  if (isLoadingContribution) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-400 animate-pulse">Loading your contribution...</p>
      </div>
    );
  }

  if (!hasContribution) {
    return (
      <div className="p-4 bg-gray-900/50 rounded-lg border border-white/5">
        <p className="text-gray-400 text-center text-sm">You did not contribute to this presale.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refund Info */}
      <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
        <p className="text-yellow-400 text-sm font-medium mb-1">⚠️ Soft cap was not reached</p>
        <p className="text-gray-400 text-xs">
          This presale did not meet the minimum funding goal. You can claim a full refund of your
          contribution.
        </p>
      </div>

      {/* Contribution Amount */}
      <div className="p-4 bg-gray-900/50 rounded-lg border border-white/5">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Your Contribution</span>
          <span className="text-white font-bold">
            {contributionAmount} {currency}
          </span>
        </div>
      </div>

      {/* Refund Button */}
      {isRefunded ? (
        <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
          <p className="text-green-400 font-medium">✅ Refund claimed successfully!</p>
          {txHash && (
            <a
              href={`https://testnet.bscscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500 hover:text-green-300 underline text-xs mt-1 block"
            >
              View transaction →
            </a>
          )}
        </div>
      ) : (
        <button
          onClick={handleRefund}
          disabled={isRefunding || isConfirming}
          className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold py-3 px-6 rounded-lg transition text-base"
        >
          {isRefunding
            ? 'Sending Refund TX...'
            : isConfirming
              ? 'Confirming...'
              : `Claim Refund (${contributionAmount} ${currency})`}
        </button>
      )}

      {/* Error */}
      {error ? (
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      ) : refundError ? (
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-xs">{refundError.message || 'Refund failed'}</p>
        </div>
      ) : null}
    </div>
  );
}
