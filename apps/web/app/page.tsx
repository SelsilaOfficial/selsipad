import {
  TrendingUp,
  Rocket,
  Mic2,
  Shield,
  Coins,
  Trophy,
  MessageCircle,
  User,
  PlusCircle,
} from 'lucide-react';
import {
  TrendingChart,
  FeatureListItem,
  SocialFeedCard,
  TrendingBondingCurveCard,
} from '@/components/home/FigmaComponents';
import { SplineBackground } from '@/components/home/SplineBackground';
import { MultiChainConnectWallet } from '@/components/wallet/MultiChainConnectWallet';
import { getTrendingStats } from '@/actions/feed/get-trending-stats';
import Link from 'next/link';

export default async function HomePage() {
  const trendingStats = await getTrendingStats();
  return (
    <div className="min-h-screen bg-black text-white dark relative overflow-hidden font-sans">
      {/* Animated Background Layer */}
      <SplineBackground />

      {/* Subtle Dark Overlay for Readability */}
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#39AEC4] to-[#756BBA] bg-clip-text text-transparent font-audiowide">
                  SELSIPAD
                </span>
              </div>

              {/* Wallet Connect */}
              <div className="flex items-center gap-2 sm:gap-3">
                <MultiChainConnectWallet />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-[1440px] pb-24 md:pb-8 space-y-6 sm:space-y-8">
          {/* Top Section: Trending & Features */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Trending Card - Left Column */}
            <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-5 sm:p-8 shadow-xl shadow-[#756BBA]/10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-semibold">Trending Feed</h2>
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-[#39AEC4] text-left" />
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-[200px]">
                <TrendingChart data={trendingStats.chartData} />
              </div>

              {/* Top Project */}
              <div className="mt-6 sm:mt-auto p-4 sm:p-5 rounded-[20px] bg-gradient-to-br from-[#39AEC4]/20 to-[#39AEC4]/5 border border-[#39AEC4]/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">Most Active 24h</p>
                    <p className="text-lg sm:text-xl font-bold">
                      {trendingStats.topProject ? `$${trendingStats.topProject.symbol}` : 'No data'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl sm:text-3xl font-bold text-[#39AEC4]">
                      {trendingStats.totalPosts24h > 0 ? `${trendingStats.totalPosts24h}` : '0'}
                    </p>
                    <p className="text-xs text-gray-400">posts today</p>
                  </div>
                </div>
              </div>

              {/* View Feed Button */}
              <Link
                href="/feed"
                className="mt-4 sm:mt-6 w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-[20px] bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/50 font-semibold text-sm sm:text-base text-center block"
              >
                View Feed
              </Link>
            </div>

            {/* Right Column Features */}
            <div className="flex flex-col gap-3 sm:gap-4 h-full">
              <div className="grid grid-cols-1 gap-3 sm:gap-4 h-full">
                {/* Desktop-Only Items */}
                <div className="hidden lg:contents">
                  <FeatureListItem
                    icon={<User className="w-6 h-6 sm:w-7 sm:h-7" />}
                    title="Profile"
                    description="Manage Account"
                    color="#39AEC4"
                    href="/profile"
                  />
                  <FeatureListItem
                    icon={<PlusCircle className="w-6 h-6 sm:w-7 sm:h-7" />}
                    title="Create Project"
                    description="Launch New Token"
                    color="#39AEC4"
                    href="/create"
                  />
                </div>

                <FeatureListItem
                  icon={<Rocket className="w-6 h-6 sm:w-7 sm:h-7" />}
                  title="Launchpad"
                  description="New IDO Projects"
                  color="#39AEC4"
                  href="/explore"
                />
                <FeatureListItem
                  icon={<Mic2 className="w-6 h-6 sm:w-7 sm:h-7" />}
                  title="AMA"
                  description="Developer Q&A"
                  color="#39AEC4"
                  href="/ama"
                />
                <FeatureListItem
                  icon={<Shield className="w-6 h-6 sm:w-7 sm:h-7" />}
                  title="LP Lock"
                  description="Liquidity Protection"
                  color="#39AEC4"
                  href="/lock"
                />
                <FeatureListItem
                  icon={<Coins className="w-6 h-6 sm:w-7 sm:h-7" />}
                  title="Staking"
                  description="Earn Rewards"
                  color="#39AEC4"
                  href="/staking"
                />
                <FeatureListItem
                  icon={<Trophy className="w-6 h-6 sm:w-7 sm:h-7" />}
                  title="Rewards"
                  description="Claim Your Tokens"
                  color="#39AEC4"
                  href="/rewards"
                />
                <FeatureListItem
                  icon={<MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" />}
                  title="Selsi Feed"
                  description="Community Updates"
                  color="#39AEC4"
                  href="/feed"
                />
              </div>
            </div>
          </div>

          {/* Bonding Curve Section */}
          <div className="w-full">
            <TrendingBondingCurveCard />
          </div>

          {/* Social Feed Section - Hidden since it's now in the list? 
              Wait, the user wanted "Social Feed" in the list. 
              The screenshot shows "Social Feed" as a list item, not a huge card.
              However, the PREVIOUS component `SocialFeedCard` was a big card.
              The screenshot shows "Social Feed" in the LIST. 
              Maybe I should hide the big `SocialFeedCard` at the bottom or keep it?
              The user said "Social Feed" in the list.
              If I have a list item "Social Feed", maybe clicking it goes to the feed page?
              The screenshot shows it as a button/list item.
              But I still validly have the `SocialFeedCard` component which displays actual posts.
              The user said "statcard sosial feed ditampilkan di bawahnya statcard trending bonding curbe" (Step 4417).
              So the big card should probably STAY at the bottom.
              AND the list item "Social Feed" acts as a link/summary in the top section.
              So I will keep the big card at the bottom.
          */}
          <div className="w-full">
            <SocialFeedCard />
          </div>
        </main>
      </div>
    </div>
  );
}
