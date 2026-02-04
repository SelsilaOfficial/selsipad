/**
 * Rewards Page - Referral Dashboard
 * Shows user's referral statistics, earnings, and referred users
 */

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { getReferralStats } from '@/actions/referral/get-stats';
import { PageHeader, PageContainer } from '@/components/layout';
import { ReferralStatsCards } from '@/components/referral/ReferralStatsCards';
import { ReferralList } from '@/components/referral/ReferralList';
import { ReferralExplainer } from '@/components/referral/ReferralExplainer';
import { ReferralCodeDisplay } from '@/components/referral/ReferralCodeDisplay';

export default async function RewardsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  // Fetch referral statistics
  const { success, stats, error } = await getReferralStats();

  if (!success || !stats) {
    console.error('Failed to load referral stats:', error);
    // Show empty state but don't redirect
  }

  return (
    <div className="min-h-screen bg-bg-page pb-20">
      <PageHeader title="Referral Rewards" />
      <PageContainer className="py-6">
        {stats ? (
          <div className="space-y-6">
            {/* Stats Cards */}
            <ReferralStatsCards stats={stats} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content - 2/3 width on desktop */}
              <div className="lg:col-span-2 space-y-6">
                <ReferralList referredUsers={stats.referredUsers} />
              </div>

              {/* Sidebar - 1/3 width on desktop */}
              <div className="space-y-6">
                <ReferralCodeDisplay />
                <ReferralExplainer />
              </div>
            </div>
          </div>
        ) : (
          // Error state
          <div className="text-center py-12">
            <p className="text-xl mb-2">Failed to load referral data</p>
            <p className="text-sm text-gray-400">{error || 'Please try again later'}</p>
          </div>
        )}
      </PageContainer>
    </div>
  );
}
