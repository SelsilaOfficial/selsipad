'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Rocket,
  XCircle,
  Ban,
  Trophy,
} from 'lucide-react';

interface PresaleRound {
  id: string;
  status: string;
  type: string;
  chain: string;
  chain_id: number;
  token_address: string;
  contract_address?: string;
  round_address?: string;
  vesting_vault_address?: string;
  start_at: string;
  end_at: string;
  total_raised?: number;
  total_participants?: number;
  escrow_tx_hash?: string;
  escrow_amount?: string;
  creation_fee_tx_hash?: string;
  creation_fee_paid?: boolean;
  params: any;
  created_at: string;
  created_by: string;
  project_id?: string;
  projects?: {
    id: string;
    name: string;
    symbol?: string;
    logo_url?: string;
    description?: string;
    creator_wallet?: string;
    token_address?: string;
  };
}

type TabKey = 'review' | 'approved' | 'live' | 'ended';

export default function AdminPresalesPage() {
  const [rounds, setRounds] = useState<PresaleRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('review');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRounds();
    const interval = setInterval(fetchRounds, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRounds = async () => {
    try {
      // Use API route with service-role to bypass RLS (wallet-auth doesn't have JWT auth.uid())
      const resp = await fetch('/api/admin/presale/list', { credentials: 'include' });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to fetch');
      setRounds(result.rounds || []);
    } catch (err: any) {
      console.error('[Admin Presales] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter rounds by tab
  const now = new Date().toISOString();
  const reviewRounds = rounds.filter((r) => r.status === 'SUBMITTED');
  const approvedRounds = rounds.filter((r) => ['APPROVED', 'DEPLOYING'].includes(r.status));
  // DEPLOYED shows in Live tab regardless of timing (admin needs to see all deployed)
  const liveRounds = rounds.filter((r) => r.status === 'DEPLOYED' && r.end_at > now);
  const endedRounds = rounds.filter(
    (r) =>
      (r.status === 'DEPLOYED' && r.end_at <= now) ||
      ['ENDED', 'LIVE', 'FINALIZED'].includes(r.status)
  );

  const tabCounts: Record<TabKey, number> = {
    review: reviewRounds.length,
    approved: approvedRounds.length,
    live: liveRounds.length,
    ended: endedRounds.length,
  };

  const tabConfig: { key: TabKey; label: string; color: string; activeColor: string }[] = [
    { key: 'review', label: 'Review', color: 'text-blue-400', activeColor: 'bg-blue-600' },
    { key: 'approved', label: 'Approved', color: 'text-yellow-400', activeColor: 'bg-yellow-600' },
    { key: 'live', label: 'Live', color: 'text-green-400', activeColor: 'bg-green-600' },
    { key: 'ended', label: 'Ended', color: 'text-orange-400', activeColor: 'bg-orange-600' },
  ];

  // ─── Actions ─────────────────────────────────

  const handleApprove = async (roundId: string) => {
    if (!window.confirm('Approve this presale for deployment?')) return;
    setActionLoading(roundId);
    try {
      const { approvePresale } = await import('@/actions/admin/approve-presale');
      const result = await approvePresale(roundId);
      if (!result.success) throw new Error(result.error);
      alert('✅ Presale approved!');
      await fetchRounds();
    } catch (err: any) {
      alert(`❌ Approve failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (roundId: string) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;
    setActionLoading(roundId);
    try {
      const { rejectPresale } = await import('@/actions/admin/approve-presale');
      const result = await rejectPresale(roundId, reason);
      if (!result.success) throw new Error(result.error);
      alert('✅ Presale rejected.');
      await fetchRounds();
    } catch (err: any) {
      alert(`❌ Reject failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeploy = async (roundId: string) => {
    if (!window.confirm('Deploy this presale on-chain? This will create the contract.')) return;
    setActionLoading(roundId);
    try {
      const { deployPresale } = await import('@/actions/admin/deploy-presale');
      const result = await deployPresale(roundId);
      if (!result.success) throw new Error(result.error);
      alert(
        `✅ Deployed!\nRound: ${result.roundAddress}\nVesting: ${result.vestingAddress}\nTx: ${result.txHash}`
      );
      await fetchRounds();
    } catch (err: any) {
      alert(`❌ Deploy failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinalize = async (roundId: string, outcome: 'SUCCESS' | 'FAILED') => {
    if (outcome === 'SUCCESS') {
      if (!window.confirm('Finalize as SUCCESS? Make sure merkle tree is prepared first.')) return;
      setActionLoading(roundId);
      try {
        // First prepare merkle tree
        const prepResp = await fetch(`/api/admin/presale/${roundId}/prepare-finalize`, {
          method: 'POST',
        });
        const prepData = await prepResp.json();
        if (!prepResp.ok) throw new Error(prepData.error || 'Prepare failed');

        // Then finalize on-chain
        const { finalizePresale } = await import('@/actions/admin/finalize-presale');
        const result = await finalizePresale(roundId, 'SUCCESS', {
          merkleRoot: prepData.merkleRoot,
          totalAllocation: prepData.totalAllocation,
          unsoldToBurn: prepData.unsoldToBurn || '0',
          tokensForLP: prepData.tokensForLP || '0',
          tokenMinLP: prepData.tokenMinLP || '0',
          bnbMinLP: prepData.bnbMinLP || '0',
        });
        if (!result.success) throw new Error(result.error);
        alert(`✅ Finalized as SUCCESS!\nTx: ${result.txHash}`);
        await fetchRounds();
      } catch (err: any) {
        alert(`❌ Finalize failed: ${err.message}`);
      } finally {
        setActionLoading(null);
      }
    } else {
      const reason = window.prompt('Enter failure reason:', 'Softcap not met');
      if (!reason) return;
      setActionLoading(roundId);
      try {
        const { finalizePresale } = await import('@/actions/admin/finalize-presale');
        const result = await finalizePresale(roundId, 'FAILED', { failureReason: reason });
        if (!result.success) throw new Error(result.error);
        alert(`✅ Finalized as FAILED. Refunds enabled.\nTx: ${result.txHash}`);
        await fetchRounds();
      } catch (err: any) {
        alert(`❌ Finalize failed: ${err.message}`);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleCancel = async (roundId: string) => {
    const reason = window.prompt('Enter cancellation reason:', 'Cancelled by admin');
    if (!reason) return;
    setActionLoading(roundId);
    try {
      const { cancelPresale } = await import('@/actions/admin/cancel-presale');
      const result = await cancelPresale(roundId, reason);
      if (!result.success) throw new Error(result.error);
      alert(`✅ Presale cancelled.${result.txHash ? `\nTx: ${result.txHash}` : ''}`);
      await fetchRounds();
    } catch (err: any) {
      alert(`❌ Cancel failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Helpers ──────────────────────────────────

  const shortAddr = (addr?: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—');

  const formatDate = (d?: string) => (d ? new Date(d).toLocaleString() : '—');

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      SUBMITTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      APPROVED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      DEPLOYING: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      DEPLOYED: 'bg-green-500/20 text-green-400 border-green-500/30',
      LIVE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      ENDED: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      FINALIZED: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return (
      <span
        className={`px-2 py-0.5 text-xs font-semibold rounded border ${colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
      >
        {status}
      </span>
    );
  };

  // ─── Render Card ──────────────────────────────

  const renderRoundCard = (round: PresaleRound, showActions: string[]) => {
    const project = round.projects;
    const params = round.params || {};
    const isLoading = actionLoading === round.id;

    return (
      <div
        key={round.id}
        className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-purple-500/50 transition"
      >
        <div className="flex items-start gap-4">
          {/* Logo */}
          {project?.logo_url ? (
            <img
              src={project.logo_url}
              alt={project.name}
              className="w-14 h-14 rounded-lg object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">
              {(project?.name || 'P')[0]}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-white truncate">
                {project?.name || params.name || 'Untitled'}
              </h3>
              {project?.symbol && <span className="text-sm text-gray-400">${project.symbol}</span>}
              {getStatusBadge(round.status)}
            </div>

            <p className="text-sm text-gray-400 line-clamp-1 mb-3">
              {project?.description || params.description || 'No description'}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-gray-500 block">Token</span>
                <span className="text-white font-mono">{shortAddr(round.token_address)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Softcap / Hardcap</span>
                <span className="text-white">
                  {params.softcap || '?'} / {params.hardcap || '?'} BNB
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Start</span>
                <span className="text-white">{formatDate(round.start_at)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">End</span>
                <span className="text-white">{formatDate(round.end_at)}</span>
              </div>

              {round.contract_address && (
                <div>
                  <span className="text-gray-500 block">Contract</span>
                  <span className="text-green-400 font-mono">
                    {shortAddr(round.contract_address)}
                  </span>
                </div>
              )}
              {round.escrow_tx_hash && (
                <div>
                  <span className="text-gray-500 block">Escrow TX</span>
                  <span className="text-cyan-400 font-mono">{shortAddr(round.escrow_tx_hash)}</span>
                </div>
              )}
              {round.total_raised !== undefined && round.total_raised > 0 && (
                <div>
                  <span className="text-gray-500 block">Raised</span>
                  <span className="text-green-400 font-bold">{round.total_raised} BNB</span>
                </div>
              )}
              {round.creation_fee_paid && (
                <div>
                  <span className="text-gray-500 block">Fee Paid</span>
                  <span className="text-green-400">✓ Yes</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {isLoading ? (
              <div className="flex items-center gap-2 text-purple-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Processing…</span>
              </div>
            ) : (
              <>
                {showActions.includes('approve') && (
                  <button
                    onClick={() => handleApprove(round.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold flex items-center gap-1 text-sm"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                )}
                {showActions.includes('reject') && (
                  <button
                    onClick={() => handleReject(round.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-semibold flex items-center gap-1 text-sm"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                )}
                {showActions.includes('deploy') && (
                  <button
                    onClick={() => handleDeploy(round.id)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-semibold flex items-center gap-1 text-sm"
                  >
                    <Rocket size={14} /> Deploy
                  </button>
                )}
                {showActions.includes('finalize-success') && (
                  <button
                    onClick={() => handleFinalize(round.id, 'SUCCESS')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-semibold flex items-center gap-1 text-sm"
                  >
                    <Trophy size={14} /> Finalize ✓
                  </button>
                )}
                {showActions.includes('finalize-failed') && (
                  <button
                    onClick={() => handleFinalize(round.id, 'FAILED')}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition font-semibold flex items-center gap-1 text-sm"
                  >
                    <AlertTriangle size={14} /> Fail & Refund
                  </button>
                )}
                {showActions.includes('cancel') && (
                  <button
                    onClick={() => handleCancel(round.id)}
                    className="px-4 py-2 bg-red-500/80 hover:bg-red-600 text-white rounded-lg transition font-semibold flex items-center gap-1 text-sm"
                  >
                    <Ban size={14} /> Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Empty State ──────────────────────────────

  const renderEmpty = (message: string) => (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-400 mb-2">{message}</h3>
      <p className="text-gray-500">All caught up! 🎉</p>
    </div>
  );

  // ─── Tab Content ──────────────────────────────

  const getCurrentRounds = () => {
    switch (activeTab) {
      case 'review':
        return reviewRounds.length === 0
          ? renderEmpty('No presales waiting for review')
          : reviewRounds.map((r) => renderRoundCard(r, ['approve', 'reject']));
      case 'approved':
        return approvedRounds.length === 0
          ? renderEmpty('No approved presales pending deployment')
          : approvedRounds.map((r) =>
              renderRoundCard(r, r.status === 'APPROVED' ? ['deploy', 'cancel'] : [])
            );
      case 'live':
        return liveRounds.length === 0
          ? renderEmpty('No live presales')
          : liveRounds.map((r) => renderRoundCard(r, ['cancel']));
      case 'ended':
        return endedRounds.length === 0
          ? renderEmpty('No ended presales')
          : endedRounds.map((r) =>
              renderRoundCard(
                r,
                r.status === 'FINALIZED' ? [] : ['finalize-success', 'finalize-failed', 'cancel']
              )
            );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <ShieldCheck className="w-10 h-10 text-purple-400" />
            Admin: Presale Management
          </h1>
          <p className="text-gray-400">Review, approve, deploy, and finalize presale rounds</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 rounded-lg transition font-semibold ${
                activeTab === tab.key
                  ? `${tab.activeColor} text-white`
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {tab.label} ({tabCounts[tab.key]})
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-xl p-6 text-center mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && <div className="space-y-4">{getCurrentRounds()}</div>}
      </div>
    </div>
  );
}
