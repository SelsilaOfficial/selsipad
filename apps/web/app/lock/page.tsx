import { PageContainer } from '@/components/layout';
import Link from 'next/link';
import { getLPLocks } from '@/actions/lock/get-lp-locks';
import { LPLockList } from '@/components/lock/LPLockList';
import { SplineBackground } from '@/components/home/SplineBackground';

export const metadata = {
  title: 'LP Lock | Selsipad - Liquidity Transparency',
  description:
    'View all locked liquidity across Presale, Fairlaunch, and Bonding Curve projects on Selsipad.',
};

export default async function LockPage() {
  const locks = await getLPLocks();

  const lockedCount = locks.filter((l) => l.lockStatus === 'LOCKED').length;
  const pendingCount = locks.filter(
    (l) => l.lockStatus === 'NONE' || l.lockStatus === 'PENDING'
  ).length;

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans selection:bg-cyan-500/30 relative overflow-hidden">
      {/* Animated Background Layer */}
      <SplineBackground />
      {/* Dark Overlay for Readability */}
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content Layer */}
      <PageContainer maxWidth="xl" className="py-6 relative z-10">
        {/* Back Button + Title - aligned with content */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-white">Liquidity Lock</h1>
        </div>
        <div className="mb-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#39AEC4]/20 to-[#756BBA]/20 border border-white/10 flex items-center justify-center">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Liquidity Transparency</h2>
          <p className="text-sm text-gray-400 max-w-2xl mx-auto">
            All project liquidity is locked for investor protection. View lock details, durations,
            and verification links for every project launched on Selsipad.
          </p>
        </div>

        {/* Stats Summary - Redesigned with gradient accents */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="relative overflow-hidden bg-white/5 border border-white/10 rounded-xl p-5 text-center group hover:border-[#756BBA]/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-[#756BBA]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="text-3xl font-bold bg-gradient-to-r from-[#39AEC4] to-[#756BBA] bg-clip-text text-transparent mb-1">
                {locks.length}
              </div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Total Projects
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white/5 border border-white/10 rounded-xl p-5 text-center group hover:border-green-500/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="text-3xl font-bold text-green-400 mb-1">{lockedCount}</div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Locked
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white/5 border border-white/10 rounded-xl p-5 text-center group hover:border-yellow-500/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="text-3xl font-bold text-yellow-400 mb-1">{pendingCount}</div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Pending Lock
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden bg-white/5 border border-white/10 rounded-xl p-5 text-center group hover:border-[#39AEC4]/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-[#39AEC4]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="text-2xl font-bold text-[#39AEC4] mb-1">12 months</div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Min Lock Duration
              </div>
            </div>
          </div>
        </div>

        {/* LP Lock List */}
        <LPLockList locks={locks} />
      </PageContainer>
    </div>
  );
}
