import {
  TrendingUp,
  Rocket,
  Mic2,
  Shield,
  Coins,
  Trophy,
  MessageCircle,
  Mic,
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
import { getServerSession } from '@/lib/auth/session';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export default async function HomePage() {
  const [trendingStats, session] = await Promise.all([getTrendingStats(), getServerSession()]);
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
                  SELSILA
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

              {/* Trending Projects */}
              <div className="mt-6 sm:mt-auto p-4 sm:p-5 rounded-[20px] bg-gradient-to-br from-[#39AEC4]/20 to-[#39AEC4]/5 border border-[#39AEC4]/30">
                {trendingStats.trendingProjects.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs sm:text-sm text-gray-400 mb-2">🔥 Trending Projects</p>
                    {trendingStats.trendingProjects.map((project, i) => (
                      <Link
                        key={project.projectId}
                        href={`/presales/${project.projectId}`}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group"
                      >
                        <span className="text-sm font-bold text-gray-500 w-5">{i + 1}</span>
                        <img
                          src={project.logoUrl}
                          alt={project.name}
                          className="w-8 h-8 rounded-full object-cover border border-white/10"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate group-hover:text-[#39AEC4] transition-colors">
                            {project.name}
                          </p>
                          <p className="text-xs text-[#39AEC4]">{project.hashtag}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-[#39AEC4]">{project.uniqueUsers}</p>
                          <p className="text-[10px] text-gray-500">users</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-400 mb-1">Activity 24h</p>
                      <p className="text-sm text-gray-500">No trending projects yet</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl sm:text-3xl font-bold text-[#39AEC4]">
                        {trendingStats.totalPosts24h > 0 ? `${trendingStats.totalPosts24h}` : '0'}
                      </p>
                      <p className="text-xs text-gray-400">posts today</p>
                    </div>
                  </div>
                )}
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
            <SocialFeedCard userId={session?.userId} />
          </div>

          {/* Disclaimer Section */}
          <div className="w-full rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-5 sm:p-8 shadow-xl shadow-[#756BBA]/10">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400/80" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-yellow-400/90 mb-2">
                  Disclaimer
                </h3>
                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                  Selsila does not endorse, recommend, or guarantee any project listed on this
                  platform. All investments carry inherent risks. Users are solely responsible for
                  conducting their own research (DYOR) and seeking independent financial advice
                  before making any investment decisions. Selsila shall not be held liable for any
                  losses incurred.
                </p>
              </div>
            </div>
          </div>
          {/* Site Footer Card */}
          <div className="w-full rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-5 sm:p-8 shadow-xl shadow-[#756BBA]/10">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8">
              {/* Brand Column */}
              <div className="col-span-2 sm:col-span-4 lg:col-span-1 mb-2 lg:mb-0">
                <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#39AEC4] to-[#756BBA] bg-clip-text text-transparent font-audiowide mb-2">
                  SELSILA
                </h2>
                <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed max-w-[200px]">
                  The Future of Decentralized Launchpads. Multi-chain token launches made simple and
                  secure.
                </p>
              </div>

              {/* Resources */}
              <div>
                <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
                  Resources
                </h3>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="https://selsiworld.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#39AEC4] transition-colors"
                    >
                      Website Official
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/SelsilaOfficial"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#39AEC4] transition-colors"
                    >
                      GitHub
                    </a>
                  </li>
                  <li>
                    <a
                      href="/docs"
                      className="text-xs text-gray-500 hover:text-[#39AEC4] transition-colors"
                    >
                      Documentation
                    </a>
                  </li>
                </ul>
              </div>

              {/* Community */}
              <div>
                <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
                  Community
                </h3>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="https://t.me/SelsilaOfficial"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#39AEC4] transition-colors"
                    >
                      Telegram
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://mail.google.com/mail/?view=cm&to=support@selsiscan.online"
                      className="text-xs text-gray-500 hover:text-[#39AEC4] transition-colors"
                    >
                      Contact Us
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://youtube.com/@selsiworld?si=6vNtbPrG1657RV0A"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-[#39AEC4] transition-colors"
                    >
                      YouTube
                    </a>
                  </li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
                  Legal
                </h3>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="/privacy"
                      className="text-xs text-gray-500 hover:text-[#39AEC4] transition-colors"
                    >
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href="/terms"
                      className="text-xs text-gray-500 hover:text-[#39AEC4] transition-colors"
                    >
                      Terms and Conditions
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[10px] text-gray-600">
                © 2025 — 2026 Selsila. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="https://t.me/SelsilaOfficial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-[#39AEC4] transition-colors"
                  aria-label="Telegram"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 1 0 24 12.056A12.01 12.01 0 0 0 11.944 0Zm5.654 8.26l-1.7 8.03c-.128.6-.465.746-.942.465l-2.6-1.916-1.255 1.21c-.14.139-.256.256-.524.256l.186-2.65 4.823-4.356c.21-.186-.046-.29-.325-.104l-5.96 3.754-2.568-.8c-.558-.174-.57-.558.116-.826l10.035-3.87c.465-.17.873.104.72.81Z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/SelsilaOfficial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-[#39AEC4] transition-colors"
                  aria-label="GitHub"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12Z" />
                  </svg>
                </a>
                <a
                  href="https://x.com/selsilaworld"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-[#39AEC4] transition-colors"
                  aria-label="X"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
