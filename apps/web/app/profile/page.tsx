import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, PageContainer } from '@/components/layout';
import { getUserProfile } from '@/lib/data/profile';
import { getUserStatsMultiChain } from '@/lib/data/multi-chain-stats';
import { getServerSession } from '@/lib/auth/session';
import { ProfileClientContent } from './ProfileClientContent';
import { Card, CardContent } from '@/components/ui';

export default async function ProfilePage() {
  // Get session and fetch data server-side
  const session = await getServerSession();
  const profile = await getUserProfile();

  // Fetch multi-chain statistics if user is authenticated
  const multiChainStats = session ? await getUserStatsMultiChain(session.userId) : null;

  // If user is not authenticated, show login prompt
  if (!profile) {
    return (
      <div className="min-h-screen bg-bg-page pb-20">
        <PageHeader title="Profile" />
        <PageContainer className="py-4">
          <Card>
            <CardContent className="text-center py-12">
              <h2 className="text-heading-lg mb-4">Connect Your Wallet</h2>
              <p className="text-body-sm text-text-secondary mb-6">
                Please connect your wallet to view your profile
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-primary-main text-primary-text rounded-md font-medium hover:bg-primary-hover transition-colors"
              >
                Go to Home
              </Link>
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return <ProfileClientContent initialProfile={profile} multiChainStats={multiChainStats} />;
}
