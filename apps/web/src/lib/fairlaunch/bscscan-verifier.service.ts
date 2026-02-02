/**
 * BSCScan Verification Service
 * 
 * Handles automatic contract verification on block explorers (BSCScan, Etherscan, etc.)
 * Uses Block Explorer API v2 for source code verification
 */

import axios, { AxiosError } from 'axios';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ethers } from 'ethers';
import type { FairlaunchConstructorArgs } from './params-builder';

export interface VerificationConfig {
  apiUrl: string;
  apiKey: string;
  explorerName: string;
}

export enum VerificationStatus {
  PENDING = 'Pending in queue',
  IN_PROGRESS = 'In progress', 
  SUCCESS = 'Pass - Verified',
  FAILED = 'Fail - Unable to verify',
  ALREADY_VERIFIED = 'Contract source code already verified',
  UNKNOWN = 'Unknown',
}

export interface VerificationResult {
  status: VerificationStatus;
  guid?: string;
  message?: string;
  error?: string;
}

export class BSCScanVerifierService {
  private config: VerificationConfig;
  private axiosInstance: any;

  constructor(chainId: number) {
    this.config = this.getVerificationConfig(chainId);
    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      timeout: 30000,
    });
  }

  /**
   * Get verification configuration for chain
   */
  private getVerificationConfig(chainId: number): VerificationConfig {
    const configs: Record<number, VerificationConfig> = {
      // BSC Testnet
      97: {
        apiUrl: 'https://api-testnet.bscscan.com/api',
        apiKey: process.env.BSCSCAN_API_KEY || '',
        explorerName: 'BSCScan Testnet',
      },
      // BSC Mainnet
      56: {
        apiUrl: 'https://api.bscscan.com/api',
        apiKey: process.env.BSCSCAN_API_KEY || '',
        explorerName: 'BSCScan',
      },
      // Ethereum Sepolia
      11155111: {
        apiUrl: 'https://api-sepolia.etherscan.io/api',
        apiKey: process.env.ETHERSCAN_API_KEY || '',
        explorerName: 'Etherscan Sepolia',
      },
      // Ethereum Mainnet
      1: {
        apiUrl: 'https://api.etherscan.io/api',
        apiKey: process.env.ETHERSCAN_API_KEY || '',
        explorerName: 'Etherscan',
      },
      // Base Sepolia
      84532: {
        apiUrl: 'https://api-sepolia.basescan.org/api',
        apiKey: process.env.BASESCAN_API_KEY || '',
        explorerName: 'BaseScan Sepolia',
      },
      // Base Mainnet
      8453: {
        apiUrl: 'https://api.basescan.org/api',
        apiKey: process.env.BASESCAN_API_KEY || '',
        explorerName: 'BaseScan',
      },
    };

    const config = configs[chainId];
    if (!config) {
      throw new Error(`No verification config for chain ID ${chainId}`);
    }

    if (!config.apiKey) {
      throw new Error(`No API key configured for ${config.explorerName}`);
    }

    return config;
  }

  /**
   * Submit contract for verification
   */
  async submitVerification(
    contractAddress: string,
    constructorArgs: FairlaunchConstructorArgs
  ): Promise<string> {
    try {
      console.log(`Submitting verification to ${this.config.explorerName}...`);
      console.log('Contract:', contractAddress);

      // 1. Get flattened source code
      const sourceCode = this.getFlattenedSource();

      // 2. Encode constructor arguments
      const encodedArgs = this.encodeConstructorArgs(constructorArgs);

      // 3. Submit to block explorer API
      // 3. Submit to block explorer API
      const params = new URLSearchParams();
      params.append('module', 'contract');
      params.append('action', 'verifysourcecode');
      params.append('contractaddress', contractAddress);
      params.append('sourceCode', sourceCode);
      params.append('codeformat', 'solidity-single-file');
      params.append('contractname', 'Fairlaunch');
      params.append('compilerversion', 'v0.8.20+commit.a1b79de6');
      params.append('optimizationUsed', '1');
      params.append('runs', '200');
      params.append('constructorArguements', encodedArgs);
      params.append('evmversion', 'paris'); // Explicitly set EVM version
      params.append('licenseType', '3');
      params.append('apikey', this.config.apiKey);

      const response = await this.axiosInstance.post('', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('API Response:', response.data);

      if (response.data.status !== '1') {
        throw new Error(`Verification submission failed: ${response.data.result}`);
      }

      const guid = response.data.result;
      console.log('✅ Verification submitted. GUID:', guid);

      return guid;
    } catch (error: any) {
      console.error('Error submitting verification:', error.response?.data || error.message);
      throw new Error(`Failed to submit verification: ${error.response?.data?.result || error.message}`);
    }
  }

  /**
   * Check verification status by GUID
   */
  async checkStatus(guid: string): Promise<VerificationStatus> {
    try {
      const response = await this.axiosInstance.get('', {
        params: {
          module: 'contract',
          action: 'checkverifystatus',
          guid: guid,
          apikey: this.config.apiKey,
        },
      });

      const result = response.data.result;
      console.log('Verification status:', result);

      // Map result string to enum
      if (result.includes('Pass')) return VerificationStatus.SUCCESS;
      if (result.includes('Pending')) return VerificationStatus.PENDING;
      if (result.includes('progress')) return VerificationStatus.IN_PROGRESS;
      if (result.includes('Fail')) return VerificationStatus.FAILED;
      if (result.includes('already verified')) return VerificationStatus.ALREADY_VERIFIED;

      return VerificationStatus.UNKNOWN;
    } catch (error: any) {
      console.error('Error checking verification status:', error.message);
      throw new Error(`Failed to check verification status: ${error.message}`);
    }
  }

  /**
   * Wait for verification to complete (with polling)
   */
  async waitForVerification(guid: string, maxAttempts: number = 20): Promise<boolean> {
    const delayMs = 3000; // 3 seconds between checks

    console.log(`Waiting for verification (max ${maxAttempts} attempts)...`);

    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.checkStatus(guid);

      if (status === VerificationStatus.SUCCESS || status === VerificationStatus.ALREADY_VERIFIED) {
        console.log('✅ Contract verified successfully!');
        return true;
      }

      if (status === VerificationStatus.FAILED) {
        console.log('❌ Verification failed');
        return false;
      }

      console.log(`Attempt ${i + 1}/${maxAttempts}: ${status}. Waiting ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    console.log('⏱️ Verification timeout - still pending');
    return false;
  }

  /**
   * Verify contract (submit + wait)
   */
  async verifyContract(
    contractAddress: string,
    constructorArgs: FairlaunchConstructorArgs
  ): Promise<VerificationResult> {
    try {
      // Submit verification
      const guid = await this.submitVerification(contractAddress, constructorArgs);

      // Wait for completion
      const success = await this.waitForVerification(guid);

      if (success) {
        return {
          status: VerificationStatus.SUCCESS,
          guid,
          message: `Contract verified on ${this.config.explorerName}`,
        };
      } else {
        return {
          status: VerificationStatus.FAILED,
          guid,
          error: 'Verification failed or timed out',
        };
      }
    } catch (error: any) {
      return {
        status: VerificationStatus.FAILED,
        error: error.message,
      };
    }
  }

  /**
   * Check if contract is already verified
   */
  async isVerified(contractAddress: string): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('', {
        params: {
          module: 'contract',
          action: 'getsourcecode',
          address: contractAddress,
          apikey: this.config.apiKey,
        },
      });

      const result = response.data.result;
      if (Array.isArray(result) && result.length > 0) {
        return result[0].SourceCode !== '';
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get flattened Fairlaunch source code
   */
  private getFlattenedSource(): string {
    const flattenedPath = join(
      process.cwd(),
      '../../packages/contracts/Fairlaunch_flattened.sol'
    );

    console.log('[Verifier] resolving flattened source from:', flattenedPath);

    try {
      return readFileSync(flattenedPath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read flattened source: ${error}`);
    }
  }

  /**
   * Encode constructor arguments for verification
   */
  private encodeConstructorArgs(args: FairlaunchConstructorArgs): string {
    const types = [
      'address',
      'address',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint16',
      'address',
      'address',
      'address',
      'address',
      'uint256',
      'uint256',
      'bytes32',
    ];

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(types, args);
    return encoded.slice(2); // Remove '0x' prefix
  }
}
