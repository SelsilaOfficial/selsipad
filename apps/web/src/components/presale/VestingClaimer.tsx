'use client';

import { useState, useEffect } from 'react';
import { type Address } from 'viem';
import { useWaitForTransactionReceipt } from 'wagmi';
import {
  usePresaleVestingVault,
  usePresaleTgeTimestamp,
  useVestingSchedule,
  useClaimableAmount,
  useClaimedAmount,
  useClaimVesting,
} from '@/lib/web3/presale-hooks';

interface VestingClaimerProps {
  presaleId: string;
  userAddress: string;
}

interface MerkleProof {
  allocation: string; // wei as string
  proof: string[];
}

export default function VestingClaimer({ presaleId, userAddress }: VestingClaimerProps) {
  const [proof, setProof] = useState<MerkleProof | null>(null);
  const [isLoadingProof, setIsLoadingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roundAddress, setRoundAddress] = useState<string>('');

  // Fetch round address from DB first (we need this to get vesting vault)
  useEffect(() => {
    const fetchRoundAddress = async () => {
      try {
        const response = await fetch(`/api/presale/${presaleId}/contract-address`);
        if (!response.ok) throw new Error('Failed to load presale contract');
        const data = await response.json();
        setRoundAddress(data.roundAddress);
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchRoundAddress();
  }, [presaleId]);

  // Read vesting vault address and TGE timestamp from presale contract
  const roundAddr = roundAddress ? (roundAddress as Address) : undefined;
  const { data: vestingVaultAddress } = usePresaleVestingVault(roundAddr);
  const { data: tgeTimestamp } = usePresaleTgeTimestamp(roundAddr);

  // Read vesting schedule
  const vestingVaultAddr = vestingVaultAddress as Address | undefined;
  const vestingSchedule = useVestingSchedule(vestingVaultAddr);

  // Read claimed amount
  const { data: claimedAmount, refetch: refetchClaimed } = useClaimedAmount(
    vestingVaultAddr,
    userAddress as Address | undefined
  );

  // Calculate claimable amount (only if we have the proof)
  const { data: claimableAmount, refetch: refetchClaimable } = useClaimableAmount(
    vestingVaultAddr,
    userAddress as Address | undefined,
    proof ? BigInt(proof.allocation) : 0n
  );

  const {
    claim: executeClaim,
    hash: txHash,
    isPending: isClaiming,
    error: claimError,
  } = useClaimVesting();
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });
  const isClaimed = !!receipt;

  // Fetch merkle proof from backend
  const loadProof = async () => {
    setIsLoadingProof(true);
    setError(null);

    try {
      const response = await fetch(`/api/presale/${presaleId}/merkle-proof?wallet=${userAddress}`);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'No allocation found');
      }

      const data = await response.json();
      setProof({
        allocation: data.allocation ?? data.totalAllocation ?? '0',
        proof: data.proof ?? [],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingProof(false);
    }
  };

  // Auto-load proof on mount
  useEffect(() => {
    if (vestingVaultAddress && userAddress && !proof) {
      loadProof();
    }
  }, [vestingVaultAddress, userAddress]);

  // Handle claim
  const handleClaim = async () => {
    if (!proof) return;

    setError(null);

    if (!vestingVaultAddress) return;

    try {
      await executeClaim({
        vestingAddress: vestingVaultAddress as `0x${string}`,
        totalAllocation: BigInt(proof.allocation),
        proof: proof.proof as `0x${string}`[],
      });

      // Refetch balances after claim
      setTimeout(() => {
        refetchClaimable();
        refetchClaimed();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Calculate vesting progress
  const now = Math.floor(Date.now() / 1000);
  const tge = tgeTimestamp ? Number(tgeTimestamp) : 0;
  const hasSchedule = !!vestingSchedule.cliffDuration;
  const cliffEnd = hasSchedule ? tge + Number(vestingSchedule.cliffDuration) : 0;
  const vestingEnd = hasSchedule ? cliffEnd + Number(vestingSchedule.vestingDuration) : 0;

  const isCliffActive = now < cliffEnd;
  const isVestingActive = now >= cliffEnd && now < vestingEnd;
  const isFullyVested = now >= vestingEnd;

  const vestingProgress = isFullyVested
    ? 100
    : isVestingActive
      ? ((now - cliffEnd) / (vestingEnd - cliffEnd)) * 100
      : 0;

  // Loading state
  if (!vestingVaultAddress) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Loading vesting contract...</p>
      </div>
    );
  }

  // Error state
  if (error && !proof) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800 font-medium">Unable to load allocation</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={loadProof}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Allocation Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your Allocation</h2>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-sm text-gray-500">Total Allocation</span>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {proof ? (Number(proof.allocation) / 1e18).toLocaleString() : '0'} Tokens
            </p>
          </div>

          <div>
            <span className="text-sm text-gray-500">Claimed</span>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              {claimedAmount ? (Number(claimedAmount) / 1e18).toLocaleString() : '0'}
            </p>
          </div>

          <div>
            <span className="text-sm text-gray-500">Claimable Now</span>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {claimableAmount ? (Number(claimableAmount) / 1e18).toLocaleString() : '0'}
            </p>
          </div>
        </div>
      </div>

      {/* Vesting Timeline */}
      {hasSchedule && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Vesting Schedule</h2>

          <div className="space-y-4">
            {/* TGE */}
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full ${now >= tge ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              <div className="ml-3 flex-1">
                <div className="flex justify-between">
                  <span className="font-medium">
                    TGE ({Number(vestingSchedule.tgeUnlockBps || 0) / 100}%)
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(tge * 1000).toLocaleDateString()}
                  </span>
                </div>
                {proof && (
                  <p className="text-sm text-gray-600 mt-1">
                    {(
                      (Number(proof.allocation) * Number(vestingSchedule.tgeUnlockBps || 0)) /
                      10000 /
                      1e18
                    ).toLocaleString()}{' '}
                    tokens
                  </p>
                )}
              </div>
            </div>

            {/* Cliff */}
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full ${now >= cliffEnd ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              <div className="ml-3 flex-1">
                <div className="flex justify-between">
                  <span className="font-medium">Cliff End</span>
                  <span className="text-sm text-gray-500">
                    {new Date(cliffEnd * 1000).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {Math.floor(Number(vestingSchedule.cliffDuration) / 86400)} days after TGE
                </p>
              </div>
            </div>

            {/* Vesting Progress Bar */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-medium">Linear Vesting</span>
                <span className="text-sm text-gray-500">{vestingProgress.toFixed(1)}%</span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${vestingProgress}%` }}
                />
              </div>

              <div className="flex justify-between mt-2 text-sm text-gray-500">
                <span>{new Date(cliffEnd * 1000).toLocaleDateString()}</span>
                <span>{new Date(vestingEnd * 1000).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Fully Vested */}
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full ${isFullyVested ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              <div className="ml-3 flex-1">
                <div className="flex justify-between">
                  <span className="font-medium">Fully Vested</span>
                  <span className="text-sm text-gray-500">
                    {new Date(vestingEnd * 1000).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Claim Action */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Claim Tokens</h2>

        {isCliffActive && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm">
              ⏳ Cliff period is active. Vesting will begin on{' '}
              {new Date(cliffEnd * 1000).toLocaleDateString()}.
            </p>
          </div>
        )}

        {claimableAmount && claimableAmount > 0n ? (
          <button
            onClick={handleClaim}
            disabled={isClaiming || isClaimed}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition text-lg"
          >
            {isClaiming
              ? 'Claiming...'
              : isClaimed
                ? '✅ Claimed!'
                : `Claim ${(Number(claimableAmount) / 1e18).toLocaleString()} Tokens`}
          </button>
        ) : (
          <div className="bg-gray-100 rounded-lg p-4">
            <p className="text-gray-600 text-center">No tokens available to claim at this time</p>
          </div>
        )}

        {/* Success Message */}
        {isClaimed && txHash && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium">Claim successful!</p>
            <a
              href={`https://testnet.bscscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-700 hover:text-green-900 underline text-sm mt-1 block"
            >
              View transaction →
            </a>
          </div>
        )}

        {/* Error */}
        {(error || claimError) && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error || claimError?.message || 'Claim failed'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
