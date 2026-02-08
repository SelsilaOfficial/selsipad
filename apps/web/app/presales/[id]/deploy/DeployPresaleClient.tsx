'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Rocket, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

interface DeployResult {
  round_address: string;
  vesting_vault_address: string;
  schedule_salt: string;
  tx_hash: string;
  status: string;
}

export function DeployPresaleClient({ round }: { round: any }) {
  const router = useRouter();
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeployResult | null>(null);

  const params = round.params as Record<string, any>;

  const handleDeploy = async () => {
    setIsDeploying(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/rounds/${round.id}/deploy`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Deployment failed');
      }

      const data: DeployResult = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={() => router.push('/dashboard/owner/presales')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          <span>Back to Dashboard</span>
        </button>

        {/* Header */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {round.projects?.logo_url ? (
              <img
                src={round.projects.logo_url}
                alt={round.projects.name}
                className="w-14 h-14 rounded-full"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                {round.projects?.symbol?.[0] || 'P'}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">
                Deploy {round.projects?.name || 'Presale'}
              </h1>
              <p className="text-sm text-gray-400">
                Deploy your presale smart contracts to BSC Testnet
              </p>
            </div>
          </div>

          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-green-300 text-sm font-medium">
                Admin Approved — Ready to Deploy
              </span>
            </div>
          </div>
        </div>

        {/* Parameters Preview */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Deployment Parameters</h2>
          <div className="space-y-3 text-sm">
            <Row label="Token" value={round.token_address || params?.token_address || 'N/A'} mono />
            <Row label="Softcap" value={`${params?.softcap || 0} ${round.raise_asset || 'USDC'}`} />
            <Row label="Hardcap" value={`${params?.hardcap || 0} ${round.raise_asset || 'USDC'}`} />
            <Row
              label="Min / Max Contribution"
              value={`${params?.min_contribution || 0} – ${params?.max_contribution || 0} ${round.raise_asset || 'USDC'}`}
            />
            <Row
              label="Start"
              value={round.start_at ? new Date(round.start_at).toLocaleString() : 'Not set'}
            />
            <Row
              label="End"
              value={round.end_at ? new Date(round.end_at).toLocaleString() : 'Not set'}
            />
            <Row label="TGE Unlock" value={`${params?.investor_vesting?.tge_percentage ?? 0}%`} />
            <Row label="LP Lock" value={`${params?.lp_lock?.duration_months ?? 12} months`} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-red-300 font-medium">Deployment Failed</p>
                <p className="text-red-400/80 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {result && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={20} className="text-green-400" />
              <h3 className="text-lg font-semibold text-green-300">Deployment Successful!</h3>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="Round Address" value={result.round_address} mono />
              <Row label="Vesting Vault" value={result.vesting_vault_address} mono />
              <Row label="TX Hash" value={result.tx_hash} mono />
            </div>

            <div className="flex gap-3 mt-6">
              <a
                href={`https://testnet.bscscan.com/tx/${result.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
              >
                <ExternalLink size={14} />
                View on BscScan
              </a>
              <button
                onClick={() => router.push(`/presales/${round.id}`)}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Go to Presale Detail →
              </button>
            </div>
          </div>
        )}

        {/* Deploy Button */}
        {!result && (
          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg transition-all"
          >
            {isDeploying ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                <span>Deploying to BSC Testnet...</span>
              </>
            ) : (
              <>
                <Rocket size={22} />
                <span>Deploy On-Chain</span>
              </>
            )}
          </button>
        )}

        {isDeploying && (
          <p className="text-center text-gray-500 text-sm mt-3">
            This may take 15–30 seconds. Please don't close this page.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-white text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}
