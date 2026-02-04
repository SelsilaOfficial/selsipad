/**
 * Contract Verification Service
 * Handles automatic verification of deployed contracts on BSCScan/Etherscan
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export type VerificationStatus = 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED';

export interface VerificationResult {
  success: boolean;
  status: VerificationStatus;
  output?: string;
  error?: string;
}

export interface VerificationRequest {
  contractAddress: string;
  constructorArgs: any[];
  network: 'bscTestnet' | 'bsc' | 'sepolia' | 'ethereum' | 'baseSepolia' | 'base';
  contractPath?: string; // Optional, default: auto-detect
}

/**
 * Verify a contract on block explorer using Hardhat
 */
export async function verifyContract(
  request: VerificationRequest
): Promise<VerificationResult> {
  const { contractAddress, constructorArgs, network, contractPath } = request;

  try {
    console.log(`[Verification] Starting verification for ${contractAddress} on ${network}`);

    // Create temp file for constructor args
    const argsFilePath = path.join('/tmp', `verify-args-${contractAddress}.js`);
    const argsContent = `module.exports = ${JSON.stringify(constructorArgs, null, 2)};`;
    
    await fs.writeFile(argsFilePath, argsContent);

    // Build Hardhat verify command
    const contractsDir = path.join(process.cwd(), '../../packages/contracts');
    let command = `cd ${contractsDir} && npx hardhat verify --network ${network} --constructor-args ${argsFilePath} ${contractAddress}`;

    if (contractPath) {
      command += ` --contract ${contractPath}`;
    }

    console.log(`[Verification] Executing: ${command}`);

    // Execute Hardhat verify
    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000, // 2 minutes timeout
    });

    // Clean up temp file
    await fs.unlink(argsFilePath).catch(() => {});

    const output = stdout + stderr;
    console.log(`[Verification] Output:`, output);

    // Check if verification was successful
    if (
      output.includes('Successfully verified') ||
      output.includes('Already verified') ||
      output.includes('Already Verified')
    ) {
      return {
        success: true,
        status: 'VERIFIED',
        output,
      };
    } else if (stderr && stderr.includes('Error')) {
      return {
        success: false,
        status: 'FAILED',
        error: stderr,
        output,
      };
    } else {
      return {
        success: false,
        status: 'FAILED',
        error: 'Unknown verification result',
        output,
      };
    }
  } catch (error: any) {
    console.error(`[Verification] Error verifying ${contractAddress}:`, error);

    // Clean up temp file on error
    try {
      const argsFilePath = path.join('/tmp', `verify-args-${contractAddress}.js`);
      await fs.unlink(argsFilePath).catch(() => {});
    } catch {}

    return {
      success: false,
      status: 'FAILED',
      error: error.message || 'Verification failed',
    };
  }
}

/**
 * Verify with retry mechanism
 */
export async function verifyContractWithRetry(
  request: VerificationRequest,
  maxAttempts: number = 3
): Promise<VerificationResult> {
  let lastResult: VerificationResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Verification] Attempt ${attempt}/${maxAttempts} for ${request.contractAddress}`);

    const result = await verifyContract(request);

    if (result.success) {
      return result;
    }

    lastResult = result;

    // Don't retry if verification already exists
    if (result.output?.includes('Already verified') || result.output?.includes('Already Verified')) {
      result.success = true;
      result.status = 'VERIFIED';
      return result;
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxAttempts) {
      const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.log(`[Verification] Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  return lastResult!;
}

/**
 * Get network name from chain ID
 */
export function getNetworkFromChainId(chainId: number): VerificationRequest['network'] {
  switch (chainId) {
    case 97:
      return 'bscTestnet';
    case 56:
      return 'bsc';
    case 11155111:
      return 'sepolia';
    case 1:
      return 'ethereum';
    case 84532:
      return 'baseSepolia';
    case 8453:
      return 'base';
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}
