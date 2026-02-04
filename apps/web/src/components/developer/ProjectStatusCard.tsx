'use client';

import { useRouter } from 'next/navigation';
import { ExternalLink, Clock, CheckCircle, XCircle, Rocket } from 'lucide-react';

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

interface ProjectStatusCardProps {
  project: Project;
}

export function ProjectStatusCard({ project }: ProjectStatusCardProps) {
  const router = useRouter();
  const round = project.launch_rounds?.[0];

  // Calculate dynamic status based on deployment and time
  const getDynamicStatus = () => {
    // If not deployed yet, use database status
    if (project.status !== 'DEPLOYED' || !round?.start_time || !round?.end_time) {
      return project.status;
    }

    // For deployed projects, check current time vs start/end
    const now = new Date();
    const startTime = new Date(round.start_time);
    const endTime = new Date(round.end_time);

    if (now < startTime) {
      return 'UPCOMING'; // Deployed but not started yet
    } else if (now >= startTime && now <= endTime) {
      return 'LIVE'; // Sale is active
    } else {
      return 'ENDED'; // Sale has ended
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string; icon: any }> = {
      SUBMITTED: { label: 'Pending Review', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500', icon: Clock },
      IN_REVIEW: { label: 'In Review', color: 'bg-blue-500/20 text-blue-400 border-blue-500', icon: Clock },
      APPROVED: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500', icon: CheckCircle },
      APPROVED_TO_DEPLOY: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500', icon: CheckCircle },
      DEPLOYED: { label: 'Deployed', color: 'bg-blue-500/20 text-blue-400 border-blue-500', icon: Rocket },
      UPCOMING: { label: 'Upcoming', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500', icon: Clock },
      REJECTED: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500', icon: XCircle },
      LIVE: { label: 'Live', color: 'bg-purple-500/20 text-purple-400 border-purple-500', icon: Rocket },
      ENDED: { label: 'Ended', color: 'bg-gray-500/20 text-gray-400 border-gray-500', icon: CheckCircle },
    };

    const badge = badges[status] || { label: status, color: 'bg-gray-500/20 text-gray-400 border-gray-500', icon: Clock };
    const Icon = badge.icon;

    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm border ${badge.color}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </div>
    );
  };

  return (
    <div 
      onClick={() => router.push(`/fairlaunch/${project.id}`)}
      className="bg-gray-800/50 border border-gray-700 hover:border-purple-500 rounded-xl p-6 cursor-pointer transition-all hover:scale-[1.02]"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {project.logo_url ? (
            <img 
              src={project.logo_url} 
              alt={project.name} 
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center">
              <Rocket className="w-6 h-6 text-purple-400" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold">{project.name}</h3>
            <p className="text-sm text-gray-400">{project.type}</p>
          </div>
        </div>
        {getStatusBadge(getDynamicStatus())}
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Token:</span>
          <span className="text-purple-400 font-mono">
            {project.token_address.slice(0, 6)}...{project.token_address.slice(-4)}
          </span>
        </div>

        {round && (
          <>
            {round.escrow_tx_hash && (
              <div className="flex justify-between">
                <span className="text-gray-400">Tokens Escrowed:</span>
                <span className="text-green-400">✓</span>
              </div>
            )}
            {round.creation_fee_paid && (
              <div className="flex justify-between">
                <span className="text-gray-400">Fee Paid:</span>
                <span className="text-green-400">✓</span>
              </div>
            )}
            {round.total_raised && (
              <div className="flex justify-between">
                <span className="text-gray-400">Raised:</span>
                <span className="text-white font-semibold">{round.total_raised} BNB</span>
              </div>
            )}
          </>
        )}

        <div className="flex justify-between">
          <span className="text-gray-400">Chain:</span>
          <span className="text-white">BSC {project.chain_id === 97 ? 'Testnet' : 'Mainnet'}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
        <span className="text-xs text-gray-500">
          Created {new Date(project.created_at).toLocaleDateString()}
        </span>
        <ExternalLink className="w-4 h-4 text-purple-400" />
      </div>
    </div>
  );
}
