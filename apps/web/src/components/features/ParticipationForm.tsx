'use client';

import { useState } from 'react';
import { AmountInput, Button, ConfirmModal, useToast } from '@/components/ui';
import { Card, CardContent } from '@/components/ui';
import { useContribute } from '@/lib/web3/presale-hooks';
import { useAccount, useBalance } from 'wagmi';
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
  projectType?: 'presale' | 'fairlaunch';
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
}: ParticipationFormProps) {
  const [amount, setAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const { address } = useAccount();
  const { data: balanceData } = useBalance({ address });

  // Presale contribute hook (V2.4 — supports referrer)
  const { contribute: presaleContribute, isPending: isPresaleContributing } = useContribute();

  // Resolve referrer: query param ?ref= → fallback to zero
  const refParam = searchParams.get('ref') || '';
  const referrer = isAddress(refParam) ? refParam : zeroAddress;

  const userBalance = balanceData
    ? parseFloat(formatUnits(balanceData.value, balanceData.decimals))
    : 0;

  const amountNum = parseFloat(amount) || 0;
  const isAmountValid =
    amountNum >= minContribution && amountNum <= maxContribution && amountNum <= userBalance;

  // Button is enabled only if: wallet connected, contract exists, and amount is valid
  const canParticipate = !!address && !!contractAddress && isAmountValid;

  const handleMaxClick = () => {
    const maxValue = Math.min(maxContribution, userBalance);
    setAmount(maxValue.toString());
  };

  const handleSubmit = async () => {
    if (!canParticipate || !contractAddress) return;

    try {
      // Use presale contribute hook with referrer
      await presaleContribute({
        roundAddress: contractAddress as `0x${string}`,
        amount: BigInt(Math.floor(amountNum * 1e18)), // Convert to wei
        referrer: referrer as `0x${string}`,
      });

      showToast('success', `Successfully contributed ${amount} ${network}`);
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
              🔗 Referral: {referrer.slice(0, 6)}…{referrer.slice(-4)}
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
