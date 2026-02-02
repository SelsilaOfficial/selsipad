import * as React from 'react';
import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, decodeEventLog, type Address } from 'viem';
import {
  FAIRLAUNCH_FACTORY_ADDRESS,
  FAIRLAUNCH_FACTORY_ABI,
  DEPLOYMENT_FEE,
} from '@/contracts/FairlaunchFactory';

export interface DeploymentParams {
  // CreateFairlaunchParams
  projectToken: Address;
  paymentToken: Address; // address(0) for native
  softcap: bigint;
  tokensForSale: bigint;
  minContribution: bigint;
  maxContribution: bigint;
  startTime: bigint;
  endTime: bigint;
  projectOwner: Address;
  listingPremiumBps: number;
  
  // TeamVestingParams
  vestingBeneficiary: Address;
  vestingStartTime: bigint;
  vestingDurations: bigint[];
  vestingAmounts: bigint[];
  
  // LPLockPlan
  lockMonths: bigint;
  liquidityPercent: bigint;
  dexId: `0x${string}`;
}

export interface DeploymentResult {
  success: boolean;
  fairlaunchAddress?: Address;
  vestingAddress?: Address;
  transactionHash?: `0x${string}`;
  fairlaunchId?: bigint;
  error?: string;
}

/**
 * Hook for deploying Fairlaunch contract via FairlaunchFactory
 */
export function useFairlaunchDeploy(chainId: number) {
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  
  const factoryAddress = FAIRLAUNCH_FACTORY_ADDRESS[chainId];
  const deploymentFee = DEPLOYMENT_FEE[chainId];

  const { writeContract, data: hash, isPending: isWriting, error: writeError, reset: resetWrite } = useWriteContract();

  const {
    data: receipt,
    isLoading: isWaiting,
    error: waitError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * Deploy fairlaunch with prepared parameters
   */
  const deploy = async (params: DeploymentParams): Promise<DeploymentResult> => {
    try {
      if (!factoryAddress) {
        throw new Error(`Factory address not found for chain ID ${chainId}`);
      }

      // Prepare contract arguments
      const createParams = {
        projectToken: params.projectToken,
        paymentToken: params.paymentToken,
        softcap: params.softcap,
        tokensForSale: params.tokensForSale,
        minContribution: params.minContribution,
        maxContribution: params.maxContribution,
        startTime: params.startTime,
        endTime: params.endTime,
        projectOwner: params.projectOwner,
        listingPremiumBps: params.listingPremiumBps,
      };

      const vestingParams = {
        beneficiary: params.vestingBeneficiary,
        startTime: params.vestingStartTime,
        durations: params.vestingDurations,
        amounts: params.vestingAmounts,
      };

      const lpPlan = {
        lockMonths: params.lockMonths,
        liquidityPercent: params.liquidityPercent,
        dexId: params.dexId,
      };

      // Call createFairlaunch with deployment fee
      writeContract({
        address: factoryAddress,
        abi: FAIRLAUNCH_FACTORY_ABI,
        functionName: 'createFairlaunch',
        args: [createParams, vestingParams, lpPlan],
        value: deploymentFee,
      });

      // Wait for transaction to be written
      // Note: actual parsing happens in useEffect below
      return {
        success: false, // Will be updated when receipt arrives
      };
    } catch (error: any) {
      const result: DeploymentResult = {
        success: false,
        error: error.message || 'Deployment failed',
      };
      setDeploymentResult(result);
      return result;
    }
  };

  // Parse transaction receipt when available
  React.useEffect(() => {
    if (receipt && receipt.logs) {
      try {
        // Find FairlaunchCreated event
        // We iterate specifically to look for the event
        let fairlaunchCreatedLog;
        
        for (const log of receipt.logs) {
          try {
             // Try decoding log
             const decoded = decodeEventLog({
              abi: FAIRLAUNCH_FACTORY_ABI,
              data: log.data,
              topics: log.topics,
            });
            
            if (decoded.eventName === 'FairlaunchCreated') {
              fairlaunchCreatedLog = {...log, decoded};
              break;
            }
          } catch {
            // Ignore logs that don't match
            continue;
          }
        }

        if (fairlaunchCreatedLog && fairlaunchCreatedLog.decoded) {
          const args = fairlaunchCreatedLog.decoded.args as {
              fairlaunchId: bigint;
              fairlaunch: Address;
              vesting: Address;
              projectToken: Address;
            };

          const result: DeploymentResult = {
            success: true,
            fairlaunchAddress: args.fairlaunch,
            vestingAddress: args.vesting,
            transactionHash: receipt.transactionHash,
            fairlaunchId: args.fairlaunchId,
          };

          setDeploymentResult(result);
        } else {
           // Fallback if we can't find the event but TX succeeded
           if (receipt.status === 'success') {
             // Maybe we shouldn't error out if we can't find logs but TX passed?
             // But we need the address.
             setDeploymentResult({
               success: false,
               error: 'FairlaunchCreated event not found in transaction logs',
             });
           } else {
             setDeploymentResult({
               success: false,
               error: 'Transaction reverted',
             });
           }
        }
      } catch (error: any) {
        setDeploymentResult({
          success: false,
          error: `Failed to parse transaction logs: ${error.message}`,
        });
      }
    }
  }, [receipt]);

  // Handle errors
  React.useEffect(() => {
    if (writeError || waitError) {
      console.error('Deployment error:', writeError || waitError);
      setDeploymentResult({
        success: false,
        error: writeError?.message || waitError?.message || 'Transaction failed',
      });
    }
  }, [writeError, waitError]);

  return {
    deploy,
    isLoading: isWriting || isWaiting,
    result: deploymentResult,
    transactionHash: hash,
    reset: () => {
      setDeploymentResult(null);
      resetWrite();
    },
  };
}

