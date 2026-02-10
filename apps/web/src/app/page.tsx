import {
  Wallet,
  TrendingUp,
  Rocket,
  Timer,
  Shield,
  Coins,
  Trophy,
  MessageCircle,
} from 'lucide-react';
import {
  TrendingChart,
  FeatureListItem,
  SocialFeedCard,
  TrendingBondingCurveCard,
  NavigationBar,
} from '@/components/home/FigmaComponents';
import { SplineBackground } from '@/components/home/SplineBackground';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white dark relative overflow-hidden font-sans">
      {/* Animated Background Layer */}
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

              {/* Network Badge & Wallet Connect */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden sm:block px-4 py-2 rounded-full bg-[#39AEC4]/10 border border-[#39AEC4]/30 backdrop-blur-sm">
                  <span className="text-sm">🟢 BSC Network</span>
                </div>
                <button className="px-3 py-2 sm:px-6 sm:py-2.5 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all flex items-center gap-1 sm:gap-2 shadow-lg shadow-[#756BBA]/50">
                  <Wallet className="w-4 h-4" />
                  <span className="text-sm sm:text-base font-medium">Connect</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-[1440px] pb-24 md:pb-8 space-y-6 sm:space-y-8">
          {/* Top Section: Trending & Features */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Trending Card - Left Column (5 columns) */}
            <div className="lg:col-span-4 rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-5 sm:p-8 shadow-xl shadow-[#756BBA]/10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-semibold">Trending Feed</h2>
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-[#39AEC4] text-left" />
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-[200px]">
                <TrendingChart />
              </div>

              {/* Top Gainer */}
              <div className="mt-6 sm:mt-auto p-4 sm:p-5 rounded-[20px] bg-gradient-to-br from-[#39AEC4]/20 to-[#39AEC4]/5 border border-[#39AEC4]/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-400 mb-1">Top Gainer 24h</p>
                    <p className="text-lg sm:text-xl font-bold">$SELSI</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl sm:text-3xl font-bold text-[#39AEC4]">+15.4%</p>
                  </div>
                </div>
              </div>

              {/* View Analytics Button */}
              <button className="mt-4 sm:mt-6 w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-[20px] bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/50 font-semibold text-sm sm:text-base">
                View Analytics
              </button>
            </div>

            {/* Middle Column Features - (4 columns) */}
            <div className="lg:col-span-4 flex flex-col gap-3 sm:gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4 h-full">
                <FeatureListItem
                  icon={<Rocket className="w-6 h-6 sm:w-7 sm:h-7" />}
                  title="Launchpad"
                  description="New IDO Projects"
                  color="#39AEC4"
                />
                <FeatureListItem
                  icon={<Timer className="w-6 h-6 sm:w-7 sm:h-7" />}
                  title="Vesting"
                  description="Token Release Schedule"
                  color="#39AEC4"
                />
                <FeatureListItem
                  icon={<Shield className="w-6 h-6 sm:w-7 sm:h-7" />}
                  title="LP Lock"
                  description="Liquidity Protection"
                  color="#39AEC4"
                />
                <FeatureListItem
                  icon={<Coins className="w-6 h-6 sm:w-7 sm:h-7" />}
                  title="Staking"
                  description="Earn Rewards"
                  color="#39AEC4"
                />
              </div>
            </div>

            {/* Right Column - Social Feed (4 columns) */}
            <div className="lg:col-span-4 h-full">
              <SocialFeedCard />
            </div>
          </div>

          {/* Bonding Curve Section - Full Width Below */}
          <div className="w-full">
            <TrendingBondingCurveCard />
          </div>

          {/* Bottom Features Grid for Mobile/Tablet balance if needed */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
            <FeatureListItem
              icon={<Trophy className="w-7 h-7" />}
              title="Rewards"
              description="Claim Your Tokens"
              color="#39AEC4"
            />
            <FeatureListItem
              icon={<MessageCircle className="w-7 h-7" />}
              title="Community"
              description="Join Discussion"
              color="#39AEC4"
            />
          </div>
        </main>

        {/* Mobile Bottom Navigation - Fixed */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe safe-bottom">
          <div className="backdrop-blur-xl bg-black/40 border-t border-[#39AEC4]/10 px-2 py-3">
            <NavigationBar />
          </div>
        </div>
      </div>
    </div>
  );
}
