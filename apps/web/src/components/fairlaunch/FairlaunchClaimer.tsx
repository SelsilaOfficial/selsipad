'use client';

import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import {
  useUserContribution,
  useHasClaimed,
  useFairlaunchClaim,
  useFairlaunchRefund,
} from '@/lib/web3/fairlaunch-hooks';
import { useToast } from '@/components/ui'; // Assuming this exists or similar
// If useToast is not available, I'll use simple alert or console. log.
// I saw "useToast" in ParticipationForm.tsx line 4.

interface FairlaunchClaimerProps {
  contractAddress: string;
  projectSymbol: string;
  projectStatus: string; // 'FINALIZED', 'FAILED', 'CANCELLED'
  currency: string;
}

export default function FairlaunchClaimer({
  contractAddress,
  projectSymbol,
  projectStatus,
  currency,
}: FairlaunchClaimerProps) {
  const { address } = useAccount();
  const { showToast } = useToast();

  const { data: userContribution } = useUserContribution(contractAddress as Address, address);
  const { data: hasClaimed } = useHasClaimed(contractAddress as Address, address);

  const { claim, isPending: isClaiming, hash: claimHash, error: claimError } = useFairlaunchClaim();
  const {
    refund,
    isPending: isRefunding,
    hash: refundHash,
    error: refundError,
  } = useFairlaunchRefund();

  const contribution = userContribution ? Number(userContribution) : 0;
  const canClaim = contribution > 0 && !hasClaimed;
  const canRefund = contribution > 0; // If failed/cancelled

  const handleClaim = async () => {
    try {
      await claim(contractAddress as Address);
      showToast('success', 'Claim transaction sent!');
    } catch (e: any) {
      showToast('error', e.message || 'Claim failed');
    }
  };

  const handleRefund = async () => {
    try {
      await refund(contractAddress as Address);
      showToast('success', 'Refund transaction sent!');
    } catch (e: any) {
      showToast('error', e.message || 'Refund failed');
    }
  };

  if (!address) {
    return (
      <div className="p-4 bg-gray-900/50 rounded-lg border border-white/10 text-center text-gray-400">
        Connect wallet to check allocation
      </div>
    );
  }

  if (contribution === 0) {
    return (
      <div className="p-4 bg-gray-900/50 rounded-lg border border-white/10 text-center text-gray-400">
        You did not participate in this round.
      </div>
    );
  }

  // Success Case
  if (
    projectStatus === 'FINALIZED' ||
    projectStatus === 'ENDED' ||
    projectStatus === 'FINALIZED_SUCCESS'
  ) {
    if (hasClaimed) {
      return (
        <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20 text-center">
          <p className="text-green-400 font-bold mb-2">You have claimed your tokens!</p>
          {claimHash && (
            <a
              href={`https://testnet.bscscan.com/tx/${claimHash}`}
              target="_blank"
              className="text-xs underline text-green-500/70"
            >
              View Transaction
            </a>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-300 mb-1">Your Contribution</p>
          <p className="text-xl font-bold text-white">
            {(contribution / 1e18).toFixed(4)} {currency}
          </p>
        </div>

        <button
          onClick={handleClaim}
          disabled={isClaiming || !canClaim}
          className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isClaiming ? 'Claiming...' : `Claim ${projectSymbol}`}
        </button>
        {claimError && <p className="text-red-400 text-xs text-center">{claimError.message}</p>}
      </div>
    );
  }

  // Failure Case
  if (
    projectStatus === 'FAILED' ||
    projectStatus === 'CANCELLED' ||
    projectStatus === 'FINALIZED_FAILED'
  ) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
          <p className="text-sm text-red-300 mb-1">Round Failed/Cancelled</p>
          <p className="text-xs text-red-200/70 mb-2">
            You can request a refund for your contribution.
          </p>
          <p className="text-xl font-bold text-white">
            {(contribution / 1e18).toFixed(4)} {currency}
          </p>
        </div>

        <button
          onClick={handleRefund}
          disabled={isRefunding || !canRefund}
          className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefunding ? 'Refunding...' : 'Claim Refund'}
        </button>
        {refundError && <p className="text-red-400 text-xs text-center">{refundError.message}</p>}
      </div>
    );
  }

  return null;
}
