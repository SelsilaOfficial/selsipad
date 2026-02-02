import { Rocket, ExternalLink, Clock, DollarSign } from 'lucide-react';

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
  onDeploy?: (launchRoundId: string) => void;
  onPause?: (projectId: string, reason: string) => void;
  isLive?: boolean;
}

export function AdminDeployCard({ project, onDeploy, onPause, isLive }: AdminDeployCardProps) {
  const launchRound = project.launch_rounds?.[0];

  const getNetworkName = (chainId: number) => {
    const networks: Record<number, string> = {
      97: 'BSC Testnet',
      56: 'BNB Chain',
      1: 'Ethereum',
      11155111: 'Sepolia',
      8453: 'Base',
      84532: 'Base Sepolia',
    };
    return networks[chainId] || `Chain ${chainId}`;
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-purple-500/50 transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          {project.logo_url && (
            <img
              src={project.logo_url}
              alt={project.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
          )}
          <div>
            <h3 className="text-xl font-bold text-white mb-1">{project.name}</h3>
            <p className="text-gray-400 text-sm mb-2">{project.description || 'No description'}</p>
            <div className="flex items-center gap-3 text-xs">
              <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                {project.type}
              </span>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                {getNetworkName(project.chain_id)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {launchRound && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Softcap</div>
            <div className="text-white font-semibold">{launchRound.softcap} BNB</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Tokens for Sale</div>
            <div className="text-white font-semibold">
              {parseFloat(launchRound.tokens_for_sale).toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Created</div>
            <div className="text-white font-semibold">
              {new Date(project.created_at).toLocaleDateString()}
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Creator</div>
            <div className="text-white font-mono text-xs">
              {project.creator_wallet.slice(0, 6)}...{project.creator_wallet.slice(-4)}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {!isLive && onDeploy && launchRound && (
          <button
            onClick={() => onDeploy(launchRound.id)}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
          >
            <Rocket className="w-5 h-5" />
            Deploy Contract
          </button>
        )}

        {isLive && onPause && (
          <button
            onClick={() => onPause(project.id, 'Admin pause')}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition"
          >
            Pause Project
          </button>
        )}

        <a
          href={`/fairlaunch/${launchRound?.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
