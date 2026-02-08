import { PageHeader, PageContainer } from '@/components/layout';
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
    <div className="min-h-screen bg-bg-page pb-20">
      <PageHeader title="Liquidity Lock" showBack />
      <PageContainer className="py-8">
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
