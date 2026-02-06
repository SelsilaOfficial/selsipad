'use client';

import { useState } from 'react';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { useUserContribution, useClaimRefund } from '@/lib/web3/presale-hooks';

interface RefundCardProps {
  roundAddress: string;
  presaleStatus: number; // 4 = FINALIZED_FAILED, 5 = CANCELLED
}

export default function RefundCard({ roundAddress, presaleStatus }: RefundCardProps) {
  const { address } = useAccount();
  const [error, setError] = useState<string | null>(null);

  // Read user's contribution
  const { data: contribution, refetch: refetchContribution } = useUserContribution(
    roundAddress,
    address || ''
  );

  const { claimRefund, hash: txHash, isPending: isRefunding, error: txError } = useClaimRefund(roundAddress);
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });
  const isRefunded = !!receipt;

  // Only show refund card if presale is FAILED or CANCELLED
  const isRefundable = presaleStatus === 4 || presaleStatus === 5;

  // Check if user has contribution to refund
  const hasContribution = contribution && contribution > 0n;

  if (!isRefundable || !address) {
    return null;
  }

  const handleClaimRefund = async () => {
    setError(null);

    try {
      await claimRefund(roundAddress as `0x${string}`);

      // Refetch contribution after successful refund
      setTimeout(() => {
        refetchContribution();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="ml-3 flex-1">
          <h3 className="text-lg font-semibold text-red-900">
            {presaleStatus === 4 ? 'Presale Failed' : 'Presale Cancelled'}
          </h3>

          <p className="mt-2 text-sm text-red-700">
            {presaleStatus === 4
              ? 'This presale did not meet the minimum softcap and has been finalized as FAILED. You can claim a full refund of your contribution.'
              : 'This presale has been cancelled. You can claim a full refund of your contribution.'}
          </p>

          {/* Contribution Info */}
          {hasContribution && !isRefunded && (
            <div className="mt-4 bg-white rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-600">Your Contribution</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatEther(contribution)} BNB
                </span>
              </div>

              <button
                onClick={handleClaimRefund}
                disabled={isRefunding || isRefunded}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                {isRefunding ? 'Processing Refund...' : 'Claim Refund'}
              </button>
            </div>
          )}

          {/* Success State */}
          {isRefunded && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="ml-2 text-sm font-medium text-green-800">
                  Refund claimed successfully!
                </span>
              </div>

              {txHash && (
                <a
                  href={`https://testnet.bscscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-sm text-green-700 hover:text-green-900 underline block"
                >
                  View transaction →
                </a>
              )}
            </div>
          )}

          {/* No Contribution */}
          {!hasContribution && !isRefunded && (
            <div className="mt-4 bg-gray-100 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                You have no contribution to refund for this presale.
              </p>
            </div>
          )}

          {/* Error Display */}
          {(error || txError) && (
            <div className="mt-4 bg-red-100 border border-red-300 rounded-lg p-3">
              <p className="text-sm text-red-800">
                {error || txError?.message || 'Transaction failed'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
