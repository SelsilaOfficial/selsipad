'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSendTransaction,
} from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { CheckCircle2, Loader2, ExternalLink, RefreshCw, AlertTriangle, Coins } from 'lucide-react';
import { ComplianceGateBanner } from '../ComplianceGateBanner';
import { validateComplianceGates } from '@/../../packages/shared/src/validators/presale-wizard';
import type { ComplianceStatus } from '@/../../packages/shared/src/validators/presale-wizard';
import { getEscrowBreakdown } from '@/lib/presale/helpers';

interface Step9SubmitProps {
  complianceStatus: ComplianceStatus;
  wizardData: any;
  isSubmitting: boolean;
  /** Token contract address (from Step 0/2) */
  tokenAddress: string;
  /** Token decimals (from on-chain read) */
  tokenDecimals: number;
  /** Tokens for sale amount (from Step 2) */
  tokensForSale: string;
  /** Team vesting allocation (from Step 5) */
  teamAllocation: string;
  /** LP lock percentage (from Step 6) */
  lpLockPercentage: number;
  /** Network name for chain detection */
  network: string;
}

type SubmitPhase = 'idle' | 'fee' | 'approve' | 'escrow' | 'submit' | 'complete';

// ────────────────────── Block explorer URL helper ──────────────────────
function getExplorerTxUrl(network: string, hash: string) {
  const explorers: Record<string, string> = {
    bsc_testnet: 'https://testnet.bscscan.com/tx/',
    bsc: 'https://bscscan.com/tx/',
    bnb: 'https://bscscan.com/tx/',
    ethereum: 'https://etherscan.io/tx/',
    sepolia: 'https://sepolia.etherscan.io/tx/',
    base: 'https://basescan.org/tx/',
    base_sepolia: 'https://sepolia.basescan.org/tx/',
  };
  return (explorers[network] || 'https://testnet.bscscan.com/tx/') + hash;
}

// ────────────────────── localStorage persistence ──────────────────────
function storageKey(tokenAddress: string) {
  return `presale_submit_${tokenAddress?.toLowerCase()}`;
}

interface SavedProgress {
  feeTxHash: string | null;
  approvalTxHash: string | null;
  escrowTxHash: string | null;
  launchRoundId: string | null;
  timestamp: number;
}

