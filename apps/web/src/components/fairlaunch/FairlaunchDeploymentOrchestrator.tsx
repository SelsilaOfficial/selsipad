'use client';

import * as React from 'react';

import { type Address } from 'viem';

export interface FairlaunchDeploymentOrchestratorProps {
  wizardData: any;
  onDeploymentStart?: () => void;
  onDeploymentComplete?: (result: {
    success: boolean;
    launchRoundId?: string;
    contractAddress?: Address;
    transactionHash?: string;
    nextStep?: string;
    error?: string;
    tokenInfo?: {
      symbol: string;
      balance: string;
      required: string;
    };
  }) => void;
  children: (deployFn: () => Promise<any>) => React.ReactNode;
}

/**
 * Orchestrates Fairlaunch deployment via backend API
 * New architecture: Direct deployment (no Factory, auto-verified)
 */
export function FairlaunchDeploymentOrchestrator({
  wizardData,
  onDeploymentStart,
  onDeploymentComplete,
  children,
}: FairlaunchDeploymentOrchestratorProps) {

  const [isDeploying, setIsDeploying] = React.useState(false);

  /**
   * Main deployment function - calls backend API
   */
  const handleDeploy = async (): Promise<{
    success: boolean;
    launchRoundId?: string;
    contractAddress?: string;
    transactionHash?: string;
    error?: string;
  }> => {
    try {
      setIsDeploying(true);
      onDeploymentStart?.();

      // Get auth token from Supabase
      // We assume supabase client is available or we use the browser client
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
         throw new Error('Not authenticated. Please sign in.');
      }

      const token = session.access_token;

      // Prepare deployment payload
      const deployPayload = {
        // Token configuration
        projectToken: wizardData.tokenAddress,
        tokenDecimals: wizardData.tokenDecimals || 18,
        
        // Sale parameters
        softcap: wizardData.softcap,
        tokensForSale: wizardData.tokensForSale,
        minContribution: wizardData.minContribution,
        maxContribution: wizardData.maxContribution,
        
        // Timing
        startTime: wizardData.startTime,
        endTime: wizardData.endTime,
        
        // Liquidity settings
        liquidityPercent: wizardData.liquidityPercent || 70,
        lpLockMonths: wizardData.lpLockMonths || 24,
        listingPremiumBps: wizardData.listingPremiumBps || 0,
        dexPlatform: wizardData.dexPlatform || 'PancakeSwap',
        
        // Team vesting
        teamVestingAddress: wizardData.vestingAddress || null,
        
        // Creator and network
        creatorWallet: wizardData.account,
        chainId: wizardData.chainId || 97,
      };

      console.log('[Orchestrator] Deploying via API:', deployPayload);

      // Call backend deployment API
      const response = await fetch('/api/fairlaunch/deploy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deployPayload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details?.join(', ') || 'Deployment failed');
      }

      console.log('[Orchestrator] Deployment successful:', data);

      // Notify completion
      const result = {
        success: true,
        launchRoundId: data.launchRoundId,
        contractAddress: data.contractAddress as Address,
        transactionHash: data.txHash,
        nextStep: data.nextStep,
        tokenInfo: data.tokenInfo,
      };

      onDeploymentComplete?.(result);

      return result;
    } catch (error: any) {
      console.error('[Orchestrator] Deployment error:', error);
      
      const errorResult = {
        success: false,
        error: error.message || 'Deployment failed',
      };

      onDeploymentComplete?.(errorResult);

      return errorResult;
    } finally {
      setIsDeploying(false);
    }
  };

  return <>{children(handleDeploy)}</>;
}
