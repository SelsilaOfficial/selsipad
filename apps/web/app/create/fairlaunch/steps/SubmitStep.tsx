'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { calculateTotalTokensRequired } from '@/lib/fairlaunch/helpers';

interface SubmitStepProps {
  formData: any;
  onBack: () => void;
}

type SubmitPhase = 'idle' | 'approve' | 'escrow' | 'fee' | 'submit' | 'complete';

export function SubmitStep({ formData, onBack }: SubmitStepProps) {
  const { address, chain } = useAccount();
  const [phase, setPhase] = useState<SubmitPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  
  // Transaction states
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const [escrowTxHash, setEscrowTxHash] = useState<string | null>(null);
  const [feeTxHash, setFeeTxHash] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [launchRoundId, setLaunchRoundId] = useState<string | null>(null);

  // Fetch fee configuration
  const [feeAmount, setFeeAmount] = useState<string>('0.2'); // Default BSC Fairlaunch
  const [escrowVaultAddress, setEscrowVaultAddress] = useState<string>('0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F');
  const [treasuryWallet, setTreasuryWallet] = useState<string>('0x0000000000000000000000000000000000000000');

  const { writeContract: writeApproval, data: approvalData } = useWriteContract();
  const { writeContract: writeEscrow, data: escrowData } = useWriteContract();
  const { sendTransaction: sendFee, data: feeData } = useSendTransaction();

  const { isLoading: isApprovalPending } = useWaitForTransactionReceipt({
    hash: approvalData,
  });

  const { isLoading: isEscrowPending } = useWaitForTransactionReceipt({
    hash: escrowData,
  });

  const { isLoading: isFeePending } = useWaitForTransactionReceipt({
    hash: feeData,
  });

  // Fetch fee config on mount
  useEffect(() => {
    fetch('/api/config/fees')
      .then(res => res.json())
      .then(data => {
        const chainId = chain?.id || 97;
        const fees = data.fees[chainId];
        if (fees) {
          setFeeAmount(fees.FAIRLAUNCH);
        }
        const vaults = data.escrowVaults;
        if (vaults && vaults[chainId]) {
          setEscrowVaultAddress(vaults[chainId]);
        }
        const treasury = data.treasuryWallets;
        if (treasury && treasury[chainId]) {
          setTreasuryWallet(treasury[chainId]);
        }
      })
      .catch(console.error);
  }, [chain?.id]);

  // Step 1: Approve token transfer
  const handleApprove = async () => {
    try {
      setPhase('approve');
      setError(null);

      // Calculate total tokens required (tokensForSale + liquidityTokens + teamVesting)
      const totalTokensRequired = calculateTotalTokensRequired({
        tokensForSale: formData.tokensForSale,
        teamVestingTokens: formData.teamAllocation || '0',
        softcap: formData.softcap,
        liquidityPercent: formData.liquidityPercent || 80,
        listingPremiumBps: formData.listingPremiumBps || 0,
      });

      const totalTokensParsed = parseUnits(
        totalTokensRequired.toString(),
        formData.tokenDecimals || 18
      );

      writeApproval({
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
        args: [escrowVaultAddress as `0x${string}`, totalTokensParsed],
      });
    } catch (err: any) {
      setError(err.message);
      setPhase('idle');
    }
  };

  // Step 2: Transfer to Escrow
  const handleEscrow = async () => {
    try {
      setPhase('escrow');
      setError(null);

      // Calculate total tokens required (same as approval)
      const totalTokensRequired = calculateTotalTokensRequired({
        tokensForSale: formData.tokensForSale,
        teamVestingTokens: formData.teamAllocation || '0',
        softcap: formData.softcap,
        liquidityPercent: formData.liquidityPercent || 80,
        listingPremiumBps: formData.listingPremiumBps || 0,
      });

      const totalTokensParsed = parseUnits(
        totalTokensRequired.toString(),
        formData.tokenDecimals || 18
      );

      // Generate projectId (browser-compatible)
      const tempLaunchRoundId = crypto.randomUUID();
      
      // Convert UUID string to bytes32 using keccak256
      const { keccak256, toHex, toBytes } = await import('viem');
      const projectIdBytes32 = keccak256(toBytes(tempLaunchRoundId));

      writeEscrow({
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
        args: [projectIdBytes32, formData.tokenAddress as `0x${string}`, totalTokensParsed],
      });

      setLaunchRoundId(tempLaunchRoundId);
    } catch (err: any) {
      setError(err.message);
      setPhase('approve');
    }
  };

  // Step 3: Pay Creation Fee
  const handlePayFee = async () => {
    try {
      setPhase('fee');
      setError(null);

      sendFee({
        to: treasuryWallet as `0x${string}`,
        value: parseEther(feeAmount),
      });
    } catch (err: any) {
      setError(err.message);
      setPhase('escrow');
    }
  };

  // Step 4: Submit to Backend
  const handleSubmit = async () => {
    try {
      setPhase('submit');
      setError(null);

      // Transform formData to match API validation schema
      const submitData = {
        // Token configuration
        projectToken: formData.tokenAddress,
        tokenDecimals: formData.tokenDecimals || 18,

        // Sale parameters
        softcap: formData.softcap,
        tokensForSale: formData.tokensForSale,
        minContribution: formData.minContribution,
        maxContribution: formData.maxContribution,

        // Timing  
        startTime: formData.startTime,
        endTime: formData.endTime,

        // Liquidity settings
        liquidityPercent: formData.liquidityPercent || 70,
        lpLockMonths: formData.lpLockMonths || 24,
        listingPremiumBps: formData.listingPremiumBps || 0,
        dexPlatform: formData.dexPlatform || 'PancakeSwap',

        // Team vesting
        teamVestingTokens: formData.teamAllocation || '0',
        teamVestingAddress: formData.vestingBeneficiary,
        vestingSchedule: formData.vestingSchedule,
        creatorWallet: address,

        // Network
        chainId: formData.network === 'bsc_testnet' ? 97 : 56,

        // Metadata (new structure expected by API)
        metadata: {
          name: formData.projectName,
          symbol: formData.tokenSymbol, // ← Add token symbol
          description: formData.description, // ← correct field name
          logoUrl: formData.logoUrl,
          projectWebsite: formData.socialLinks?.website,
          telegram: formData.socialLinks?.telegram,
          twitter: formData.socialLinks?.twitter,
          discord: formData.socialLinks?.discord,
        },

        // Transaction hashes
        escrowTxHash,
        creationFeeTxHash: feeTxHash,
      };

      console.log('[SubmitStep] Submitting data:', submitData);

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
    } catch (err: any) {
      console.error('[SubmitStep] Submit error:', err);
      setError(err.message);
      setPhase('fee');
    }
  };

  // Auto-progress after transactions
  useEffect(() => {
    if (approvalData && !isApprovalPending && phase === 'approve') {
      setApprovalTxHash(approvalData);
      setTimeout(() => handleEscrow(), 1000);
    }
  }, [approvalData, isApprovalPending, phase]);

  useEffect(() => {
    if (escrowData && !isEscrowPending && phase === 'escrow') {
      setEscrowTxHash(escrowData);
      setTimeout(() => handlePayFee(), 1000);
    }
  }, [escrowData, isEscrowPending, phase]);

  useEffect(() => {
    if (feeData && !isFeePending && phase === 'fee') {
      setFeeTxHash(feeData);
      setTimeout(() => handleSubmit(), 1000);
    }
  }, [feeData, isFeePending, phase]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-br from-purple-500 to-blue-600 text-white rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-2">Submit Your Fairlaunch</h2>
        <p className="text-purple-100">
          Complete these steps to submit your project for admin deployment
        </p>
      </div>

      {/* Progress Steps */}
      <div className="space-y-4">
        {/* Step 1: Token Approval */}
        <div className={`border rounded-lg p-4 ${phase === 'approve' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {approvalTxHash ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : phase === 'approve' ? (
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
              )}
              <div>
                <h3 className="font-semibold">1. Approve Token Transfer</h3>
                <p className="text-sm text-gray-600">Allow escrow contract to hold your tokens</p>
              </div>
            </div>
            {!approvalTxHash && phase === 'idle' && (
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Approve
              </button>
            )}
          </div>
          {approvalTxHash && (
            <a
              href={`https://testnet.bscscan.com/tx/${approvalTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-purple-600 flex items-center gap-1 mt-2"
            >
              View Transaction <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Step 2: Escrow Tokens */}
        <div className={`border rounded-lg p-4 ${phase === 'escrow' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {escrowTxHash ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : phase === 'escrow' ? (
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
              )}
              <div>
                <h3 className="font-semibold">2. Send Tokens to Escrow</h3>
                <p className="text-sm text-gray-600">
                  {formData.tokensForSale.toLocaleString()} tokens held safely until deployment
                </p>
              </div>
            </div>
          </div>
          {escrowTxHash && (
            <a
              href={`https://testnet.bscscan.com/tx/${escrowTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-purple-600 flex items-center gap-1 mt-2"
            >
              View Transaction <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Step 3: Pay Creation Fee */}
        <div className={`border rounded-lg p-4 ${phase === 'fee' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {feeTxHash ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : phase === 'fee' ? (
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
              )}
              <div>
                <h3 className="font-semibold">3. Pay Creation Fee</h3>
                <p className="text-sm text-gray-600">{feeAmount} BNB platform fee</p>
              </div>
            </div>
          </div>
          {feeTxHash && (
            <a
              href={`https://testnet.bscscan.com/tx/${feeTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-purple-600 flex items-center gap-1 mt-2"
            >
              View Transaction <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Step 4: Submit */}
        <div className={`border rounded-lg p-4 ${phase === 'submit' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            {phase === 'complete' ? (
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            ) : phase === 'submit' ? (
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
            )}
            <div>
              <h3 className="font-semibold">4. Submit Project</h3>
              <p className="text-sm text-gray-600">Finalizing submission...</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success State */}
      {phase === 'complete' && (
        <div className="bg-green-50 border border-green-500 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-green-900 mb-2">Submitted Successfully!</h3>
          <p className="text-green-700 mb-4">
            Your Fairlaunch is pending admin deployment. You can track the status in your dashboard.
          </p>
          <a
            href="/profile/projects"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            View My Projects
          </a>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-500 rounded-lg p-4">
          <p className="text-red-800 font-semibold">Error</p>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Back Button */}
      {phase === 'idle' && (
        <button
          onClick={onBack}
          className="w-full py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
      )}
    </div>
  );
}
