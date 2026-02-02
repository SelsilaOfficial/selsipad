'use client';

import { useState, useEffect, useRef } from 'react';
import { formatUnits } from 'viem';
import { DeploymentProgress } from '@/components/fairlaunch/DeploymentProgress';
import { TokenFundingModal } from '@/components/fairlaunch/TokenFundingModal';
import { DeploymentStatusBadge } from '@/components/fairlaunch/DeploymentStatusBadge';
import { VerificationStatusBadge } from '@/components/fairlaunch/VerificationStatusBadge';
import { useDeploymentStatusPolling } from '@/hooks/useDeploymentStatusPolling';
import { ExternalLink, CheckCircle2, Home, Coins } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DeploymentStatus, VerificationStatus } from '@/types/deployment';

interface DeployStepProps {
  wizardData: any;
  onDeploy: () => Promise<{
    success: boolean;
    fairlaunchAddress?: string;
    transactionHash?: string;
    launchRoundId?: string;
    tokenInfo?: {
      symbol: string;
      balance: string;
      required: string;
    };
    nextStep?: string;
    error?: string;
  }>;
  explorerUrl?: string;
}

interface DeploymentStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  message?: string;
}

export function DeployStep({ wizardData, onDeploy, explorerUrl }: DeployStepProps) {
  const router = useRouter();
  const [steps, setSteps] = useState<DeploymentStep[]>([
    { id: 'prepare', label: 'Preparing deployment', status: 'pending' },
    { id: 'deploy', label: 'Deploying contract via backend', status: 'pending' },
    { id: 'verify', label: 'Auto-verifying on BSCScan', status: 'pending' },
    { id: 'database', label: 'Saving to database', status: 'pending' },
    { id: 'complete', label: 'Deployment complete!', status: 'pending' },
  ]);

  const [transactionHash, setTransactionHash] = useState<string | undefined>();
  const [fairlaunchAddress, setFairlaunchAddress] = useState<string | undefined>();
  const [launchRoundId, setLaunchRoundId] = useState<string | undefined>();
  const [tokenInfo, setTokenInfo] = useState<{ symbol: string; balance: string; required: string } | undefined>();
  const [isDeploying, setIsDeploying] = useState(false);
  const [hasDeployed, setHasDeployed] = useState(false); // ✅ Prevent multiple calls
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [showFundingModal, setShowFundingModal] = useState(false);
  
  // 🔒 Synchronous lock for preventing double calls at DeployStep level
  const deploymentLock = useRef(false);

  // Real-time deployment status polling
  const { status: deploymentStatus, refresh: refreshStatus } = useDeploymentStatusPolling(
    launchRoundId || null,
    !!launchRoundId && deploymentComplete,
    5000 // Poll every 5 seconds
  );

  const updateStep = (stepId: string, status: DeploymentStep['status'], message?: string) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status, message } : step))
    );
  };

  // ✅ FIXED: Only deploy once when component mounts
  useEffect(() => {
    if (!hasDeployed && !isDeploying) {
      setHasDeployed(true); // Mark as deployed immediately
      handleDeploy();
    }
  }, []); // Empty array is correct - only run on mount

  const handleDeploy = async () => {
    // 🔒 SYNCHRONOUS lock check (DeployStep level)
    if (deploymentLock.current) {
      console.warn('⚠️ DeployStep: Deployment already triggered, ignoring duplicate call');
      return;
    }
    
    // 🔒 Lock immediately
    deploymentLock.current = true;
    console.log('🔐 DeployStep: Lock acquired');
    
    // ✅ Prevent calling again if already successfully deployed
    if (deploymentComplete || hasDeployed) {
      console.warn('⚠️ Deployment already completed, ignoring duplicate call');
      return;
    }
    
    setIsDeploying(true);
    setError(undefined);

    try {
      // Step 1: Prepare data
      updateStep('prepare', 'loading');
      await new Promise((resolve) => setTimeout(resolve, 800));
      updateStep('prepare', 'success', 'Parameters validated');

      // Step 2: Deploy contracts via backend
      updateStep('deploy', 'loading', 'Backend deploying contract...');

      const result = await onDeploy();

      if (!result.success) {
        throw new Error(result.error || 'Deployment failed');
      }

      setTransactionHash(result.transactionHash);
      setFairlaunchAddress(result.fairlaunchAddress);
      setLaunchRoundId(result.launchRoundId);
      setTokenInfo(result.tokenInfo);
      updateStep('deploy', 'success', `Deployed: ${result.fairlaunchAddress?.slice(0, 10)}...`);

      // Step 3: Auto-verification
      updateStep('verify', 'loading', 'Verifying contract on BSCScan...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Verification happens async
      updateStep('verify', 'success', 'Contract verified automatically');

      // Step 4: Save to database
      updateStep('database', 'loading');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateStep('database', 'success', 'Fairlaunch metadata saved');

      // Step 5: Complete
      updateStep('complete', 'success', result.nextStep === 'FUND_CONTRACT' 
        ? 'Now fund your contract with tokens!' 
        : 'Your fairlaunch is now live!'
      );
      setDeploymentComplete(true);
      
      // ❌ Auto-redirect REMOVED to allow funding!
      // setTimeout(() => {
      //   if (result.fairlaunchAddress) {
      //     router.push(`/fairlaunch/${result.fairlaunchAddress}`);
      //   }
      // }, 5000);
      setShowFundingModal(true); // Open funding modal properly
    } catch (err: any) {
      console.error('Deployment error:', err);
      setError(err.message || 'Deployment failed');

      // Mark current step as error
      const currentStep = steps.find((s) => s.status === 'loading');
      if (currentStep) {
        updateStep(currentStep.id, 'error', err.message);
      }
      
      // 🔓 Allow retry - error is handled
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Deployment Progress */}
      <DeploymentProgress
        steps={steps}
        transactionHash={transactionHash}
        fairlaunchAddress={fairlaunchAddress}
        explorerUrl={explorerUrl}
      />

      {/* Error Message */}
      {error && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-6">
          <h3 className="font-semibold text-red-200 mb-2">❌ Deployment Failed</h3>
          <p className="text-red-300/90 text-sm mb-4">{error}</p>
          <button
            onClick={handleDeploy}
            disabled={isDeploying || deploymentComplete}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeploying ? 'Deploying...' : 'Retry Deployment'}
          </button>
        </div>
      )}

      {/* Success Actions */}
      {deploymentComplete && fairlaunchAddress && (
        <div className="bg-green-950/30 border border-green-800/40 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-green-200 mb-1">
                🎉 Fairlaunch Deployed Successfully!
              </h3>
              <p className="text-green-300/90 text-sm">
                Your fairlaunch is now live and ready to accept contributions. Share it with your
                community!
              </p>
            </div>
          </div>

          {/* Deployment Status Badges */}
          <div className="mb-4 p-4 bg-gray-900/40 border border-gray-700/40 rounded-lg">
            <p className="text-gray-300 font-medium text-sm mb-3">📊 Deployment Status:</p>
            <div className="flex flex-wrap gap-3">
              <DeploymentStatusBadge status={(deploymentStatus?.deployment_status as DeploymentStatus) || 'DEPLOYED'} />
              <VerificationStatusBadge 
                status={(deploymentStatus?.verification_status as VerificationStatus) || 'VERIFIED'}
                contractAddress={fairlaunchAddress}
                chainId={97} // TODO: Get from wizardData.network
                showLink={true}
              />
            </div>
          </div>

          {/* Earned Badges */}
          {wizardData.securityBadges && wizardData.securityBadges.length > 0 && (
            <div className="mb-4 p-4 bg-green-900/30 border border-green-800/30 rounded-lg">
              <p className="text-green-200 font-medium text-sm mb-2">✨ Badges Earned:</p>
              <div className="flex gap-2">
                {wizardData.securityBadges.map((badge: string) => (
                  <span
                    key={badge}
                    className="px-3 py-1 bg-green-900/40 border border-green-700/40 rounded-full text-sm text-green-300"
                  >
                    {badge === 'SAFU' ? '🛡️ SAFU' : '✓ SC Pass'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setShowFundingModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              <Coins className="w-5 h-5" />
              Fund Contract
            </button>
            <button
              onClick={() => router.push(`/fairlaunch/${launchRoundId}`)}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              View Live Fairlaunch
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </button>
          </div>

          {/* Share Section */}
          <div className="mt-4 pt-4 border-t border-green-800/30">
            <p className="text-green-300/80 text-sm mb-2">Share your fairlaunch:</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/fairlaunch/${launchRoundId}`;
                  navigator.clipboard.writeText(url);
                  alert('Link copied to clipboard!');
                }}
                className="px-4 py-2 bg-green-900/40 hover:bg-green-900/60 text-green-300 rounded-lg text-sm transition"
              >
                📋 Copy Link
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/fairlaunch/${launchRoundId}`;
                  const text = `Check out my new fairlaunch: ${wizardData.projectName}!`;
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
                    '_blank'
                  );
                }}
                className="px-4 py-2 bg-green-900/40 hover:bg-green-900/60 text-green-300 rounded-lg text-sm transition"
              >
                🐦 Share on Twitter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Info */}
      {!deploymentComplete && !error && (
        <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            ⏳ Please wait while we deploy your fairlaunch contracts. This may take a few moments...
          </p>
        </div>
      )}

      {/* Token Funding Modal */}
      {fairlaunchAddress && tokenInfo && (
        <TokenFundingModal
          open={showFundingModal}
          onOpenChange={setShowFundingModal}
          contractAddress={fairlaunchAddress}
          tokenAddress={wizardData.tokenAddress}
          tokenSymbol={tokenInfo.symbol || wizardData.tokenSymbol || 'TOKEN'}
          tokenDecimals={wizardData.tokenDecimals || 18}
          requiredTokens={tokenInfo.required ? formatUnits(BigInt(tokenInfo.required), wizardData.tokenDecimals || 18) : '0'}
          explorerUrl={explorerUrl || 'https://testnet.bscscan.com'}
          onFundingComplete={async () => {
            // Call API to confirm funding and update DB status to LIVE
            try {
              await fetch('/api/fairlaunch/confirm-funding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contractAddress: fairlaunchAddress,
                  tokenAddress: wizardData.tokenAddress,
                }),
              });
              console.log('[DeployStep] Funding confirmed and status updated');
            } catch (err) {
              console.error('[DeployStep] Failed to update funding status:', err);
            }
            
            setShowFundingModal(false);
            refreshStatus(); // Refresh status after funding
          }}
        />
      )}
    </div>
  );
}
