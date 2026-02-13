import { createClient } from '@supabase/supabase-js';
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  AlertCircle,
  Pin,
  Radio,
} from 'lucide-react';
import Link from 'next/link';
import { QuickStartButton } from '@/components/ama/QuickStartButton';

async function getAMARequests() {
  // Use service role to bypass RLS and see all requests
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch ama_requests without embedded relations (FK not set up)
  const { data: requests, error } = await supabase
    .from('ama_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch AMA requests:', error);
    return [];
  }

  return requests || [];
}

// Helper to format datetime in both WIB and UTC
function formatDualTimezone(isoString: string) {
  const utcDate = new Date(isoString);

  // WIB time (UTC+7)
  const wibDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
  const wibStr = wibDate.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // UTC time
  const utcStr = utcDate.toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });

  return { wib: wibStr, utc: utcStr };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-full text-sm">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    case 'PINNED':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600/20 text-indigo-400 rounded-full text-sm">
          <Pin className="w-3 h-3" />
          Pinned
        </span>
      );
    case 'LIVE':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm">
          <Play className="w-3 h-3" />
          Live
        </span>
      );
    case 'ENDED':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-600/20 text-gray-400 rounded-full text-sm">
          Ended
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

export default async function AMAManagementPage() {
  const requests = await getAMARequests();

  // Group by status
  const pending = requests.filter((s) => s.status === 'PENDING');
  const pinned = requests.filter((s) => s.status === 'PINNED');
  const live = requests.filter((s) => s.status === 'LIVE');
  const ended = requests.filter((s) => s.status === 'ENDED');
  const rejected = requests.filter((s) => s.status === 'REJECTED');

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-indigo-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">AMA Management</h1>
              <p className="text-gray-400">Review, pin, and manage developer AMA requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-600/20 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-400 font-semibold">{pending.length} Pending</span>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-4 bg-indigo-950/30 border border-indigo-800/40 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-indigo-300 font-medium mb-1">AMA Workflow:</p>
              <ul className="text-indigo-200/80 space-y-1 text-xs">
                <li>
                  • <strong>PENDING</strong> - Awaiting admin review (paid $100)
                </li>
                <li>
                  • <strong>PINNED</strong> - Approved, visible on homepage
                </li>
                <li>
                  • <strong>LIVE</strong> - Currently in progress (chat enabled)
                </li>
                <li>
                  • <strong>ENDED</strong> - AMA completed
                </li>
                <li>
                  • <strong>REJECTED</strong> - Denied (auto-refund triggered)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-xl p-4">
          <p className="text-yellow-400 text-sm mb-1">Pending</p>
          <p className="text-3xl font-bold text-white">{pending.length}</p>
        </div>
        <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-4">
          <p className="text-indigo-400 text-sm mb-1">Pinned</p>
          <p className="text-3xl font-bold text-white">{pinned.length}</p>
        </div>
        <div className="bg-green-950/30 border border-green-800/40 rounded-xl p-4">
          <p className="text-green-400 text-sm mb-1">Live</p>
          <p className="text-3xl font-bold text-white">{live.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-gray-400 text-sm mb-1">Ended</p>
          <p className="text-3xl font-bold text-white">{ended.length}</p>
        </div>
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4">
          <p className="text-red-400 text-sm mb-1">Rejected</p>
          <p className="text-3xl font-bold text-white">{rejected.length}</p>
        </div>
      </div>

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Pending Review ({pending.length})
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 text-gray-400 font-medium">Project</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Developer</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Scheduled</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Payment</th>
                  <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((ama: any) => (
                  <tr key={ama.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4">
                      <p className="text-white font-medium">{ama.project_name}</p>
                      <p className="text-gray-500 text-sm line-clamp-1">{ama.description}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-gray-300">@{ama.profiles?.nickname || 'Unknown'}</p>
                      <p className="text-gray-500 text-sm">
                        {ama.profiles?.kyc_status === 'APPROVED' ? '✓ KYC Verified' : 'Pending KYC'}
                      </p>
                    </td>
                    <td className="p-4">
                      {(() => {
                        const { wib, utc } = formatDualTimezone(ama.scheduled_at);
                        return (
                          <div>
                            <p className="text-white text-sm font-medium">{wib}</p>
                            <p className="text-gray-500 text-xs">WIB (UTC+7)</p>
                            <p className="text-gray-400 text-xs mt-1">{utc} UTC</p>
                            <div className="mt-2">
                              <QuickStartButton amaId={ama.id} scheduledAt={ama.scheduled_at} />
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-4">
                      <p className="text-indigo-400">
                        {Number(ama.payment_amount_bnb).toFixed(4)} BNB
                      </p>
                      <a
                        href={`https://testnet.bscscan.com/tx/${ama.payment_tx_hash}`}
                        target="_blank"
                        className="text-xs text-gray-500 hover:text-indigo-400"
                      >
                        View TX →
                      </a>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/admin/ama/review/${ama.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Requests Table */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">
          All AMA Requests ({requests.length})
        </h2>

        {requests.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No AMA requests yet</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 text-gray-400 font-medium">Project</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Type</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Developer</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Schedule</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                  <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((ama: any) => (
                  <tr key={ama.id} className="border-b border-gray-800">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {ama.is_pinned && <span className="text-yellow-400">📌</span>}
                        <div>
                          <p className="text-white font-medium">{ama.project_name}</p>
                          <p className="text-gray-500 text-sm line-clamp-1">{ama.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          (ama.type === 'VIDEO' && 'bg-purple-500/20 text-purple-300') ||
                          (ama.type === 'VOICE' && 'bg-indigo-500/20 text-indigo-300') ||
                          'bg-gray-500/20 text-gray-300'
                        }`}
                      >
                        {ama.type || 'TEXT'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300">@{ama.profiles?.nickname || 'Unknown'}</td>
                    <td className="p-4">
                      {(() => {
                        const { wib, utc } = formatDualTimezone(ama.scheduled_at);
                        return (
                          <div>
                            <p className="text-white text-xs">{wib}</p>
                            <p className="text-gray-500 text-xs">WIB</p>
                            {ama.status === 'PINNED' && (
                              <div className="mt-1">
                                <QuickStartButton amaId={ama.id} scheduledAt={ama.scheduled_at} />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-4">{getStatusBadge(ama.status)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {ama.status === 'LIVE' && (
                          <Link
                            href={`/ama/${ama.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm font-medium border border-red-600/30"
                          >
                            <Radio className="w-3 h-3 animate-pulse" />
                            Join as Host
                          </Link>
                        )}
                        <Link
                          href={`/admin/ama/review/${ama.id}`}
                          className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                        >
                          Manage →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
