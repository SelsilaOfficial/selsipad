'use client';

import { useState, useEffect } from 'react';
import { AmountInput, Button, ConfirmModal, useToast } from '@/components/ui';
import { Card, CardContent } from '@/components/ui';
import { useContribute } from '@/lib/web3/presale-hooks';
import { savePresaleContribution } from '@/actions/presale/save-contribution';
import { useAccount, useBalance, usePublicClient } from 'wagmi';
import { formatUnits, isAddress, zeroAddress } from 'viem';
import { useSearchParams } from 'next/navigation';

interface ParticipationFormProps {
  projectId: string;
  projectName: string;
  projectSymbol: string;
  network: string;
  contractAddress?: string;
  minContribution?: number;
  maxContribution?: number;
  projectType?: 'presale' | 'fairlaunch' | 'bonding_curve';
  raised?: number;
  target?: number; // hardcap
}

export function ParticipationForm({
  projectId,
  projectName,
  projectSymbol,
  network,
  contractAddress,
  minContribution = 0.1,
  maxContribution = 10,
  projectType = 'presale',
  raised = 0,
  target = 0,
}: ParticipationFormProps) {
  const [amount, setAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const { address } = useAccount();
  const { data: balanceData } = useBalance({ address });
  const publicClient = usePublicClient();

  // Presale contribute hook (V2.4 — supports referrer)
  const { contribute: presaleContribute, isPending: isPresaleContributing } = useContribute();

  // Resolve referrer wallet address from referral code or direct address
  // Fallback: use master referrer (platform wallet) so referral pool is always distributed
  // Also persist to localStorage so it works across page navigation
  const refParam = searchParams.get('ref') || '';
  const MASTER_REFERRER = process.env.NEXT_PUBLIC_MASTER_REFERRER || '';
  const defaultReferrer = isAddress(MASTER_REFERRER)
    ? (MASTER_REFERRER as `0x${string}`)
    : (zeroAddress as `0x${string}`);
  const [referrer, setReferrer] = useState<`0x${string}`>(defaultReferrer);
  const [referrerLabel, setReferrerLabel] = useState<string>('');

  useEffect(() => {
    // Save ref param to localStorage if present (for cross-page persistence)
    if (refParam) {
      localStorage.setItem('selsipad_referral', refParam);
    }

    // Use URL param if present, otherwise check localStorage
    const effectiveRef = refParam || localStorage.getItem('selsipad_referral') || '';

    const resolveReferrer = async () => {
      // 1. If we have a ref code/address from URL or localStorage, use it
      if (effectiveRef) {
        // If it's already a valid wallet address, use it directly
        if (isAddress(effectiveRef)) {
          setReferrer(effectiveRef as `0x${string}`);
          setReferrerLabel(effectiveRef);
          return;
        }

        // Otherwise, resolve referral code → wallet address via API
        try {
          const res = await fetch(
            `/api/v1/referral/resolve?code=${encodeURIComponent(effectiveRef)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.wallet_address && isAddress(data.wallet_address)) {
              setReferrer(data.wallet_address as `0x${string}`);
              setReferrerLabel(
                `${data.wallet_address.slice(0, 6)}…${data.wallet_address.slice(-4)} (${effectiveRef})`
              );
              console.log('[Referral] Resolved code', effectiveRef, '→', data.wallet_address);
              return;
            }
          }
        } catch (err) {
          console.error('[Referral] Failed to resolve code:', err);
        }
      }

      // 2. No ref from URL/localStorage — check DB for permanent referrer
      if (address) {
        try {
          const res = await fetch('/api/v1/referral/my-referrer', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data.referrer && isAddress(data.referrer)) {
              setReferrer(data.referrer as `0x${string}`);
              const code = data.code || '';
              setReferrerLabel(
                `${data.referrer.slice(0, 6)}…${data.referrer.slice(-4)}${code ? ` (${code})` : ''}`
              );
              // Persist to localStorage so subsequent navigations are instant
              if (code) localStorage.setItem('selsipad_referral', code);
              console.log('[Referral] Permanent referrer from DB:', data.referrer, code);
              return;
            }
          }
        } catch (err) {
          console.error('[Referral] Failed to fetch permanent referrer:', err);
        }
      }

      // 3. Final fallback: master referrer
      // (already set as default state, no action needed)
    };

    resolveReferrer();
  }, [refParam, address]);

  const userBalance = balanceData
    ? parseFloat(formatUnits(balanceData.value, balanceData.decimals))
    : 0;

  // Hardcap enforcement: remaining capacity
  const remainingCapacity = target > 0 ? Math.max(0, target - raised) : Infinity;
  const isHardcapReached = target > 0 && raised >= target;
  const effectiveMax = Math.min(maxContribution, remainingCapacity);

  const amountNum = parseFloat(amount) || 0;
  const isAmountValid =
    amountNum >= minContribution &&
    amountNum <= effectiveMax &&
    amountNum <= userBalance &&
    !isHardcapReached;

  // Button is enabled only if: wallet connected, contract exists, amount is valid, hardcap not reached
  const canParticipate = !!address && !!contractAddress && isAmountValid && !isHardcapReached;

  const handleMaxClick = () => {
    const maxValue = Math.min(effectiveMax, userBalance);
    setAmount(maxValue > 0 ? maxValue.toString() : '0');
  };

  const handleSubmit = async () => {
    if (!canParticipate || !contractAddress || !publicClient) return;

    try {
      // Use presale contribute hook with referrer
      const hash = await presaleContribute({
        roundAddress: contractAddress as `0x${string}`,
        amount: BigInt(Math.floor(amountNum * 1e18)), // Convert to wei
        referrer: referrer as `0x${string}`,
      });

      showToast('success', `Transaction sent! Waiting for confirmation...`);

      // Wait for on-chain confirmation, then save to database
      if (hash) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status === 'success') {
            // Save contribution to database for transaction history & referral tracking
            await savePresaleContribution({
              roundId: projectId,
              txHash: hash,
              amount: amount, // ETH/BNB amount string
              referrerCode: refParam || undefined,
            });
            showToast('success', `Successfully contributed ${amount} ${network}`);
          }
        } catch (dbErr: any) {
          console.warn('[Presale] DB save failed (on-chain tx succeeded):', dbErr);
          showToast('success', `Contributed ${amount} ${network} (history may update shortly)`);
        }
      }

      setConfirmOpen(false);
      setAmount('');
    } catch (error: any) {
      showToast('error', error?.message || 'Transaction failed, please try again');
    }
  };

  // Determine button text based on state
  const getButtonText = () => {
    if (!address) return 'Connect Wallet';
    if (!contractAddress) return 'Contract Not Available';
    if (!amount || amountNum === 0) return 'Enter Amount';
    if (amountNum < minContribution) return `Minimum ${minContribution} ${network}`;
    if (amountNum > maxContribution) return `Maximum ${maxContribution} ${network}`;
    if (amountNum > userBalance) return 'Insufficient Balance';
    return 'Participate';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-heading-md mb-2">Participate in {projectName}</h3>
            <p className="text-body-sm text-text-secondary">
              Contribute {network} to get ${projectSymbol} allocation
            </p>
          </div>

          <AmountInput
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            currency={network}
            balance={userBalance}
            onMaxClick={handleMaxClick}
          />

          <div className="flex items-center justify-between text-caption text-text-secondary">
            <span>
              Min: {minContribution} {network}
            </span>
            <span>
              Max: {maxContribution} {network}
            </span>
          </div>

          {/* Referrer indicator */}
          {referrer !== zeroAddress && (
            <div className="text-xs text-green-600 dark:text-green-400">
              🔗 Referral: {referrerLabel || `${referrer.slice(0, 6)}…${referrer.slice(-4)}`}
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => setConfirmOpen(true)}
            disabled={!canParticipate}
          >
            {getButtonText()}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSubmit}
        title="Confirm Participation"
        description={`You are about to contribute ${amount} ${network} to ${projectName}. This transaction cannot be reversed.`}
        confirmText="Confirm & Submit"
        variant="primary"
        isLoading={isPresaleContributing}
      />
    </div>
  );
}
