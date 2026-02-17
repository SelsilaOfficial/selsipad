import { Card, CardContent, EmptyState, EmptyIcon, StatusBadge } from '@/components/ui';
import { PageHeader, PageContainer } from '@/components/layout';
import { getRewards } from '@/lib/data/rewards';
import { formatDistance } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function RewardsHistoryPage() {
  const allRewards = await getRewards();

  return (
    <div className="min-h-screen bg-bg-page pb-20">
      <PageHeader showBack title="Rewards History" />

      <PageContainer className="py-4 space-y-4">
        {allRewards.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<EmptyIcon />}
                title="No reward history"
                description="Your claimed and unclaimed rewards will appear here"
              />
            </CardContent>
          </Card>
        ) : (
          allRewards.map((reward) => (
            <Card key={reward.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">
                        {reward.type === 'referral'
                          ? '👥'
                          : reward.type === 'contribution'
                            ? '💰'
                            : reward.type === 'social'
                              ? '💬'
                              : '🎯'}
                      </span>
                      <h4 className="text-heading-sm">{reward.description}</h4>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge status={reward.claimed ? 'success' : 'pending'} />
                      <span className="text-caption text-text-secondary">
                        {formatDistance(new Date(reward.created_at), new Date(), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-heading-md font-bold tabular-nums ${
                        reward.claimed ? 'text-text-primary' : 'text-status-success-text'
                      }`}
                    >
                      +{reward.amount} {reward.currency}
                    </p>
                    <p className="text-caption text-text-tertiary mt-1">
                      {reward.claimed ? 'Claimed' : 'Pending'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </PageContainer>
    </div>
  );
}
