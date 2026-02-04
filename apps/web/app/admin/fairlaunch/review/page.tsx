import { createClient } from '@/lib/supabase/server';
import { TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

async function getFairlaunchSubmissions() {
  const supabase = createClient();

  const { data: rounds, error } = await supabase
    .from('launch_rounds')
    .select('*, projects(name, symbol, logo_url)')
    .eq('sale_type', 'fairlaunch')
    .in('status', ['SUBMITTED', 'SUBMITTED_FOR_REVIEW', 'APPROVED_TO_DEPLOY', 'REJECTED', 'DEPLOYED'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch fairlaunch rounds:', error);
    return [];
  }

  return rounds || [];
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'SUBMITTED_FOR_REVIEW':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-full text-sm">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    case 'APPROVED_TO_DEPLOY':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm">
          <CheckCircle2 className="w-3 h-3" />
          Approved
        </span>
      );
    case 'DEPLOYED':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm">
          <TrendingUp className="w-3 h-3" />
          Deployed
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-600/20 text-red-400 rounded-full text-sm">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    default:
      return <span className="text-gray-500">{status}</span>;
  }
}

export default async function FairlaunchReviewPage() {
  const rounds = await getFairlaunchSubmissions();

  // Separate into pending and reviewed
  const pending = rounds.filter((r) => ['SUBMITTED', 'SUBMITTED_FOR_REVIEW'].includes(r.status));
  const reviewed = rounds.filter((r) => ['APPROVED_TO_DEPLOY', 'REJECTED', 'DEPLOYED'].includes(r.status));

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">Fairlaunch Reviews</h1>
              <p className="text-gray-400">Review and approve fairlaunch submissions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-600/20 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-400 font-semibold">{pending.length} Pending</span>
          </div>
        </div>

        {/* Fairlaunch Info Banner */}
        <div className="mt-4 bg-green-950/30 border border-green-800/40 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-green-300 font-medium mb-1">Fairlaunch Requirements:</p>
              <ul className="text-green-200/80 space-y-1 text-xs">
                <li>
                  • <strong>Min 70% liquidity</strong> (verified automatically)
                </li>
                <li>
                  • <strong>LP lock ≥12 months</strong>
                </li>
                <li>
                  • <strong>No hardcap</strong> (softcap only)
                </li>
                <li>
                  • <strong>Team vesting mandatory</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Reviews */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">
          Pending Reviews ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No pending fairlaunch submissions</p>
            <p className="text-gray-500 text-sm mt-2">All caught up! 🎉</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 text-gray-400 font-medium">Project</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Network</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Softcap</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Liquidity</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Submitted</th>
                  <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((round) => {
                  const liquidityPercent = round.params?.lp_lock?.percentage || 0;
                  const isLiquidityValid = liquidityPercent >= 70;

                  return (
                    <tr
                      key={round.id}
                      className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{round.projects?.name || 'Unnamed'}</p>
                          <p className="text-gray-500 text-sm">
                            by {round.created_by?.slice(0, 6)}...
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300 capitalize">{round.chain || round.chain_id}</td>
                      <td className="p-4 text-gray-300">
                        {round.params?.softcap || 'N/A'}
                      </td>
                      <td className="p-4">
                        <span className={isLiquidityValid ? 'text-green-400' : 'text-red-400'}>
                          {liquidityPercent}%{!isLiquidityValid && ' ⚠️'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">
                        {new Date(round.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/admin/fairlaunch/review/${round.id}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          <TrendingUp className="w-4 h-4" />
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recently Reviewed */}
      {reviewed.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">
            Recently Reviewed ({reviewed.length})
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 text-gray-400 font-medium">Project</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Network</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Reviewed</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                  {reviewed.some((r) => r.status === 'REJECTED') && (
                    <th className="text-left p-4 text-gray-400 font-medium">Reason</th>
                  )}
                  <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((round) => (
                  <tr key={round.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="p-4">
                      <p className="text-white font-medium">{round.projects?.name || 'Unnamed'}</p>
                    </td>
                    <td className="p-4 text-gray-300 capitalize">{round.chain || round.chain_id}</td>
                    <td className="p-4 text-gray-400">
                      {round.reviewed_at ? new Date(round.reviewed_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-4">{getStatusBadge(round.status)}</td>
                    {reviewed.some((r) => r.status === 'REJECTED') && (
                      <td className="p-4 text-gray-400 text-sm">{round.rejection_reason || '-'}</td>
                    )}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {round.status === 'APPROVED_TO_DEPLOY' && (
                          <>
                            <Link
                              href={`/admin/fairlaunch/review/${round.id}`}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                            >
                              View Details
                            </Link>
                            <Link
                              href={`/fairlaunch/${round.id}`}
                              target="_blank"
                              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                            >
                              Live Page
                            </Link>
                          </>
                        )}
                        {round.status === 'REJECTED' && (
                          <Link
                            href={`/admin/fairlaunch/review/${round.id}`}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
