'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2, Filter } from 'lucide-react';
import { ProjectStatusCard } from '@/components/developer/ProjectStatusCard';
import { getServerSession } from '@/lib/auth/session';

interface Project {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  type: 'FAIRLAUNCH' | 'PRESALE';
  status: string;
  chain_id: number;
  token_address: string;
  contract_address?: string;
  created_at: string;
  launch_rounds?: {
    id: string;
    softcap: string;
    start_time: string;
    end_time: string;
    escrow_tx_hash?: string;
    creation_fee_paid?: string;
    deployed_at?: string;
    paused_at?: string;
    pause_reason?: string;
    total_raised?: string;
    contributor_count?: number;
  }[];
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'FAIRLAUNCH' | 'PRESALE'>('ALL');

  useEffect(() => {
    fetchProjects();
  }, [filter]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const url = filter === 'ALL' 
        ? '/api/user/projects' 
        : `/api/user/projects?type=${filter}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch projects');
      }

      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    if (filter === 'ALL') return true;
    return p.type === filter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Rocket className="w-10 h-10 text-purple-400" />
              My Projects
            </h1>
            <p className="text-gray-400">Track your Fairlaunch and Presale projects</p>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'ALL' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('FAIRLAUNCH')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'FAIRLAUNCH' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Fairlaunch
            </button>
            <button
              onClick={() => setFilter('PRESALE')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'PRESALE' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Presale
            </button>
          </div>
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
            <button
              onClick={fetchProjects}
              className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Projects Grid */}
        {!loading && !error && (
          <>
            {filteredProjects.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
                <Rocket className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">
                  No Projects Yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Create your first Fairlaunch or Presale to get started
                </p>
                <button
                  onClick={() => router.push('/create/fairlaunch')}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                >
                  Create Fairlaunch
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => (
                  <ProjectStatusCard key={project.id} project={project} />
                ))}
              </div>
            )}

            {/* Summary Stats */}
            {filteredProjects.length > 0 && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Total Projects</p>
                  <p className="text-2xl font-bold">{projects.length}</p>
                </div>
                <div className="bg-purple-600/20 border border-purple-600 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Pending Deploy</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {projects.filter(p => p.status === 'PENDING_DEPLOY').length}
                  </p>
                </div>
                <div className="bg-green-600/20 border border-green-600 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Live</p>
                  <p className="text-2xl font-bold text-green-400">
                    {projects.filter(p => p.status === 'LIVE').length}
                  </p>
                </div>
                <div className="bg-blue-600/20 border border-blue-600 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Ended</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {projects.filter(p => p.status === 'ENDED').length}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
