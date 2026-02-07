import { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Lock,
  Coins,
  Banknote,
} from 'lucide-react';
import { ContractVerificationButton } from './ContractVerificationButton';
import {
  finalizeFairlaunch,
  getFairlaunchState,
  FairlaunchAction,
  FairlaunchState,
} from '@/actions/admin/finalize-fairlaunch';

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
  onSuccess: () => void; // Replaces onFinalize
  onCancel: (roundId: string) => Promise<void>;
}

export function AdminFinalizeCard({ fairlaunch, onSuccess, onCancel }: AdminFinalizeCardProps) {
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<FairlaunchState | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const softcap = parseFloat(fairlaunch.params?.softcap || '0');
  const totalRaised = fairlaunch.total_raised;
  const softcapReached = totalRaised >= softcap;

  const fetchState = useCallback(async () => {
    if (!fairlaunch.contract_address) return;
    setRefreshing(true);
    const res = await getFairlaunchState(fairlaunch.id);
    if (res.success && res.state) {
      setState(res.state);
    }
    setRefreshing(false);
  }, [fairlaunch.id, fairlaunch.contract_address]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const getExplorerUrl = (address: string) => {
    const explorers: Record<string, string> = {
      '97': 'https://testnet.bscscan.com',
      '56': 'https://bscscan.com',
      '1': 'https://etherscan.io',
      '8453': 'https://basescan.org',
    };
    return `${explorers[fairlaunch.chain] || explorers['97']}/address/${address}`;
  };

  const handleAction = async (action: FairlaunchAction, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;

    setLoading(true);
    setError(null);

    try {
      const res = await finalizeFairlaunch(fairlaunch.id, action);
      if (!res.success) {
        throw new Error(res.error || 'Action failed');
      }

      alert(res.message);
      await fetchState(); // Refresh local state

      if (res.isFinalized) {
        onSuccess(); // Refresh parent list
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupLPLocker = async () => {
    if (!confirm('Setup LP Locker for this contract?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/fairlaunch/setup-lp-locker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: fairlaunch.id,
          contractAddress: fairlaunch.contract_address,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('LP Locker configured!');
        fetchState();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = async () => {
    if (!confirm(`Cancel ${fairlaunch.name}? Can't be undone.`)) return;
    setCancelling(true);
    try {
      await onCancel(fairlaunch.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const isLPLockerSet =
    state?.lpLocker &&
    state.lpLocker !== '0x0000000000000000000000000000000000000000' &&
    state.lpLocker !== '0x';
  const finalizeStep = state?.finalizeStep ?? 0;
  const isFinalized = state?.isFinalized ?? false; // or fairlaunch.status === 'ENDED'

  // Recovery UI logic
  const showRecovery = finalizeStep > 0 && !isFinalized;

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
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-400">{fairlaunch.symbol || 'TOKEN'}</p>
                {refreshing && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Stats ... same as before */}
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${softcapReached ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
              >
                {softcapReached ? 'Softcap Reached' : 'Softcap Not Reached'}
              </span>
            </div>
            {state && (
              <div>
                <p className="text-xs text-gray-400 mb-1">On-Chain Step</p>
                <span className="text-xs font-mono text-cyan-300">
                  {isFinalized ? 'DONE' : `Step ${finalizeStep}/4`}
                </span>
              </div>
            )}
          </div>

          {/* Contract Address & Verification */}
          {fairlaunch.contract_address && (
            <>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                <code className="font-mono">
                  {fairlaunch.contract_address.slice(0, 10)}...
                  {fairlaunch.contract_address.slice(-8)}
                </code>
                <a
                  href={getExplorerUrl(fairlaunch.contract_address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="pt-4 border-t border-white/10">
                <ContractVerificationButton
                  roundId={fairlaunch.id}
                  poolAddress={fairlaunch.contract_address}
                  tokenAddress={fairlaunch.params?.token_address}
                  vestingAddress={fairlaunch.params?.vesting_address}
                  network={fairlaunch.chain === '97' ? 'bsc_testnet' : 'bsc_mainnet'}
                />
              </div>
            </>
          )}

          {error && (
            <div className="mt-3 bg-red-500/10 border border-red-500 rounded-lg p-3">
              <p className="text-sm text-red-400 break-words">{error}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 min-w-[200px]">
          {softcapReached ? (
            <>
              {/* Main Finalize Button */}
              <button
                onClick={() => handleAction('finalize', `Finalize ${fairlaunch.name}?`)}
                disabled={loading || isFinalized || (!isLPLockerSet && !isFinalized)}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isFinalized ? (
                  'Finalized ✓'
                ) : (
                  <>
                    <Rocket className="w-5 h-5" /> Finalize
                  </>
                )}
              </button>

              {/* LP Locker Warning/Setup */}
              {!isLPLockerSet && !isFinalized && !loading && (
                <button
                  onClick={handleSetupLPLocker}
                  className="px-4 py-2 bg-yellow-600/20 text-yellow-500 border border-yellow-600/50 rounded-lg text-sm hover:bg-yellow-600/30 transition flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" /> Setup LP Locker
                </button>
              )}

              {/* Recovery Controls */}
              {showRecovery && (
                <div className="mt-2 p-2 bg-gray-800 rounded-lg border border-gray-700">
                  <p className="text-xs text-gray-400 mb-2 font-semibold text-center">
                    Recovery Steps
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      disabled={loading || finalizeStep > 0}
                      onClick={() => handleAction('distributeFee')}
                      className={`p-1 text-xs rounded border ${finalizeStep > 0 ? 'bg-green-900/30 border-green-800 text-green-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                      1. Fee
                    </button>
                    <button
                      disabled={loading || finalizeStep !== 1}
                      onClick={() => handleAction('addLiquidity')}
                      className={`p-1 text-xs rounded border ${finalizeStep > 1 ? 'bg-green-900/30 border-green-800 text-green-500' : finalizeStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-500'}`}
                    >
                      2. Liq
                    </button>
                    <button
                      disabled={loading || finalizeStep !== 2}
                      onClick={() => handleAction('lockLP')}
                      className={`p-1 text-xs rounded border ${finalizeStep > 2 ? 'bg-green-900/30 border-green-800 text-green-500' : finalizeStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-500'}`}
                    >
                      3. Lock
                    </button>
                    <button
                      disabled={loading || finalizeStep !== 3}
                      onClick={() => handleAction('distributeFunds')}
                      className={`p-1 text-xs rounded border ${finalizeStep > 3 ? 'bg-green-900/30 border-green-800 text-green-500' : finalizeStep === 3 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-500'}`}
                    >
                      4. Funds
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => handleAction('finalize', 'Enable Refunds?')} // finalize() handles FAILED status update if softcap missed? Actually contract handles it?
              // Wait, finalize() in contract REVERTS if status != ENDED?
              // No, contract finalize() checks softcap. If softcap not reached, it sets FAILED.
              disabled={loading || fairlaunch.status === 'FAILED'}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : fairlaunch.status === 'FAILED' ? (
                'Refunds Enabled ✓'
              ) : (
                <>
                  <AlertCircle className="w-5 h-5" /> Enable Refunds
                </>
              )}
            </button>
          )}

          <button
            onClick={handleCancelClick}
            disabled={cancelling}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
          >
            {cancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
