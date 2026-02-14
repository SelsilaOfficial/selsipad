'use client';

import { useState } from 'react';
import { ChainRewardToggle, type RewardChain } from '@/components/referral/ChainRewardToggle';
import { ClaimRewardsSection } from '@/components/referral/ClaimRewardsSection';
import { ReferralStatsCards, type ChainStats } from '@/components/referral/ReferralStatsCards';
import { ReferralList } from '@/components/referral/ReferralList';
import { ReferralExplainer } from '@/components/referral/ReferralExplainer';
import { ReferralCodeDisplay } from '@/components/referral/ReferralCodeDisplay';
import { claimRewards } from '@/actions/referral/claim-rewards';
import type { ReferralStats } from '@/actions/referral/get-stats';
import { useToast } from '@/components/ui';

interface RewardsClientContentProps {
  stats: ReferralStats;
}

export function RewardsClientContent({ stats }: RewardsClientContentProps) {
  const [selectedChain, setSelectedChain] = useState<RewardChain>('evm');
  const { showToast } = useToast();

  // Derive per-chain stats
  const chainStats: ChainStats =
    selectedChain === 'evm'
      ? {
          totalReferrals: stats.totalReferrals,
          activeReferrals: stats.activeReferrals,
          pendingReferrals: stats.pendingReferrals,
          totalEarningsUsd: stats.evmTotalUsd,
          pendingEarningsUsd:
            stats.evmPendingNative !== '0.000000'
              ? stats.evmTotalUsd // Show USD equivalent of pending
              : '0.00',
        }
      : {
          totalReferrals: stats.totalReferrals,
          activeReferrals: stats.activeReferrals,
          pendingReferrals: stats.pendingReferrals,
          totalEarningsUsd: stats.solanaTotalUsd,
          pendingEarningsUsd:
            stats.solanaPendingNative !== '0.000000' ? stats.solanaTotalUsd : '0.00',
        };

  const pendingAmount =
    selectedChain === 'evm' ? stats.evmPendingNative : stats.solanaPendingNative;
  const currency = selectedChain === 'evm' ? 'BNB' : 'SOL';

  const handleClaim = async (chain: RewardChain) => {
    const result = await claimRewards(chain);
    if (result.success) {
      showToast('success', `Successfully claimed ${result.claimedAmount} ${result.currency}!`);
    } else {
      showToast('error', result.error || 'Failed to claim rewards');
    }
  };

  return (
    <>
      {/* Chain Toggle */}
      <ChainRewardToggle
        selected={selectedChain}
        onChange={setSelectedChain}
        evmUsdTotal={stats.evmTotalUsd}
        solanaUsdTotal={stats.solanaTotalUsd}
      />

      {/* Stats Grid */}
      <ReferralStatsCards stats={chainStats} chain={selectedChain} />

      {/* Claim Section */}
      <div className="mt-6">
        <ClaimRewardsSection
          chain={selectedChain}
          pendingAmount={pendingAmount}
          currency={currency}
          requirements={{
            hasBlueCheck: stats.hasBlueCheck,
            hasActiveReferral: stats.hasActiveReferral,
          }}
          onClaim={handleClaim}
        />
      </div>

      {/* Main Grid Layout */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Referral List */}
        <div className="lg:col-span-2">
          <ReferralList referredUsers={stats.referredUsers} />
        </div>

        {/* Right Column - Code & Explainer */}
        <div className="space-y-4 sm:space-y-6">
          <ReferralCodeDisplay />
          <ReferralExplainer />
        </div>
      </div>
    </>
  );
}
