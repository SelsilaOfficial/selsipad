'use client';

import { useState, useEffect } from 'react';
import { Rocket, Loader2, CheckCircle2, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { AdminDeployCard } from '@/components/admin/AdminDeployCard';
import { AdminPauseModal } from '@/components/admin/AdminPauseModal';
import { AdminFinalizeCard } from '@/components/admin/AdminFinalizeCard';
import Link from 'next/link';

interface PendingProject {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  type: 'FAIRLAUNCH' | 'PRESALE';
  chain_id: number;
  token_address: string;
  creator_wallet: string;
  created_at: string;
  launch_rounds?: {
    id: string;
    softcap: string;
    tokens_for_sale: string;
    start_time: string;
    end_time: string;
    escrow_tx_hash?: string;
    escrow_amount?: string;
    creation_fee_paid?: string;
  }[];
}

export default function AdminFairlaunchPage() {
  const [reviewProjects, setReviewProjects] = useState<PendingProject[]>([]);
  const [liveProjects, setLiveProjects] = useState<PendingProject[]>([]);
  const [endedProjects, setEndedProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'review' | 'live' | 'ended'>('review');

  useEffect(() => {
    fetchProjects();
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchProjects, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchProjects = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const now = new Date().toISOString();

      const selectFields = `
        *,
        projects (
          id,
          name,
          symbol,
          logo_url,
          description,
          creator_wallet,
          token_address
        )
      `;

      // Fetch all 3 categories in parallel
      const [reviewResult, liveResult, endedResult] = await Promise.all([
        // SUBMITTED fairlaunches (waiting for review/approval)
        supabase
          .from('launch_rounds')
          .select(selectFields)
          .eq('type', 'FAIRLAUNCH')
          .eq('status', 'SUBMITTED')
          .order('created_at', { ascending: false }),

        // Live fairlaunches (DEPLOYED or ACTIVE, not yet ended — includes upcoming)
        supabase
          .from('launch_rounds')
          .select(selectFields)
          .eq('type', 'FAIRLAUNCH')
          .in('status', ['DEPLOYED', 'ACTIVE'])
          .gte('end_at', now)
          .order('start_at', { ascending: false }),

        // Ended fairlaunches (DEPLOYED, past end_at)
        supabase
          .from('launch_rounds')
          .select(selectFields)
          .eq('type', 'FAIRLAUNCH')
          .eq('status', 'DEPLOYED')
          .lt('end_at', now)
          .order('end_at', { ascending: false }),
      ]);

      if (reviewResult.error)
        console.error('[Admin] Error fetching review projects:', reviewResult.error);
      if (liveResult.error)
        console.error('[Admin] Error fetching live projects:', liveResult.error);
      if (endedResult.error)
        console.error('[Admin] Error fetching ended projects:', endedResult.error);

      // Transform review fairlaunches
      const reviewFairlaunches = (reviewResult.data || []).map((round: any) => {
        const project = round.projects;
        return {
          id: project?.id || round.id,
          name: project?.name || round.params?.name || 'Unknown',
          description: project?.description,
          logo_url: project?.logo_url,
          type: 'FAIRLAUNCH' as const,
          chain_id: round.chain_id || 97,
          token_address: round.token_address || project?.token_address || '0x0',
          creator_wallet: round.created_by || project?.creator_wallet || '0x0',
          created_at: round.created_at,
          launch_rounds: [
            {
              id: round.id,
              softcap: round.params?.softcap || '0',
              tokens_for_sale: round.params?.tokens_for_sale || '0',
              start_time: round.start_at,
              end_time: round.end_at,
              escrow_tx_hash: round.escrow_tx_hash,
              escrow_amount: round.escrow_amount,
              creation_fee_paid: round.creation_fee_paid,
            },
          ],
        };
      });

      setReviewProjects(reviewFairlaunches);

      // Transform live fairlaunches
      const liveFairlaunches = (liveResult.data || []).map((round: any) => {
        const project = round.projects;
        return {
          id: project?.id || round.id,
          name: project?.name || round.params?.project_name || 'Unknown',
          description: project?.description || round.params?.description,
          logo_url: project?.logo_url || round.params?.logo_url,
          type: 'FAIRLAUNCH' as const,
          chain_id: round.chain === 'bsc-testnet' ? 97 : 56,
          token_address:
            project?.token_address ||
            round.params?.token_address ||
            '0x0000000000000000000000000000000000000000',
          creator_wallet:
            project?.creator_wallet ||
            round.params?.creator_address ||
            '0x0000000000000000000000000000000000000000',
          created_at: round.created_at,
          launch_rounds: [
            {
              id: round.id,
              softcap: round.params?.softcap || '0',
              tokens_for_sale: round.params?.tokens_for_sale || '0',
              start_time: round.start_at,
              end_time: round.end_at,
              escrow_tx_hash: round.params?.escrow_tx_hash,
              escrow_amount: round.params?.escrow_amount,
              creation_fee_paid: round.params?.creation_fee_paid,
            },
          ],
        };
      });

      setLiveProjects(liveFairlaunches);

      // Transform ended fairlaunches
      const endedFairlaunches = (endedResult.data || []).map((round: any) => {
        const project = round.projects;
        return {
          id: round.id,
          name: project?.name || round.params?.project_name || 'Unknown',
          symbol: project?.symbol || round.params?.token_symbol,
          logo_url: project?.logo_url || round.params?.logo_url,
          contract_address: round.contract_address,
          chain: round.chain,
          total_raised: parseFloat(round.total_raised || '0'),
          total_participants: round.total_participants || 0,
          params: round.params,
          start_at: round.start_at,
          end_at: round.end_at,
          status: round.status,
        };
      });

      setEndedProjects(endedFairlaunches);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (launchRoundId: string) => {
    try {
      const response = await fetch('/api/admin/fairlaunch/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchRoundId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Deployment failed');
      }

      // Refresh projects
      await fetchProjects();

      alert(`✅ Deployed successfully!\nContract: ${data.contractAddress}`);
    } catch (err: any) {
      alert(`❌ Deployment failed: ${err.message}`);
    }
  };

  const handlePause = async (projectId: string, reason: string) => {
    try {
      const response = await fetch('/api/admin/fairlaunch/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Pause failed');
      }

      // Refresh projects
      await fetchProjects();

      alert(`✅ Project paused successfully`);
    } catch (err: any) {
      alert(`❌ Pause failed: ${err.message}`);
    }
  };

  const handleCancel = async (roundId: string) => {
    try {
      const { cancelFairlaunch } = await import('@/actions/admin/cancel-fairlaunch');
      const result = await cancelFairlaunch(roundId);

      if (!result.success) {
        throw new Error(result.error);
      }

      alert(`✅ Cancelled on-chain.\nRefunds should now be available.\nRound: ${roundId}`);
      await fetchProjects();
    } catch (err: any) {
      alert(`❌ Cancel failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Rocket className="w-10 h-10 text-purple-400" />
            Admin: Fairlaunch Management
          </h1>
          <p className="text-gray-400">Review and manage fairlaunch submissions</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('review')}
            className={`px-6 py-3 rounded-lg transition font-semibold ${
              activeTab === 'review'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Review ({reviewProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`px-6 py-3 rounded-lg transition font-semibold ${
              activeTab === 'live'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Live Projects ({liveProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('ended')}
            className={`px-6 py-3 rounded-lg transition font-semibold ${
              activeTab === 'ended'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Ended / Finalization ({endedProjects.length})
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Review Tab */}
        {!loading && !error && activeTab === 'review' && (
          <div>
            {reviewProjects.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">
                  No pending fairlaunch submissions
                </h3>
                <p className="text-gray-500">All caught up! 🎉</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviewProjects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition"
                  >
                    <div className="flex items-start gap-4">
                      {project.logo_url && (
                        <img
                          src={project.logo_url}
                          alt={project.name}
                          className="w-16 h-16 rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">{project.name}</h3>
                        <p className="text-gray-400 text-sm mb-4">{project.description}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Token:</span>{' '}
                            <span className="text-white font-mono">
                              {project.token_address.slice(0, 6)}...
                              {project.token_address.slice(-4)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Softcap:</span>{' '}
                            <span className="text-white">
                              {project.launch_rounds?.[0]?.softcap} BNB
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Tokens for Sale:</span>{' '}
                            <span className="text-white">
                              {project.launch_rounds?.[0]?.tokens_for_sale}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Created:</span>{' '}
                            <span className="text-white">
                              {new Date(project.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/admin/fairlaunch/review/${project.launch_rounds?.[0]?.id}`}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold flex items-center justify-center gap-1"
                        >
                          <TrendingUp size={16} /> Review
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Live Projects Tab */}
        {!loading && !error && activeTab === 'live' && (
          <div>
            {liveProjects.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No Live Projects</h3>
                <p className="text-gray-500">Deploy some projects to see them here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {liveProjects.map((project) => (
                  <AdminDeployCard
                    key={project.id}
                    project={project}
                    onPause={handlePause}
                    isLive={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ended Projects Tab */}
        {!loading && !error && activeTab === 'ended' && (
          <div>
            {endedProjects.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
                <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No Ended Fairlaunches</h3>
                <p className="text-gray-500">
                  Fairlaunches that end will appear here for finalization
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {endedProjects.map((project) => (
                  <AdminFinalizeCard
                    key={project.id}
                    fairlaunch={project}
                    onSuccess={fetchProjects}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
