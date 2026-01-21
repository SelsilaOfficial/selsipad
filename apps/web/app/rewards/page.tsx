/**
 * Rewards Page - Multi-Chain Support
 * Server-side data fetching with multi-chain display
 */

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { getRewardsByChain } from '@/lib/data/multi-chain-rewards';
import { MultiChainRewardsContent } from '@/components/rewards/MultiChainRewardsContent';
import { PageHeader, PageContainer } from '@/components/layout';
import { Card, CardContent } from '@/components/ui';

export default async function RewardsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  // Fetch multi-chain rewards
  const rewardsByChain = await getRewardsByChain(session.userId);

  // If no rewards, show empty state
  if (rewardsByChain.length === 0) {
    return (
      <div className="min-h-screen bg-bg-page pb-20">
        <PageHeader title="Rewards" />
        <PageContainer className="py-4">
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-heading-lg mb-2">No rewards yet</p>
              <p className="text-body-sm text-text-secondary">
                Start participating to earn rewards!
              </p>
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return <MultiChainRewardsContent initialRewards={rewardsByChain} />;
}
