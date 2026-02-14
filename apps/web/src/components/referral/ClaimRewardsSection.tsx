'use client';

import { useState } from 'react';
import { Sparkles, AlertTriangle, Shield, Loader2 } from 'lucide-react';
import type { RewardChain } from './ChainRewardToggle';

interface ClaimRequirements {
  hasBlueCheck: boolean;
  hasActiveReferral: boolean;
}

interface ClaimRewardsSectionProps {
  chain: RewardChain;
  pendingAmount: string;
  currency: string;
  requirements: ClaimRequirements;
  onClaim: (chain: RewardChain) => Promise<void>;
}

export function ClaimRewardsSection({
  chain,
  pendingAmount,
  currency,
  requirements,
  onClaim,
}: ClaimRewardsSectionProps) {
  const [claiming, setClaiming] = useState(false);

  const canClaim =
    requirements.hasBlueCheck && requirements.hasActiveReferral && parseFloat(pendingAmount) > 0;

  const handleClaim = async () => {
    if (!canClaim || claiming) return;
    setClaiming(true);
    try {
      await onClaim(chain);
    } finally {
      setClaiming(false);
    }
  };

  // Build warning messages
  const warnings: string[] = [];
  if (!requirements.hasBlueCheck) warnings.push('Blue Check badge required.');
  if (!requirements.hasActiveReferral) warnings.push('Minimum 1 active referral required.');

  return (
    <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 p-5 sm:p-6 mb-6">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#39AEC4]" />
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">Ready to Claim Rewards?</h3>
            {!canClaim && (
              <p className="text-xs text-gray-500">
                {!requirements.hasBlueCheck
                  ? 'Get Blue Check badge to unlock claiming'
                  : 'Complete requirements below to claim'}
              </p>
            )}
          </div>
        </div>

        {/* Claim Button */}
        <button
          onClick={handleClaim}
          disabled={!canClaim || claiming}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            canClaim
              ? 'bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white hover:shadow-lg hover:shadow-[#39AEC4]/20 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
          }`}
        >
          {claiming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Claiming...
            </>
          ) : (
            <>
              <span className="text-base">$</span>
              Claim Rewards
            </>
          )}
        </button>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-300">{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Success state when all requirements met */}
      {canClaim && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Shield className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-xs text-emerald-300">
            You have{' '}
            <span className="font-bold text-white">
              {pendingAmount} {currency}
            </span>{' '}
            ready to claim on {chain === 'evm' ? 'EVM' : 'Solana'}
          </span>
        </div>
      )}
    </div>
  );
}
