import { PageHeader, PageContainer } from '@/components/layout';
import Link from 'next/link';
import { getLPLocks } from '@/actions/lock/get-lp-locks';
import { LPLockList } from '@/components/lock/LPLockList';

export const metadata = {
  title: 'LP Lock | Selsipad - Liquidity Transparency',
  description:
    'View all locked liquidity across Presale, Fairlaunch, and Bonding Curve projects on Selsipad.',
};

export default async function LockPage() {
  const locks = await getLPLocks();

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans selection:bg-cyan-500/30">
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Liquidity Lock</h1>
              <p className="text-xs text-gray-500 font-medium">Liquidity Transparency</p>
            </div>
          </div>
        </div>
      </div>
      <PageContainer maxWidth="xl" className="py-8">
        {/* Hero Section */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">🔒 Liquidity Transparency</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            All project liquidity is locked for investor protection. View lock details, durations,
            and verification links for every project launched on Selsipad.
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Projects"
            value={locks.length.toString()}
            color="text-indigo-400"
          />
          <StatCard
            label="Locked"
            value={locks.filter((l) => l.lockStatus === 'LOCKED').length.toString()}
            color="text-green-400"
          />
          <StatCard
            label="Pending Lock"
            value={locks
              .filter((l) => l.lockStatus === 'NONE' || l.lockStatus === 'PENDING')
              .length.toString()}
            color="text-yellow-400"
          />
          <StatCard label="Min Lock Duration" value="12 months" color="text-blue-400" />
        </div>

        {/* LP Lock List */}
        <LPLockList locks={locks} />
      </PageContainer>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center">
      <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
