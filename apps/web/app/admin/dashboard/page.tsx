import { createClient } from '@/lib/supabase/server';
import { AdminLogout } from '@/components/admin/AdminLogout';
import { Home, FileCheck, TrendingUp, Award, MessageSquare, Lock } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import Link from 'next/link';

async function getAdminStats() {
  const supabase = createClient();

  const [kycPending, presalePending, fairlaunchPending, amaPending, totalUsers] = await Promise.all(
    [
      supabase
        .from('kyc_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
      supabase
        .from('launch_rounds')
        .select('id', { count: 'exact', head: true })
        .eq('sale_type', 'presale')
        .eq('status', 'SUBMITTED'),
      supabase
        .from('launch_rounds')
        .select('id', { count: 'exact', head: true })
        .eq('sale_type', 'fairlaunch')
        .eq('status', 'SUBMITTED'),
      supabase
        .from('ama_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'SUBMITTED'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]
  );

  return {
    kycPending: kycPending.count || 0,
    presalePending: presalePending.count || 0,
    fairlaunchPending: fairlaunchPending.count || 0,
    amaPending: amaPending.count || 0,
    totalUsers: totalUsers.count || 0,
  };
}

export default async function AdminDashboard() {
  const supabase = createClient();

  // Middleware already checked admin status, so we can directly fetch stats
  const stats = await getAdminStats();

  return (
    <div>
      {/* Header with Logout */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">
            Welcome to SELSIPAD Admin Panel. Review pending items and monitor platform activity.
          </p>
        </div>
        <AdminLogout />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Pending KYC Reviews"
          value={stats.kycPending}
          icon={FileCheck}
          href="/admin/kyc"
          description="Users awaiting verification"
        />
        <StatCard
          title="Pending Presales"
          value={stats.presalePending}
          icon={TrendingUp}
          href="/admin/presales/review"
          description="Presales awaiting approval"
        />
        <StatCard
          title="Pending Fairlaunch"
          value={stats.fairlaunchPending}
          icon={TrendingUp}
          href="/admin/fairlaunch/review"
          description="Fairlaunch awaiting approval"
        />
        <StatCard
          title="Pending AMA"
          value={stats.amaPending}
          icon={MessageSquare}
          href="/admin/ama"
          description="AMA sessions awaiting approval"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Home}
          description="Registered platform users"
        />
        <StatCard
          title="Badge Management"
          value="Manage"
          icon={Award}
          href="/admin/badges"
          description="Grant and revoke badges"
        />
        <StatCard
          title="LP Lock Management"
          value="Monitor"
          icon={Lock}
          href="/admin/liquidity-locks"
          description="Manage liquidity locks"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/admin/kyc"
            className="p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-600 transition-colors"
          >
            <FileCheck className="w-8 h-8 text-purple-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Review KYC</h3>
            <p className="text-gray-400 text-sm">Approve or reject user verifications</p>
          </Link>

          <Link
            href="/admin/fairlaunch/review"
            className="p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-green-600 transition-colors"
          >
            <TrendingUp className="w-8 h-8 text-green-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Review Fairlaunch</h3>
            <p className="text-gray-400 text-sm">Approve fairlaunch submissions</p>
          </Link>

          <Link
            href="/admin/badges/grant"
            className="p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-yellow-600 transition-colors"
          >
            <Award className="w-8 h-8 text-yellow-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Grant Badge</h3>
            <p className="text-gray-400 text-sm">Award badges to projects</p>
          </Link>

          <Link
            href="/admin/liquidity-locks"
            className="p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-600 transition-colors"
          >
            <Lock className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Manage LP Locks</h3>
            <p className="text-gray-400 text-sm">Review and confirm liquidity locks</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