function loadProgress(tokenAddress: string): SavedProgress | null {
  try {
    const raw = localStorage.getItem(storageKey(tokenAddress));
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedProgress;
    // Expire after 48 hours
    if (Date.now() - data.timestamp > 48 * 60 * 60 * 1000) {
      localStorage.removeItem(storageKey(tokenAddress));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveProgress(tokenAddress: string, updates: Partial<SavedProgress>) {
  try {
    const key = storageKey(tokenAddress);
    const existing = loadProgress(tokenAddress) || {
      feeTxHash: null,
      approvalTxHash: null,
      escrowTxHash: null,
      launchRoundId: null,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify({ ...existing, ...updates, timestamp: Date.now() }));
  } catch {}
}

function clearProgress(tokenAddress: string) {
  try {
    localStorage.removeItem(storageKey(tokenAddress));
  } catch {}
}

// ────────────────────── Component ──────────────────────
export function Step9Submit({
  complianceStatus,
  wizardData,
  tokenAddress,
  tokenDecimals,
  tokensForSale,
  teamAllocation,
  lpLockPercentage,
  network,
}: Step9SubmitProps) {
  const { address, chain } = useAccount();
  const [phase, setPhase] = useState<SubmitPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);

  // Transaction hashes (UI state)
  const [feeTxHash, setFeeTxHash] = useState<string | null>(null);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const [escrowTxHash, setEscrowTxHash] = useState<string | null>(null);

  // Refs for synchronous access (avoids React batching race)
  const feeTxHashRef = useRef<string | null>(null);
  const escrowTxHashRef = useRef<string | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [launchRoundId, setLaunchRoundId] = useState<string | null>(null);

  // Fee configuration
  const [feeAmount, setFeeAmount] = useState<string>('0.5');
  const [escrowVaultAddress, setEscrowVaultAddress] = useState<string>(
    '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F'
  );
  const [treasuryWallet, setTreasuryWallet] = useState<string>(
    '0xaC89Bf746dAf1c782Ed87e81a89fe8885CF979F5'
  );

  // Compliance check
  const { valid: complianceValid, violations } = validateComplianceGates(complianceStatus);

  // Escrow calculation
  const escrowBreakdown = getEscrowBreakdown({
    tokensForSale: tokensForSale || '0',
    teamVestingTokens: teamAllocation || '0',
    lpLockPercentage: lpLockPercentage || 0,
  });

  // Wagmi hooks
  const { writeContract: writeApproval, data: approvalData } = useWriteContract();
  const { writeContract: writeEscrow, data: escrowData } = useWriteContract();
  const { sendTransaction: sendFee, data: feeData } = useSendTransaction();

  const { isLoading: isFeePending } = useWaitForTransactionReceipt({ hash: feeData });
  const { isLoading: isApprovalPending } = useWaitForTransactionReceipt({ hash: approvalData });
  const { isLoading: isEscrowPending } = useWaitForTransactionReceipt({ hash: escrowData });

  // ────────── Restore saved progress on mount ──────────
  useEffect(() => {
    if (!tokenAddress) return;
    const saved = loadProgress(tokenAddress);
    if (!saved) return;
    if (!saved.feeTxHash && !saved.approvalTxHash && !saved.escrowTxHash) return;

    console.log('[PresaleSubmit] Resuming from saved progress:', saved);
    setIsResuming(true);

    if (saved.feeTxHash) {
      setFeeTxHash(saved.feeTxHash);
      feeTxHashRef.current = saved.feeTxHash;
    }
    if (saved.approvalTxHash) setApprovalTxHash(saved.approvalTxHash);
    if (saved.escrowTxHash) {
      setEscrowTxHash(saved.escrowTxHash);
      escrowTxHashRef.current = saved.escrowTxHash;
    }
    if (saved.launchRoundId) setLaunchRoundId(saved.launchRoundId);
  }, [tokenAddress]);

  // ────────── Fetch fee config ──────────
  useEffect(() => {
    fetch('/api/config/fees')
      .then((r) => r.json())
      .then((data) => {
        const cid = chain?.id || 97;
        if (data.fees?.[cid]?.PRESALE) setFeeAmount(data.fees[cid].PRESALE);
        if (data.escrowVaults?.[cid]) setEscrowVaultAddress(data.escrowVaults[cid]);
        if (data.treasuryWallets?.[cid]) setTreasuryWallet(data.treasuryWallets[cid]);
        console.log('[PresaleSubmit] Fee config loaded:', {
          cid,
          fee: data.fees?.[cid]?.PRESALE,
          treasury: data.treasuryWallets?.[cid],
        });
      })
      .catch((err) => {
        console.error('[PresaleSubmit] Fee config error:', err);
      });
  }, [chain?.id]);

  // ═══════════════════ STEP HANDLERS ═══════════════════

  // STEP 1: Pay Creation Fee
  const handlePayFee = () => {
    if (treasuryWallet === '0x0000000000000000000000000000000000000000') {
      setError('Treasury wallet not configured. Please try again.');
      return;
    }
    setPhase('fee');
    setError(null);
    console.log('[PresaleSubmit] Sending fee:', feeAmount, 'BNB to', treasuryWallet);
    sendFee(
      {
        to: treasuryWallet as `0x${string}`,
        value: parseEther(feeAmount),
      },
      {
        onError: (err) => {
          console.error('[PresaleSubmit] Fee error:', err);
          setError(err.message || 'Fee payment failed');
          setPhase('idle');
        },
      }
    );
  };

  // STEP 2: Approve token transfer
  const handleApprove = () => {
    setPhase('approve');
    setError(null);

    console.log('[PresaleSubmit] Approving tokens:', escrowBreakdown.total);
    writeApproval(
      {
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            name: 'approve',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'bool' }],
          },
        ],
        functionName: 'approve',
        args: [
          escrowVaultAddress as `0x${string}`,
          parseUnits(escrowBreakdown.total.toString(), tokenDecimals || 18),
        ],
      },
      {
        onError: (err) => {
          console.error('[PresaleSubmit] Approval error:', err);
          setError(err.message || 'Token approval failed');
          setPhase('idle');
        },
      }
    );
  };

  // STEP 3: Deposit tokens to Escrow
  const handleEscrow = async () => {
    setPhase('escrow');
    setError(null);

    // Reuse existing launchRoundId or generate one
    const roundId = launchRoundId || crypto.randomUUID();
    const { keccak256, toBytes } = await import('viem');
    const projectIdBytes32 = keccak256(toBytes(roundId));

    setLaunchRoundId(roundId);
    saveProgress(tokenAddress, { launchRoundId: roundId });

    console.log('[PresaleSubmit] Depositing to escrow, roundId:', roundId);
    writeEscrow(
      {
        address: escrowVaultAddress as `0x${string}`,
        abi: [
          {
            name: 'deposit',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'projectId', type: 'bytes32' },
              { name: 'tokenAddress', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [],
          },
        ],
        functionName: 'deposit',
        args: [
          projectIdBytes32,
          tokenAddress as `0x${string}`,
          parseUnits(escrowBreakdown.total.toString(), tokenDecimals || 18),
        ],
      },
      {
        onError: (err) => {
          console.error('[PresaleSubmit] Escrow error:', err);
          setError(err.message || 'Escrow deposit failed');
          setPhase('idle');
        },
      }
    );
  };

  // STEP 4: Submit to Backend API
  const handleSubmit = useCallback(async () => {
    try {
      setPhase('submit');
      setError(null);

      const currentEscrowTx = escrowTxHashRef.current;
      const currentFeeTx = feeTxHashRef.current;

      if (!currentEscrowTx || !currentFeeTx) {
        throw new Error('Missing transaction hashes. Please complete all on-chain steps first.');
      }

      // Detect chain ID
      const chainId = (() => {
        if (network === 'bsc_testnet') return 97;
        if (network === 'bsc' || network === 'bnb') return 56;
        if (network === 'ethereum') return 1;
        if (network === 'sepolia') return 11155111;
        if (network === 'base') return 8453;
        if (network === 'base_sepolia') return 84532;
        return chain?.id || 97;
      })();

      const submitData = {
        // Token info
        contract_address: tokenAddress,
        token_symbol: wizardData.token_symbol,
        token_decimals: tokenDecimals,
        // Basic info
        basics: wizardData.basics,
        // Sale params
        sale_params: wizardData.sale_params,
        // Vesting
        investor_vesting: wizardData.investor_vesting,
        team_vesting: wizardData.team_vesting,
        // LP Lock
        lp_lock: wizardData.lp_lock,
        // Anti Bot
        anti_bot: wizardData.anti_bot,
        // Fees
        fees_referral: wizardData.fees_referral,
        // On-chain
        escrowTxHash: currentEscrowTx,
        creationFeeTxHash: currentFeeTx,
        escrow_amount: escrowBreakdown.total.toString(),
        // Meta
        creator_wallet: address,
        chain_id: chainId,
        network,
        contract_mode: wizardData.contract_mode,
        terms_accepted: true,
      };

      console.log('[PresaleSubmit] Submitting:', submitData);

      const response = await fetch('/api/presale/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      setProjectId(data.project_id);
      setLaunchRoundId(data.round?.id);
      setPhase('complete');
      clearProgress(tokenAddress);
    } catch (err: any) {
      console.error('[PresaleSubmit] Submit error:', err);
      setError(err.message);
      setPhase('idle');
    }
  }, [wizardData, tokenAddress, tokenDecimals, address, network, chain?.id, escrowBreakdown.total]);

  // ═══════════════════ AUTO-PROGRESS ═══════════════════

  // Step 1 done → Step 2
  useEffect(() => {
    if (feeData && !isFeePending && phase === 'fee') {
      feeTxHashRef.current = feeData;
      setFeeTxHash(feeData);
      saveProgress(tokenAddress, { feeTxHash: feeData });
      setTimeout(() => handleApprove(), 1000);
    }
  }, [feeData, isFeePending, phase]);

  // Step 2 done → Step 3
  useEffect(() => {
    if (approvalData && !isApprovalPending && phase === 'approve') {
      setApprovalTxHash(approvalData);
      saveProgress(tokenAddress, { approvalTxHash: approvalData });
      setTimeout(() => handleEscrow(), 1000);
    }
  }, [approvalData, isApprovalPending, phase]);

  // Step 3 done → Step 4
  useEffect(() => {
    if (escrowData && !isEscrowPending && phase === 'escrow') {
      escrowTxHashRef.current = escrowData;
      setEscrowTxHash(escrowData);
      saveProgress(tokenAddress, { escrowTxHash: escrowData });
      setTimeout(() => handleSubmit(), 1000);
    }
  }, [escrowData, isEscrowPending, phase]);

  // ═══════════════════ RESUME LOGIC ═══════════════════

  const nextAction = (() => {
    if (!feeTxHash) return 'fee';
    if (!approvalTxHash) return 'approve';
    if (!escrowTxHash) return 'escrow';
    return 'submit';
  })();

  const handleResume = () => {
    setError(null);
    switch (nextAction) {
      case 'fee':
        handlePayFee();
        break;
      case 'approve':
        handleApprove();
        break;
      case 'escrow':
        handleEscrow();
        break;
      case 'submit':
        handleSubmit();
        break;
    }
  };

  const isProcessing = phase !== 'idle' && phase !== 'complete';
  const stepLabel: Record<string, string> = {
    fee: '1',
    approve: '2',
    escrow: '3',
    submit: '4',
  };

  const nativeCurrency = (() => {
    if (network?.includes('bsc') || network === 'bnb') return 'BNB';
    if (network?.includes('base') || network?.includes('eth') || network === 'sepolia')
      return 'ETH';
    return 'BNB';
  })();

  // ═══════════════════ RENDER ═══════════════════

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Submit Presale</h2>
        <p className="text-gray-400">
          Complete compliance checks and on-chain transactions to submit your presale.
        </p>
      </div>

      {/* Compliance Banner */}
      <ComplianceGateBanner
        kycStatus={complianceStatus.kyc_status}
        scScanStatus={complianceStatus.sc_scan_status}
        vestingValid={
          complianceStatus.investor_vesting_valid && complianceStatus.team_vesting_valid
        }
        lpLockValid={complianceStatus.lp_lock_valid}
      />

      {/* Compliance Violations */}
      {!complianceValid && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-white font-semibold mb-2">
                Cannot Submit — Requirements Not Met:
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-300">
                {violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Escrow Token Breakdown */}
      {complianceValid && escrowBreakdown.total > 0 && (
        <div className="p-5 bg-purple-900/20 border border-purple-700/30 rounded-lg space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-5 h-5 text-purple-400" />
            <h3 className="text-white font-semibold text-sm">Token Escrow Breakdown</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>Tokens for Sale</span>
              <span className="font-mono text-yellow-400">
                {escrowBreakdown.sale.toLocaleString()}
              </span>
            </div>
            {escrowBreakdown.lp > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>LP Liquidity ({lpLockPercentage}% of sale)</span>
                <span className="font-mono text-blue-400">
                  {escrowBreakdown.lp.toLocaleString()}
                </span>
              </div>
            )}
            {escrowBreakdown.team > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Team Vesting</span>
                <span className="font-mono text-green-400">
                  {escrowBreakdown.team.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between text-white font-semibold border-t border-gray-700 pt-2">
              <span>Total to Escrow</span>
              <span className="font-mono text-purple-300">
                {escrowBreakdown.total.toLocaleString()} tokens
              </span>
            </div>
          </div>
        </div>
      )}

      {/* On-Chain Steps */}
      {complianceValid && (
        <div className="space-y-3">
          {/* Resume Banner */}
          {isResuming && phase === 'idle' && nextAction !== 'fee' && (
            <div className="bg-yellow-900/30 border border-yellow-500/40 rounded-lg p-4">
              <p className="text-yellow-200 font-semibold text-sm mb-1">
                ⚡ Previous submission detected
              </p>
              <p className="text-yellow-300/70 text-xs mb-3">
                {nextAction === 'approve' && 'Fee paid. Continue with token approval.'}
                {nextAction === 'escrow' &&
                  'Fee paid & tokens approved. Continue with escrow deposit.'}
                {nextAction === 'submit' && 'All on-chain steps done! Submit to backend.'}
              </p>
              <button
                onClick={handleResume}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Resume from Step {stepLabel[nextAction]}
              </button>
            </div>
          )}

          {/* Step 1: Pay Fee */}
          <StepCard
            stepNum="1"
            title="Pay Creation Fee"
            description={`${feeAmount} ${nativeCurrency} platform fee`}
            txHash={feeTxHash}
            isActive={phase === 'fee'}
            isDone={!!feeTxHash}
            showAction={!feeTxHash && phase === 'idle' && nextAction === 'fee' && !isResuming}
            actionLabel="Pay Fee"
            onAction={handlePayFee}
            network={network}
          />

          {/* Step 2: Approve */}
          <StepCard
            stepNum="2"
            title="Approve Token Transfer"
            description={`Allow escrow to hold ${escrowBreakdown.total.toLocaleString()} tokens`}
            txHash={approvalTxHash}
            isActive={phase === 'approve'}
            isDone={!!approvalTxHash}
            showAction={!approvalTxHash && !!feeTxHash && phase === 'idle'}
            actionLabel="Approve"
            onAction={handleApprove}
            network={network}
          />

          {/* Step 3: Escrow */}
          <StepCard
            stepNum="3"
            title="Deposit Tokens to Escrow"
            description="Tokens held safely until admin deploys the presale"
            txHash={escrowTxHash}
            isActive={phase === 'escrow'}
            isDone={!!escrowTxHash}
            showAction={!escrowTxHash && !!approvalTxHash && phase === 'idle'}
            actionLabel="Deposit"
            onAction={handleEscrow}
            network={network}
          />

          {/* Step 4: Submit */}
          <div
            className={`border rounded-lg p-4 ${
              phase === 'submit'
                ? 'border-purple-500 bg-purple-500/10'
                : phase === 'complete'
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {phase === 'complete' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : phase === 'submit' ? (
                  <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-600 flex items-center justify-center text-xs text-gray-400">
                    4
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-white">4. Submit for Review</h3>
                  <p className="text-sm text-gray-400">
                    {phase === 'submit'
                      ? 'Finalizing submission...'
                      : 'Submit to admin for deployment'}
                  </p>
                </div>
              </div>
              {!!escrowTxHash && !!feeTxHash && phase === 'idle' && (
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  Submit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {phase === 'complete' && (
        <div className="bg-green-900/30 border border-green-500/40 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-green-300 mb-2">Submitted Successfully!</h3>
          <p className="text-green-400/70 text-sm mb-4">
            Your presale is pending admin review and deployment.
          </p>
          <a
            href="/profile/projects"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            View My Projects
          </a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-4">
          <p className="text-red-300 font-semibold text-sm">Error</p>
          <p className="text-red-400/80 text-xs mt-1">{error}</p>
          {phase === 'idle' && (
            <button
              onClick={handleResume}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          )}
        </div>
      )}

      {/* What Happens Next (show only before submission starts) */}
      {phase === 'idle' && !isResuming && complianceValid && nextAction === 'fee' && (
        <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
          <h3 className="text-white font-semibold mb-3">What happens after submission?</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
            <li>Admin team reviews your presale configuration (usually within 24-48 hours)</li>
            <li>If approved, admin deploys your presale contract on-chain</li>
            <li>Escrowed tokens are released to the deployed contract</li>
            <li>Once start time is reached, your presale goes live for contributions</li>
            <li>After end time, finalization handles fee distribution and token vesting</li>
          </ol>
        </div>
      )}
    </div>
  );
}

// ════════════════════ StepCard sub-component ════════════════════
function StepCard({
  stepNum,
  title,
  description,
  txHash,
  isActive,
  isDone,
  showAction,
  actionLabel,
  onAction,
  network,
}: {
  stepNum: string;
  title: string;
  description: string;
  txHash: string | null;
  isActive: boolean;
  isDone: boolean;
  showAction: boolean;
  actionLabel: string;
  onAction: () => void;
  network: string;
}) {
  return (
    <div
      className={`border rounded-lg p-4 ${
        isActive
          ? 'border-purple-500 bg-purple-500/10'
          : isDone
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-gray-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isDone ? (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          ) : isActive ? (
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-gray-600 flex items-center justify-center text-xs text-gray-400">
              {stepNum}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-white">
              {stepNum}. {title}
            </h3>
            <p className="text-sm text-gray-400">{description}</p>
          </div>
        </div>
        {showAction && (
          <button
            onClick={onAction}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {txHash && (
        <a
          href={getExplorerTxUrl(network, txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-purple-400 flex items-center gap-1 mt-2"
        >
          View Transaction <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
