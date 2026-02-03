'use client';

import { useState } from 'react';
import { Rocket, ExternalLink, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AdminPauseModal } from './AdminPauseModal';

interface AdminDeployCardProps {
  project: {
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
  };
  onDeploy?: (launchRoundId: string) => Promise<void>;
  onPause?: (projectId: string, reason: string) => Promise<void>;
  isLive?: boolean;
}

export function AdminDeployCard({ project, onDeploy, onPause, isLive }: AdminDeployCardProps) {
  const [deploying, setDeploying] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
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

  const handleDeploy = async () => {
    if (!launchRound || !onDeploy) return;
    
    if (!confirm(`Deploy ${project.name}?\n\nThis will:\n1. Deploy the Fairlaunch contract\n2. Release tokens from escrow\n3. Update status to LIVE`)) {
      return;
    }

    try {
      setDeploying(true);
      await onDeploy(launchRound.id);
    } finally {
      setDeploying(false);
    }
  };

  const handlePauseSubmit = async (reason: string) => {
    if (!onPause) return;
    await onPause(project.id, reason);
    setShowPauseModal(false);
  };

  return (
    <>
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-purple-500 transition">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            {project.logo_url ? (
              <img
                src={project.logo_url}
                alt={project.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-purple-400">
                  {project.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <div>
              <h3 className="font-bold text-xl text-white mb-1">{project.name}</h3>
              <p className="text-sm text-gray-400">{project.type}</p>
              {project.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>
          </div>

          {/* Status Badge */}
          {isLive ? (
            <div className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-600 rounded-lg font-semibold">
              LIVE
            </div>
          ) : (
            <div className="px-4 py-2 bg-yellow-600/20 text-yellow-400 border border-yellow-600 rounded-lg font-semibold animate-pulse">
              PENDING
            </div>
          )}
        </div>

        {/* Project Details */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Creator</p>
            <p className="text-sm font-mono text-white truncate">
              {project.creator_wallet.slice(0, 6)}...{project.creator_wallet.slice(-4)}
            </p>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Chain</p>
            <p className="text-sm font-semibold text-white">
              {project.chain_id === 97 ? 'BSC Testnet' : 
               project.chain_id === 56 ? 'BSC Mainnet' : 
               project.chain_id === 1 ? 'Ethereum' : `Chain ${project.chain_id}`}
            </p>
          </div>

          {launchRound && (
            <>
              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Softcap</p>
                <p className="text-sm font-semibold text-purple-400">
                  {parseFloat(launchRound.softcap).toFixed(2)} BNB
                </p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Tokens for Sale</p>
                <p className="text-sm font-semibold text-purple-400">
                  {parseFloat(launchRound.tokens_for_sale).toLocaleString()}
                </p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Start Time</p>
                <p className="text-sm text-white">
                  {new Date(launchRound.start_time).toLocaleDateString()}
                </p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">End Time</p>
                <p className="text-sm text-white">
                  {new Date(launchRound.end_time).toLocaleDateString()}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Escrow Info */}
        {launchRound?.escrow_tx_hash && (
          <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-semibold">Escrow Confirmed</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">TX Hash:</span>
              <a
                href={`${getExplorerUrl(project.chain_id)}/tx/${launchRound.escrow_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono"
              >
                {launchRound.escrow_tx_hash.slice(0, 10)}...{launchRound.escrow_tx_hash.slice(-8)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {launchRound.creation_fee_paid && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-400">Creation Fee:</span>
                <span className="text-green-400 font-semibold">
                  {parseFloat(launchRound.creation_fee_paid).toFixed(4)} BNB
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {!isLive && onDeploy && launchRound && (
            <button
              onClick={handleDeploy}
              disabled={deploying}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deploying ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Deploy Contract
                </>
              )}
            </button>
          )}

          {isLive && onPause && (
            <button
              onClick={() => setShowPauseModal(true)}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              Pause Project
            </button>
          )}

          {/* Explorer Links */}
          <a
            href={`${getExplorerUrl(project.chain_id)}/address/${project.token_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            title="View Token Contract"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Pause Modal */}
      {showPauseModal && (
        <AdminPauseModal
          projectName={project.name}
          onConfirm={handlePauseSubmit}
          onCancel={() => setShowPauseModal(false)}
        />
      )}
    </>
  );
}
