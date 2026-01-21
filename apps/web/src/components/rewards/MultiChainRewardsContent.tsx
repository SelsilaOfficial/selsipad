/**
 * Multi-Chain Rewards Page
 * Display rewards grouped by blockchain with filtering
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, Button, EmptyState, EmptyIcon, useToast } from '@/components/ui';
import { PageHeader, PageContainer } from '@/components/layout';
import { ChainFilter } from '@/components/rewards/ChainFilter';
import { formatChainName } from '@/lib/utils/chain';
import { formatDistance } from 'date-fns';

// Local type definitions (no server imports)
interface RewardDetail {
  id: string;
  chain: string;
  amount: number;
  token: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
  usdEstimate?: number;
}

interface ChainRewards {
  chain: string;
  chainName: string;
  rewards: RewardDetail[];
  totalAmount: number;
  totalUSD: number;
}

// Local helper function
function getSourceTypeName(sourceType: string): string {
  const mapping: Record<string, string> = {
    PRESALE: 'Presale Referral',
    FAIRLAUNCH: 'Fairlaunch Referral',
    BONDING: 'Bonding Curve Referral',
    BLUECHECK: 'Blue Check Subscription',
  };
  return mapping[sourceType] || sourceType;
}

interface MultiChainRewardsContentProps {
  initialRewards: ChainRewards[];
}

export function MultiChainRewardsContent({ initialRewards }: MultiChainRewardsContentProps) {
  const [rewardsByChain, setRewardsByChain] = useState<ChainRewards[]>(initialRewards);
  const [selectedChain, setSelectedChain] = useState<string>('ALL');
  const { showToast } = useToast();

  // Get unique chains
  const chains = rewardsByChain.map((r) => r.chainName);

  // Filter rewards by selected chain
  const filteredRewards =
    selectedChain === 'ALL'
      ? rewardsByChain
      : rewardsByChain.filter((r) => r.chainName === selectedChain);

  // Calculate totals
  const totalRewards = filteredRewards.reduce((sum, chain) => sum + chain.rewards.length, 0);
  const totalUSD = filteredRewards.reduce((sum, chain) => sum + chain.totalUSD, 0);

  const handleClaimReward = async (rewardId: string, chain: string) => {
    // TODO: Implement chain switching + claim logic
    showToast('info', `Claim on ${chain} - Coming soon`);
  };

  const handleClaimAllChain = async (chain: string) => {
    // TODO: Implement batch claim for specific chain
    showToast('info', `Claim all on ${chain} - Coming soon`);
  };

  return (
    <div className="min-h-screen bg-bg-page pb-20">
      <PageHeader title="Rewards" />

      <PageContainer className="py-4 space-y-6">
        {/* Summary Card */}
        <Card variant="bordered" className="border-l-4 border-primary-main">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption text-text-secondary">Total Claimable Rewards</p>
                <p className="text-display-md font-bold text-text-primary">
                  {totalRewards} Rewards
                </p>
                {totalUSD > 0 && (
                  <p className="text-body-sm text-text-secondary">~${totalUSD.toFixed(2)} USD</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chain Filter */}
        {chains.length > 0 && (
          <ChainFilter
            chains={chains}
            selectedChain={selectedChain}
            onChainChange={setSelectedChain}
          />
        )}

        {/* Rewards by Chain */}
        <div className="space-y-4">
          {filteredRewards.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<EmptyIcon />}
                  title="No rewards available"
                  description={
                    selectedChain === 'ALL'
                      ? 'Start participating to earn rewards!'
                      : `No rewards on ${selectedChain}`
                  }
                />
              </CardContent>
            </Card>
          ) : (
            filteredRewards.map((chainData) => (
              <Card key={chainData.chain}>
                <CardContent className="space-y-3">
                  {/* Chain Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary-soft rounded-full flex items-center justify-center text-primary-main font-semibold">
                        {chainData.chainName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-heading-md">{chainData.chainName}</h3>
                        <p className="text-caption text-text-secondary">
                          {chainData.rewards.length} reward
                          {chainData.rewards.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    {chainData.rewards.length > 1 && (
                      <Button size="sm" onClick={() => handleClaimAllChain(chainData.chain)}>
                        Claim All
                      </Button>
                    )}
                  </div>

                  {/* Rewards List */}
                  <div className="space-y-2">
                    {chainData.rewards.map((reward) => (
                      <div
                        key={reward.id}
                        className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg hover:bg-bg-elevated-hover transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">
                              {reward.sourceType === 'PRESALE'
                                ? '🚀'
                                : reward.sourceType === 'FAIRLAUNCH'
                                  ? '⚡'
                                  : reward.sourceType === 'BONDING'
                                    ? '💎'
                                    : '✨'}
                            </span>
                            <h4 className="text-body-sm font-medium">
                              {getSourceTypeName(reward.sourceType)}
                            </h4>
                          </div>
                          <p className="text-caption text-text-tertiary">
                            {formatDistance(new Date(reward.createdAt), new Date(), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-heading-sm font-bold text-success-main">
                              +{reward.amount.toFixed(2)} {reward.token}
                            </p>
                            {reward.usdEstimate && (
                              <p className="text-caption text-text-tertiary">
                                ~${reward.usdEstimate.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleClaimReward(reward.id, chainData.chain)}
                            className="px-3 py-1.5 bg-primary-main text-primary-text rounded-lg text-caption font-medium hover:bg-primary-hover transition-colors"
                          >
                            Claim
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chain Total */}
                  <div className="pt-3 border-t border-border-subtle flex justify-between items-center">
                    <span className="text-body-sm text-text-secondary">Chain Total</span>
                    <span className="text-heading-sm font-bold">
                      {chainData.totalAmount.toFixed(2)} {chainData.rewards[0]?.token || 'USDT'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </PageContainer>
    </div>
  );
}
