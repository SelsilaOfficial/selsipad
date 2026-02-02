'use client';

import { useState, useEffect } from 'react';
import { Rocket, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { AdminDeployCard } from '@/components/admin/AdminDeployCard';
import { AdminPauseModal } from '@/components/admin/AdminPauseModal';

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
  const [pendingProjects, setPendingProjects] = useState<PendingProject[]>([]);
  const [liveProjects, setLiveProjects] = useState<PendingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'live'>('pending');

  useEffect(() => {
    fetchProjects();
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchProjects, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchProjects = async () => {
    try {
      // Fetch all projects and filter by status
      const response = await fetch('/api/admin/projects'); // TODO: Create this endpoint
      const data = await response.json();

      if (data.success) {
        const projects = data.projects || [];
        setPendingProjects(projects.filter((p: any) => p.status === 'PENDING_DEPLOY'));
        setLiveProjects(projects.filter((p: any) => p.status === 'LIVE'));
      }
    } catch (err: any) {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Rocket className="w-10 h-10 text-purple-400" />
            Admin: Fairlaunch Management
          </h1>
          <p className="text-gray-400">Deploy pending projects and manage live fairlaunches</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 rounded-lg transition font-semibold ${
              activeTab === 'pending'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Pending Deploy ({pendingProjects.length})
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

        {/* Pending Deploy Tab */}
        {!loading && !error && activeTab === 'pending' && (
          <div>
            {pendingProjects.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">
                  All Caught Up!
                </h3>
                <p className="text-gray-500">No projects pending deployment</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingProjects.map((project) => (
                  <AdminDeployCard
                    key={project.id}
                    project={project}
                    onDeploy={handleDeploy}
                  />
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
                <h3 className="text-xl font-semibold text-gray-400 mb-2">
                  No Live Projects
                </h3>
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
      </div>
    </div>
  );
}
