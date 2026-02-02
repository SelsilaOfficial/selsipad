'use client';

import { useRouter } from 'next/navigation';
import { ExternalLink, Clock, AlertCircle, Pause } from 'lucide-react';
import { ProjectStatusBadge } from './ProjectStatusBadge';

interface ProjectStatusCardProps {
  project: {
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
      escrow_tx_hash?: string;
      deployed_at?: string;
      paused_at?: string;
      pause_reason?: string;
      start_time: string;
      end_time: string;
      total_raised?: string;
    }[];
  };
}

export function ProjectStatusCard({ project }: ProjectStatusCardProps) {
  const router = useRouter();
  const launchRound = project.launch_rounds?.[0];

  const getExplorerUrl = (chainId: number) => {
    const explorers: Record<number, string> = {
      97: 'https://testnet.bscscan.com',
      56: 'https://bscscan.com',
      1: 'https://etherscan.io',
      11155111: 'https://sepolia.etherscan.io',
    };
    return explorers[chainId] || 'https://testnet.bscscan.com';
  };

  const handleViewProject = () => {
    if (project.status === 'LIVE' || project.status === 'ENDED' || project.status === 'PAUSED') {
      router.push(`/fairlaunch/${project.id}`);
    }
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-purple-500 transition group">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        {project.logo_url ? (
          <img
            src={project.logo_url}
            alt={project.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex items-center justify-center">
            <span className="text-xl font-bold text-purple-400">
              {project.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg group-hover:text-purple-400 transition">
              {project.name}
            </h3>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-sm text-gray-500">{project.type}</p>
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      {/* Status Info */}
      <div className="space-y-2 mb-4">
        {/* Pending Deploy Info */}
        {project.status === 'PENDING_DEPLOY' && launchRound?.escrow_tx_hash && (
          <div className="flex items-center gap-2 text-sm text-yellow-400">
            <Clock className="w-4 h-4" />
            <span>Awaiting admin deployment</span>
          </div>
        )}

        {/* Paused Info */}
        {project.status === 'PAUSED' && launchRound?.pause_reason && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <Pause className="w-4 h-4" />
              <span className="font-semibold">Paused by Admin</span>
            </div>
            <p className="text-sm text-red-300">{launchRound.pause_reason}</p>
          </div>
        )}

        {/* Live/Ended Info */}
        {(project.status === 'LIVE' || project.status === 'ENDED') && launchRound && (
          <div className="text-sm text-gray-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Sale Period:</span>
              <span className="text-white">
                {new Date(launchRound.start_time).toLocaleDateString()} - {new Date(launchRound.end_time).toLocaleDateString()}
              </span>
            </div>
            {launchRound.total_raised && (
              <div className="flex items-center justify-between">
                <span>Raised:</span>
                <span className="text-green-400 font-semibold">
                  {parseFloat(launchRound.total_raised).toFixed(4)} BNB
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-gray-700">
        {/* View Project Button */}
        {(project.status === 'LIVE' || project.status === 'ENDED' || project.status === 'PAUSED') && (
          <button
            onClick={handleViewProject}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition font-medium"
          >
            View Project
          </button>
        )}

        {/* Explorer Links */}
        {launchRound?.escrow_tx_hash && (
          <a
            href={`${getExplorerUrl(project.chain_id)}/tx/${launchRound.escrow_tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            title="View Escrow TX"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        )}

        {project.contract_address && (
          <a
            href={`${getExplorerUrl(project.chain_id)}/address/${project.contract_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            title="View Contract"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        )}
      </div>
    </div>
  );
}
