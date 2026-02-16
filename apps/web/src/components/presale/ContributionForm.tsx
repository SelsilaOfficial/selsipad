'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { parseEther, formatEther, isAddress } from 'viem';
import type { Address } from 'viem';
import { useSearchParams } from 'next/navigation';
import { StatusPill } from './StatusPill';
import {
  useContribute,
  useTransactionConfirmation,
  useUserContribution,
} from '@/lib/web3/presale-hooks';

interface ContributionFormProps {
  roundAddress: Address;
  roundId: string; // For backend logging (optional)
  paymentToken: string;
  min?: bigint;
  max?: bigint;
}

export function ContributionForm({
  roundAddress,
  roundId,
  paymentToken,
  min,
  max,
}: ContributionFormProps) {
  const { address, isConnected } = useAccount();
  const { data: userContribution, refetch: refetchContribution } = useUserContribution(
    roundAddress,
    address
  ) as { data: bigint | undefined; refetch: () => void; [key: string]: any };

  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const refParam = searchParams.get('ref') || '';
  const [referrer, setReferrer] = useState<string>('');
  const [referrerLabel, setReferrerLabel] = useState<string>('');
  const [dbSaved, setDbSaved] = useState(false);
  const confirmedHashRef = useRef<string | null>(null);

  // Resolve referrer: if refParam is a wallet address use directly,
  // otherwise resolve referral code → wallet address via API
  // Also persist to localStorage so it works across page navigation
  useEffect(() => {
    // Save ref param to localStorage if present (for cross-page persistence)
    if (refParam) {
      localStorage.setItem('selsipad_referral', refParam);
    }

    // Use URL param if present, otherwise check localStorage
    const effectiveRef = refParam || localStorage.getItem('selsipad_referral') || '';

    if (!effectiveRef) return;

    if (isAddress(effectiveRef)) {
      setReferrer(effectiveRef);
      setReferrerLabel(effectiveRef);
      return;
    }

    // Resolve referral code → wallet address
    const resolveReferralCode = async () => {
      try {
        const res = await fetch(
          `/api/v1/referral/resolve?code=${encodeURIComponent(effectiveRef)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.wallet_address && isAddress(data.wallet_address)) {
            setReferrer(data.wallet_address as Address);
            setReferrerLabel(
              `${data.wallet_address.slice(0, 6)}…${data.wallet_address.slice(-4)} (${effectiveRef})`
            );
            console.log('[Presale Referral] Resolved code', effectiveRef, '→', data.wallet_address);
          }
        }
      } catch (err) {
        console.error('[Presale Referral] Failed to resolve code:', err);
      }
    };

    resolveReferralCode();
  }, [refParam]);

  // Contribution transaction
  const { contribute, hash, isPending, error: txError } = useContribute();
  const { isLoading: isConfirming, isSuccess } = useTransactionConfirmation(hash);

  const handleContribute = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    const contributionAmount = parseFloat(amount);
    if (isNaN(contributionAmount) || contributionAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const amountWei = parseEther(amount);

    // Validate against min/max
    if (min && amountWei < min) {
      setError(`Minimum contribution is ${formatEther(min)} ${paymentToken}`);
      return;
    }

    if (max && amountWei > max) {
      setError(`Maximum contribution is ${formatEther(max)} ${paymentToken}`);
      return;
    }

    setError(null);

    try {
      // Validate referrer is a valid address before passing
      // Fallback: if no referrer, use master referrer (platform wallet) so referral pool is always distributed
      const MASTER_REFERRER = process.env.NEXT_PUBLIC_MASTER_REFERRER || '';
      const resolvedReferrer: Address =
        referrer && isAddress(referrer)
          ? (referrer as Address)
          : isAddress(MASTER_REFERRER)
            ? (MASTER_REFERRER as Address)
            : '0x0000000000000000000000000000000000000000';

      await contribute({
        roundAddress,
        amount: amountWei,
        referrer: resolvedReferrer,
      });
    } catch (err: any) {
      console.error('Contribution error:', err);
      setError(err.message || 'Transaction failed');
    }
  };

  // Persist contribution to DB after on-chain TX confirmation
  useEffect(() => {
    if (!isSuccess || !hash || !address || !amount) return;
    if (confirmedHashRef.current === hash) return; // already confirmed this hash
    confirmedHashRef.current = hash;

    const confirmContribution = async () => {
      try {
        const res = await fetch(`/api/rounds/${roundId}/contribute/confirm`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            round_id: roundId,
            tx_hash: hash,
            amount: parseFloat(amount),
            wallet_address: address,
            referral_address: referrer || undefined,
          }),
        });
        if (res.ok) {
          setDbSaved(true);
        } else {
          console.warn('Failed to confirm contribution in DB:', await res.text());
        }
      } catch (err) {
        console.error('DB confirm error:', err);
      }
    };

    confirmContribution();

    // Reset form after short delay
    const timer = setTimeout(() => {
      setAmount('');
      setReferrer('');
      setDbSaved(false);
      refetchContribution();
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, hash]);

  const setPresetAmount = (percentage: number) => {
    if (!max) return;
    const presetAmount = (Number(max) * percentage) / 100;
    setAmount(formatEther(BigInt(Math.floor(presetAmount))));
  };

  if (!isConnected) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
        <p className="text-yellow-800 dark:text-yellow-300 mb-4">
          Connect your wallet to participate in this presale
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Status */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-800 dark:text-green-300 font-medium">
              Wallet Connected
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 font-mono mt-1">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
      </div>

      {/* Amount Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Contribution Amount
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Enter amount (${min ? `min ${formatEther(min)}` : '0'})`}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isPending || isConfirming}
          />
          <span className="absolute right-4 top-3 text-gray-500 dark:text-gray-400">
            {paymentToken}
          </span>
        </div>

        {/* Quick presets */}
        {max && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[25, 50, 75, 100].map((percent) => (
              <button
                key={percent}
                onClick={() => setPresetAmount(percent)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                disabled={isPending || isConfirming}
              >
                {percent}%
              </button>
            ))}
          </div>
        )}

        {/* Min/Max Info */}
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-2">
          {min && (
            <span>
              Min: {formatEther(min)} {paymentToken}
            </span>
          )}
          {max && (
            <span>
              Max: {formatEther(max)} {paymentToken}
            </span>
          )}
        </div>
      </div>

      {/* Referrer (Optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Referrer Address (Optional)
        </label>
        <input
          type="text"
          value={referrer}
          onChange={(e) => setReferrer(e.target.value)}
          placeholder="0x... or referral code"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={isPending || isConfirming}
        />
        {referrerLabel && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            ✓ Referrer: {referrerLabel}
          </p>
        )}
      </div>

      {/* Error Message */}
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      ) : txError ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-300">
            {txError.message || 'Transaction failed'}
          </p>
        </div>
      ) : null}

      {/* Transaction Status */}
      {hash && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800 dark:text-blue-300">Transaction Status</p>
              <span
                className={`text-sm font-medium ${isConfirming ? 'text-yellow-600' : 'text-green-600'}`}
              >
                {isConfirming ? 'Pending...' : isSuccess ? 'Confirmed ✓' : ''}
              </span>
            </div>
            <a
              href={`https://testnet.bscscan.com/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all block"
            >
              View on BscScan ↗
            </a>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleContribute}
        disabled={isPending || isConfirming || !amount}
        className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending || isConfirming ? 'Processing...' : 'Contribute'}
      </button>

      {/* Your Contribution */}
      {userContribution && (userContribution as any) > 0n && (
        <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Your Total Contribution</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatEther(userContribution as any)} {paymentToken}
          </p>
        </div>
      )}
    </div>
  );
}
