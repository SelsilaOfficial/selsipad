'use client';

import { useState } from 'react';
import { AmountInput, Button, ConfirmModal, useToast } from '@/components/ui';
import { Card, CardContent } from '@/components/ui';
import { useFairlaunchContribute } from '@/hooks/useFairlaunchContribute';
import { useAccount, useBalance } from 'wagmi';

interface ParticipationFormProps {
  projectId: string;
  projectName: string;
  projectSymbol: string;
  network: string;
  contractAddress?: string;
  minContribution?: number;
  maxContribution?: number;
}

export function ParticipationForm({
  projectId,
  projectName,
  projectSymbol,
  network,
  contractAddress,
  minContribution = 0.1,
  maxContribution = 10,
}: ParticipationFormProps) {
  const [amount, setAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { showToast } = useToast();
  
  const { address } = useAccount();
  const { data: balanceData } = useBalance({ address });
  const { contribute, isContributing } = useFairlaunchContribute();

  const userBalance = balanceData ? parseFloat(balanceData.formatted) : 0;

  const amountNum = parseFloat(amount) || 0;
  const isValid =
    amountNum >= minContribution && amountNum <= maxContribution && amountNum <= userBalance;

  const handleMaxClick = () => {
    const maxValue = Math.min(maxContribution, userBalance);
    setAmount(maxValue.toString());
  };

  const handleSubmit = async () => {
    if (!isValid || !contractAddress) return;

    try {
      const result = await contribute({
        fairlaunchAddress: contractAddress as `0x${string}`,
        amount,
      });

      if (result.success) {
        showToast('success', `Berhasil participate ${amount} ${network}`);
        setConfirmOpen(false);
        setAmount('');
      } else {
        showToast('error', result.error || 'Transaksi gagal, coba lagi');
      }
    } catch (error) {
      showToast('error', 'Transaksi gagal, coba lagi');
    }
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

          <Button className="w-full" onClick={() => setConfirmOpen(true)} disabled={!isValid}>
            {!amount || amountNum === 0
              ? 'Enter Amount'
              : amountNum < minContribution
                ? `Minimum ${minContribution} ${network}`
                : amountNum > maxContribution
                  ? `Maximum ${maxContribution} ${network}`
                  : amountNum > userBalance
                    ? 'Insufficient Balance'
                    : 'Participate'}
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
        isLoading={isContributing}
      />
    </div>
  );
}
