/**
 * Rewards Page - Referral Dashboard
 * Shows user's referral statistics, earnings, and referred users
 * Premium design with AnimatedBackground and glassmorphism
 */

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { getReferralStats } from '@/actions/referral/get-stats';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';
import { ReferralStatsCards } from '@/components/referral/ReferralStatsCards';
import { ReferralList } from '@/components/referral/ReferralList';
import { ReferralExplainer } from '@/components/referral/ReferralExplainer';
import { ReferralCodeDisplay } from '@/components/referral/ReferralCodeDisplay';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function RewardsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  // Fetch referral statistics
  const { success, stats, error } = await getReferralStats();

  if (!success || !stats) {
    console.error('Failed to load referral stats:', error);
  }

  return (
    <div className="min-h-screen bg-black text-white dark relative overflow-hidden">
      {/* Animated Background Layer */}
      <AnimatedBackground />

      {/* Subtle Dark Overlay for Readability */}
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 max-w-7xl">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors">
                <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">Referral Rewards</h1>
                <p className="text-xs text-gray-400">Track your earnings</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 max-w-7xl">
          {stats ? (
            <>
              {/* Stats Grid */}
              <ReferralStatsCards stats={stats} />

              {/* Main Grid Layout */}
              <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mt-6">
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
          ) : (
            <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-8 sm:p-12 shadow-xl shadow-[#756BBA]/10 text-center min-h-[300px] flex flex-col items-center justify-center">
              <p className="text-xl mb-2 text-white">Failed to load referral data</p>
              <p className="text-sm text-gray-500">{error || 'Please try again later'}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
