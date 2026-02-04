'use client';

import { useState } from 'react';
import { Rocket, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface FairlaunchProject {
  id: string;
  name: string;
  symbol?: string;
  logo_url?: string;
  contract_address?: string;
  chain: string;
  total_raised: number;
  total_participants: number;
  params: any;
  start_at: string;
  end_at: string;
  status: string;
}

interface AdminFinalizeCardProps {
  fairlaunch: FairlaunchProject;
  onFinalize: (roundId: string) => Promise<void>;
}

export function AdminFinalizeCard({ fairlaunch, onFinalize }: AdminFinalizeCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const softcap = parseFloat(fairlaunch.params?.softcap || '0');
  const totalRaised = fairlaunch.total_raised;
  const softcapReached = totalRaised >= softcap;

  const getExplorerUrl = (address: string) => {
    const explorers: Record<string, string> = {
      '97': 'https://testnet.bscscan.com',
      '56': 'https://bscscan.com',
      '1': 'https://etherscan.io',
      '8453': 'https://basescan.org',
    };
    return `${explorers[fairlaunch.chain] || explorers['97']}/address/${address}`;
  };

  const handleFinalize = async () => {
    if (!confirm(`Finalize ${fairlaunch.name}? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onFinalize(fairlaunch.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            {fairlaunch.logo_url && (
              <img 
                src={fairlaunch.logo_url} 
                alt={fairlaunch.name}
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <h3 className="text-xl font-bold text-white">{fairlaunch.name}</h3>
              <p className="text-sm text-gray-400">{fairlaunch.symbol || 'TOKEN'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Total Raised</p>
              <p className="text-lg font-bold text-white">{totalRaised.toFixed(2)} BNB</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Softcap</p>
              <p className="text-lg font-bold text-white">{softcap.toFixed(2)} BNB</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Participants</p>
              <p className="text-lg font-bold text-white">{fairlaunch.total_participants}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${softcapReached ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {softcapReached ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Softcap Reached
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    Softcap Not Reached
                  </>
                )}
              </span>
            </div>
          </div>

          {fairlaunch.contract_address && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <code className="font-mono">{fairlaunch.contract_address.slice(0, 10)}...{fairlaunch.contract_address.slice(-8)}</code>
              <a href={getExplorerUrl(fairlaunch.contract_address)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {error && (
            <div className="mt-3 bg-red-500/10 border border-red-500 rounded-lg p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {softcapReached ? (
            <button
              onClick={handleFinalize}
              disabled={loading || fairlaunch.status === 'ENDED'}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : fairlaunch.status === 'ENDED' ? (
                'Finalized ✓'
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Finalize
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              disabled={loading || fairlaunch.status === 'FAILED'}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : fairlaunch.status === 'FAILED' ? (
                'Refunds Enabled ✓'
              ) : (
                <>
                  <AlertCircle className="w-5 h-5" />
                  Enable Refunds
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
