'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSendTransaction,
} from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { CheckCircle2, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { calculateTotalTokensRequired } from '@/lib/fairlaunch/helpers';

interface SubmitStepProps {
  formData: any;
  onBack: () => void;
}

type SubmitPhase = 'idle' | 'fee' | 'approve' | 'escrow' | 'submit' | 'complete';

// ────────────────────── localStorage helpers ──────────────────────
function storageKey(tokenAddress: string) {
  return `fairlaunch_submit_${tokenAddress?.toLowerCase()}`;
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
export function SubmitStep({ formData, onBack }: SubmitStepProps) {
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

  // Fee configuration — default treasury to platform wallet (not zero address!)
  const [feeAmount, setFeeAmount] = useState<string>('0.2');
  const [escrowVaultAddress, setEscrowVaultAddress] = useState<string>(
    '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F'
  );
  const [treasuryWallet, setTreasuryWallet] = useState<string>(
    '0xaC89Bf746dAf1c782Ed87e81a89fe8885CF979F5'
  );

  // Wagmi hooks — onError callbacks are critical since these don't throw!
  const { writeContract: writeApproval, data: approvalData } = useWriteContract();
  const { writeContract: writeEscrow, data: escrowData } = useWriteContract();
  const { sendTransaction: sendFee, data: feeData } = useSendTransaction();

  const { isLoading: isFeePending } = useWaitForTransactionReceipt({ hash: feeData });
  const { isLoading: isApprovalPending } = useWaitForTransactionReceipt({ hash: approvalData });
  const { isLoading: isEscrowPending } = useWaitForTransactionReceipt({ hash: escrowData });

  // ────────── Restore saved progress on mount ──────────
  useEffect(() => {
    if (!formData.tokenAddress) return;
    const saved = loadProgress(formData.tokenAddress);
    if (!saved) return;
    if (!saved.feeTxHash && !saved.approvalTxHash && !saved.escrowTxHash) return;

    console.log('[SubmitStep] Resuming from saved progress:', saved);
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
  }, [formData.tokenAddress]);

  // ────────── Fetch fee config ──────────
  useEffect(() => {
    fetch('/api/config/fees')
      .then((r) => r.json())
      .then((data) => {
        const cid = chain?.id || 97;
        if (data.fees?.[cid]) setFeeAmount(data.fees[cid].FAIRLAUNCH);
        if (data.escrowVaults?.[cid]) setEscrowVaultAddress(data.escrowVaults[cid]);
        if (data.treasuryWallets?.[cid]) setTreasuryWallet(data.treasuryWallets[cid]);
        console.log('[SubmitStep] Fee config loaded:', {
          cid,
          treasury: data.treasuryWallets?.[cid],
        });
      })
      .catch((err) => {
        console.error('[SubmitStep] Fee config error:', err);
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
    console.log('[SubmitStep] Sending fee:', feeAmount, 'BNB to', treasuryWallet);
    sendFee(
      {
        to: treasuryWallet as `0x${string}`,
        value: parseEther(feeAmount),
      },
      {
        onError: (err) => {
          console.error('[SubmitStep] Fee error:', err);
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

    const totalTokensRequired = calculateTotalTokensRequired({
      tokensForSale: formData.tokensForSale,
      teamVestingTokens: formData.teamAllocation || '0',
      softcap: formData.softcap,
      liquidityPercent: formData.liquidityPercent || 80,
      listingPremiumBps: formData.listingPremiumBps || 0,
    });

    console.log('[SubmitStep] Approving tokens:', totalTokensRequired.toString());
    writeApproval(
      {
        address: formData.tokenAddress as `0x${string}`,
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
          parseUnits(totalTokensRequired.toString(), formData.tokenDecimals || 18),
        ],
      },
      {
        onError: (err) => {
          console.error('[SubmitStep] Approval error:', err);
          setError(err.message || 'Token approval failed');
          setPhase('idle');
        },
      }
    );
  };

  // STEP 3: Deposit tokens to Escrow (irreversible – done last!)
  const handleEscrow = async () => {
    setPhase('escrow');
    setError(null);

    const totalTokensRequired = calculateTotalTokensRequired({
      tokensForSale: formData.tokensForSale,
      teamVestingTokens: formData.teamAllocation || '0',
      softcap: formData.softcap,
      liquidityPercent: formData.liquidityPercent || 80,
      listingPremiumBps: formData.listingPremiumBps || 0,
    });

    // Reuse existing launchRoundId or generate one (persisted for retries)
    const roundId = launchRoundId || crypto.randomUUID();
    const { keccak256, toBytes } = await import('viem');
    const projectIdBytes32 = keccak256(toBytes(roundId));

    setLaunchRoundId(roundId);
    saveProgress(formData.tokenAddress, { launchRoundId: roundId });

    console.log('[SubmitStep] Depositing to escrow, roundId:', roundId);
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
          formData.tokenAddress as `0x${string}`,
          parseUnits(totalTokensRequired.toString(), formData.tokenDecimals || 18),
        ],
      },
      {
        onError: (err) => {
          console.error('[SubmitStep] Escrow error:', err);
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

      const submitData = {
        projectToken: formData.tokenAddress,
        tokenDecimals: formData.tokenDecimals || 18,
        softcap: formData.softcap,
        tokensForSale: formData.tokensForSale,
        minContribution: formData.minContribution,
        maxContribution: formData.maxContribution,
        startTime: formData.startTime,
        endTime: formData.endTime,
        liquidityPercent: formData.liquidityPercent || 70,
        lpLockMonths: formData.lpLockMonths || 24,
        listingPremiumBps: formData.listingPremiumBps || 0,
        dexPlatform: formData.dexPlatform || 'PancakeSwap',
        teamVestingTokens: formData.teamAllocation || '0',
        teamVestingAddress: formData.vestingBeneficiary,
        vestingSchedule: formData.vestingSchedule,
        creatorWallet: address,
        chainId: formData.network === 'bsc_testnet' ? 97 : 56,
        metadata: {
          name: formData.projectName,
          symbol: formData.tokenSymbol,
          description: formData.description,
          logoUrl: formData.logoUrl,
          bannerUrl: formData.bannerUrl,
          projectWebsite: formData.socialLinks?.website,
          telegram: formData.socialLinks?.telegram,
          twitter: formData.socialLinks?.twitter,
          discord: formData.socialLinks?.discord,
        },
        escrowTxHash: currentEscrowTx,
        creationFeeTxHash: currentFeeTx,
      };

      console.log('[SubmitStep] Submitting:', submitData);

      const response = await fetch('/api/fairlaunch/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || data.details?.join(', ') || 'Submission failed');
      }

      setProjectId(data.projectId);
      setLaunchRoundId(data.launchRoundId);
      setPhase('complete');
      clearProgress(formData.tokenAddress);
    } catch (err: any) {
      console.error('[SubmitStep] Submit error:', err);
      setError(err.message);
      setPhase('idle');
    }
  }, [formData, address]);

  // ═══════════════════ AUTO-PROGRESS ═══════════════════

  // Step 1 done → Step 2
  useEffect(() => {
    if (feeData && !isFeePending && phase === 'fee') {
      feeTxHashRef.current = feeData;
      setFeeTxHash(feeData);
      saveProgress(formData.tokenAddress, { feeTxHash: feeData });
      setTimeout(() => handleApprove(), 1000);
    }
  }, [feeData, isFeePending, phase]);

  // Step 2 done → Step 3
  useEffect(() => {
    if (approvalData && !isApprovalPending && phase === 'approve') {
      setApprovalTxHash(approvalData);
      saveProgress(formData.tokenAddress, { approvalTxHash: approvalData });
      setTimeout(() => handleEscrow(), 1000);
    }
  }, [approvalData, isApprovalPending, phase]);

  // Step 3 done → Step 4
  useEffect(() => {
    if (escrowData && !isEscrowPending && phase === 'escrow') {
      escrowTxHashRef.current = escrowData;
      setEscrowTxHash(escrowData);
      saveProgress(formData.tokenAddress, { escrowTxHash: escrowData });
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

  // ═══════════════════ RENDER ═══════════════════

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-br from-purple-600/80 to-blue-700/80 text-white rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-2">Submit Your Fairlaunch</h2>
        <p className="text-purple-200 text-sm">
          Complete these steps to submit your project for admin deployment
        </p>
      </div>

      {/* Resume Banner */}
      {isResuming && phase === 'idle' && nextAction !== 'fee' && (
        <div className="bg-yellow-900/30 border border-yellow-500/40 rounded-lg p-4">
          <p className="text-yellow-200 font-semibold text-sm mb-1">
            ⚡ Previous submission detected
          </p>
          <p className="text-yellow-300/70 text-xs mb-3">
            {nextAction === 'approve' && 'Fee paid. Continue with token approval.'}
            {nextAction === 'escrow' && 'Fee paid & tokens approved. Continue with escrow deposit.'}
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

      {/* Steps */}
      <div className="space-y-3">
        {/* Step 1: Pay Fee */}
        <StepCard
          stepNum="1"
          title="Pay Creation Fee"
          description={`${feeAmount} BNB platform fee`}
          txHash={feeTxHash}
          isActive={phase === 'fee'}
          isDone={!!feeTxHash}
          showAction={!feeTxHash && phase === 'idle' && nextAction === 'fee' && !isResuming}
          actionLabel="Pay Fee"
          onAction={handlePayFee}
        />

        {/* Step 2: Approve */}
        <StepCard
          stepNum="2"
          title="Approve Token Transfer"
          description="Allow escrow contract to hold your tokens"
          txHash={approvalTxHash}
          isActive={phase === 'approve'}
          isDone={!!approvalTxHash}
          showAction={!approvalTxHash && !!feeTxHash && phase === 'idle'}
          actionLabel="Approve"
          onAction={handleApprove}
        />

        {/* Step 3: Escrow */}
        <StepCard
          stepNum="3"
          title="Send Tokens to Escrow"
          description={`Tokens held safely until deployment`}
          txHash={escrowTxHash}
          isActive={phase === 'escrow'}
          isDone={!!escrowTxHash}
          showAction={!escrowTxHash && !!approvalTxHash && phase === 'idle'}
          actionLabel="Deposit"
          onAction={handleEscrow}
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
                <h3 className="font-semibold text-white">4. Submit Project</h3>
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

      {/* Success */}
      {phase === 'complete' && (
        <div className="bg-green-900/30 border border-green-500/40 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-green-300 mb-2">Submitted Successfully!</h3>
          <p className="text-green-400/70 text-sm mb-4">
            Your Fairlaunch is pending admin deployment.
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

      {/* Back */}
      {phase === 'idle' && !isResuming && nextAction === 'fee' && (
        <button
          onClick={onBack}
          className="w-full py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800"
        >
          Back
        </button>
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
          href={`https://testnet.bscscan.com/tx/${txHash}`}
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
