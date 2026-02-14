import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, PageContainer } from '@/components/layout';
import { getUserProfile } from '@/lib/data/profile';
import { getUserStatsMultiChain } from '@/lib/data/multi-chain-stats';
import { getServerSession } from '@/lib/auth/session';
import { ProfileClientContent } from './ProfileClientContent';
import { Card, CardContent } from '@/components/ui';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProfilePage() {
  // Get session ONCE - reuse everywhere
  const session = await getServerSession();

  if (!session) {
    return (
      <div className="min-h-screen bg-bg-page text-white pb-20">
        {/* Sticky Header with Back Button */}
        <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10">
          <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-white">Profile</h1>
          </div>
        </div>

        {/* Centered Connect Wallet Card */}
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center max-w-md w-full">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#39AEC4]/20 to-[#756BBA]/20 border border-white/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#39AEC4]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
              <p className="text-sm text-gray-400 mb-6">
                Please connect your wallet to view your profile
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white rounded-full font-bold hover:opacity-90 transition-all shadow-lg shadow-[#756BBA]/20"
              >
                Go to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fetch ALL data in parallel — single session, no redundant DB calls
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [profile, multiChainStats, badgesResult] = await Promise.all([
    // Pass session to avoid internal getServerSession() call
    getUserProfile(session),
    // Multi-chain stats
    getUserStatsMultiChain(session.userId),
    // Badges
    supabase
      .from('badge_instances')
      .select(
        `
        id,
        status,
        awarded_at,
        badge:badge_id (
          id,
          badge_key,
          name,
          description,
          icon_url,
          badge_type
        )
      `
      )
      .eq('user_id', session.userId)
      .eq('status', 'ACTIVE'),
  ]);

  const userBadges = badgesResult.data || [];

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

  return (
    <ProfileClientContent
      initialProfile={profile}
      multiChainStats={multiChainStats}
      userBadges={userBadges}
    />
  );
}
