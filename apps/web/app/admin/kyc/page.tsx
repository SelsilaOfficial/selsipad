import { createClient } from '@/lib/supabase/server';
import { FileCheck, Clock, CheckCircle2, XCircle, Search } from 'lucide-react';
import Link from 'next/link';

async function getKYCSubmissions() {
  const supabase = createClient();

  // Fetch KYC submissions
  const { data: submissions, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch KYC submissions:', error);
    return [];
  }

  if (!submissions || submissions.length === 0) {
    return [];
  }

  // Get unique user_ids
  const userIds = [...new Set(submissions.map((s) => s.user_id))];

  // Fetch wallets for all user_ids
  const { data: wallets } = await supabase
    .from('wallets')
    .select('user_id, address, chain, is_primary')
    .in('user_id', userIds);

  // Create map of user_id to primary wallet
  const walletMap = new Map();
  (wallets || []).forEach((wallet) => {
    if (wallet.is_primary && !walletMap.has(wallet.user_id)) {
      walletMap.set(wallet.user_id, wallet);
    }
  });

  // If no primary wallet found, use any wallet
  (wallets || []).forEach((wallet) => {
    if (!walletMap.has(wallet.user_id)) {
      walletMap.set(wallet.user_id, wallet);
    }
  });

  // Transform submissions to include wallet_address
  const transformed = submissions.map((sub) => {
    const wallet = walletMap.get(sub.user_id);
    return {
      ...sub,
      wallet_address: wallet?.address || 'N/A',
      chain: wallet?.chain || 'N/A',
    };
  });

  return transformed;
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
    case 'APPROVED':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm">
          <CheckCircle2 className="w-3 h-3" />
          Approved
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

export default async function KYCReviewPage() {
  const submissions = await getKYCSubmissions();

  // Separate into pending and reviewed
  const pending = submissions.filter((s) => s.status === 'PENDING');
  const reviewed = submissions.filter((s) => s.status !== 'PENDING');

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FileCheck className="w-8 h-8 text-purple-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">KYC Reviews</h1>
              <p className="text-gray-400">Review and approve user verification submissions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-600/20 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-400 font-semibold">{pending.length} Pending</span>
          </div>
        </div>
      </div>

      {/* Pending Submissions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">
          Pending Reviews ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No pending KYC submissions</p>
            <p className="text-gray-500 text-sm mt-2">All caught up! 🎉</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 text-gray-400 font-medium">Wallet Address</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Full Name</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Country</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Submitted</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                  <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((submission) => (
                  <tr
                    key={submission.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="p-4">
                      <span className="font-mono text-white">
                        {submission.wallet_address && submission.wallet_address !== 'N/A'
                          ? `${submission.wallet_address.slice(0, 6)}...${submission.wallet_address.slice(-4)}`
                          : submission.wallet_address || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300">{submission.full_name}</td>
                    <td className="p-4 text-gray-300">{submission.country}</td>
                    <td className="p-4 text-gray-400">
                      {new Date(submission.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">{getStatusBadge(submission.status)}</td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/admin/kyc/${submission.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        <FileCheck className="w-4 h-4" />
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reviewed Submissions */}
      {reviewed.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">
            Recently Reviewed ({reviewed.length})
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 text-gray-400 font-medium">Wallet Address</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Full Name</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Country</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Reviewed</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Reviewed By</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                  {reviewed.some((s) => s.status === 'REJECTED') && (
                    <th className="text-left p-4 text-gray-400 font-medium">Reason</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {reviewed.map((submission) => (
                  <tr key={submission.id} className="border-b border-gray-800">
                    <td className="p-4">
                      <span className="font-mono text-white">
                        {submission.wallet_address && submission.wallet_address !== 'N/A'
                          ? `${submission.wallet_address.slice(0, 6)}...${submission.wallet_address.slice(-4)}`
                          : submission.wallet_address || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300">{submission.full_name}</td>
                    <td className="p-4 text-gray-300">{submission.country}</td>
                    <td className="p-4 text-gray-400">
                      {submission.reviewed_at
                        ? new Date(submission.reviewed_at).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="p-4">
                      {submission.reviewed_by ? (
                        <span className="font-mono text-gray-400 text-sm">
                          {submission.reviewed_by.slice(0, 6)}...{submission.reviewed_by.slice(-4)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-4">{getStatusBadge(submission.status)}</td>
                    {reviewed.some((s) => s.status === 'REJECTED') && (
                      <td className="p-4 text-gray-400 text-sm">
                        {submission.rejection_reason || '-'}
                      </td>
                    )}
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
