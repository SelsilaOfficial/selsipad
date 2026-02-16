/**
 * Fairlaunch Deployer Service
 *
 * Handles direct deployment of Fairlaunch contracts with automatic verification
 */

import { ethers } from 'ethers';
import { DeployerWallet } from '../web3/deployer-wallet';
import {
  FairlaunchDeployParams,
  FairlaunchConstructorArgs,
  FairlaunchParamsBuilder,
} from './params-builder';

// Import contract artifacts
import FairlaunchArtifact from '../../../../../packages/contracts/artifacts/contracts/fairlaunch/Fairlaunch.sol/Fairlaunch.json';

export interface DeploymentResult {
  success: boolean;
  contractAddress: string;
  txHash: string;
  blockNumber: number;
  deployedAt: Date;
  gasUsed: string;
  constructorArgs: FairlaunchConstructorArgs;
  error?: string;
}

export interface DeploymentStatus {
  status: 'pending' | 'deploying' | 'deployed' | 'failed';
  txHash?: string;
  contractAddress?: string;
  error?: string;
}

export class FairlaunchDeployerService {
  private deployerWallet: DeployerWallet;
  private contractFactory: ethers.ContractFactory;
  private lastConstructorArgs: FairlaunchConstructorArgs | null = null;

  constructor(chainId: number) {
    this.deployerWallet = new DeployerWallet(chainId);

    // Create contract factory from artifacts
    this.contractFactory = new ethers.ContractFactory(
      FairlaunchArtifact.abi,
      FairlaunchArtifact.bytecode,
      this.deployerWallet.getWallet()
    );
  }

  /**
   * Deploy Fairlaunch contract
   */
  async deploy(params: FairlaunchDeployParams): Promise<DeploymentResult> {
    try {
      // 1. Validate parameters
      const validation = FairlaunchParamsBuilder.validateParams(params);
      if (!validation.valid) {
        throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
      }

      // 2. Build constructor arguments
      const constructorArgs = FairlaunchParamsBuilder.buildConstructorArgs(params);
      this.lastConstructorArgs = constructorArgs;

      // 3. Estimate gas
      const gasEstimate = await this.estimateGas(constructorArgs);

      // 4. Check deployer balance
      const hasBalance = await this.deployerWallet.validateBalance(gasEstimate);
      if (!hasBalance) {
        const balance = await this.deployerWallet.getBalance();
        throw new Error(
          `Insufficient deployer balance. Has: ${ethers.formatEther(balance)} ETH, ` +
            `Needs: ${ethers.formatEther((gasEstimate * BigInt(120)) / BigInt(100))}`
        );
      }

      // 5. Deploy contract
      console.log('Deploying Fairlaunch contract...');
      console.log('Constructor args:', constructorArgs);

      const fairlaunch = await this.contractFactory.deploy(...constructorArgs);

      // 6. Wait for deployment transaction
      const deploymentTx = fairlaunch.deploymentTransaction();
      if (!deploymentTx) {
        throw new Error('No deployment transaction');
      }

      console.log('Deployment TX:', deploymentTx.hash);
      console.log('Waiting for confirmation...');

      const receipt = await deploymentTx.wait();
      if (!receipt) {
        throw new Error('No deployment receipt');
      }

      const contractAddress = await fairlaunch.getAddress();

      console.log('✅ Contract deployed:', contractAddress);
      console.log('Block:', receipt.blockNumber);
      console.log('Gas used:', receipt.gasUsed.toString());

      // 7. Grant admin role to creator (optional - constructor already does this)
      // const adminRole = await fairlaunch.ADMIN_ROLE();
      // const hasRole = await fairlaunch.hasRole(adminRole, params.creatorWallet);
      // if (!hasRole) {
      //   const grantTx = await fairlaunch.grantRole(adminRole, params.creatorWallet);
      //   await grantTx.wait();
      //   console.log('✅ Admin role granted to creator');
      // }

      return {
        success: true,
        contractAddress,
        txHash: deploymentTx.hash,
        blockNumber: receipt.blockNumber,
        deployedAt: new Date(),
        gasUsed: receipt.gasUsed.toString(),
        constructorArgs,
      };
    } catch (error: any) {
      console.error('Deployment failed:', error);

      return {
        success: false,
        contractAddress: '',
        txHash: '',
        blockNumber: 0,
        deployedAt: new Date(),
        gasUsed: '0',
        constructorArgs: this.lastConstructorArgs || ([] as any),
        error: error.message || 'Unknown deployment error',
      };
    }
  }

  /**
   * Estimate gas for deployment
   */
  async estimateGas(constructorArgs: FairlaunchConstructorArgs): Promise<bigint> {
    try {
      const deployTx = await this.contractFactory.getDeployTransaction(...constructorArgs);
      const provider = this.deployerWallet.getProvider();
      const gasEstimate = await provider.estimateGas(deployTx);

      console.log('Estimated gas:', gasEstimate.toString());

      return gasEstimate;
    } catch (error: any) {
      console.error('Gas estimation failed:', error);
      // Fallback to a safe default (5M gas)
      return BigInt(5_000_000);
    }
  }

  /**
   * Get deployment status by transaction hash
   */
  async getDeploymentStatus(txHash: string): Promise<DeploymentStatus> {
    try {
      const provider = this.deployerWallet.getProvider();
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        // Transaction not yet mined
        return {
          status: 'deploying',
          txHash,
        };
      }

      if (receipt.status === 0) {
        // Transaction failed
        return {
          status: 'failed',
          txHash,
          error: 'Transaction reverted',
        };
      }

      // Transaction succeeded - extract contract address
      const contractAddress = receipt.contractAddress;
      if (!contractAddress) {
        return {
          status: 'failed',
          txHash,
          error: 'No contract address in receipt',
        };
      }

      return {
        status: 'deployed',
        txHash,
        contractAddress,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        txHash,
        error: error.message,
      };
    }
  }

  /**
   * Get last constructor arguments used
   */
  getLastConstructorArgs(): FairlaunchConstructorArgs | null {
    return this.lastConstructorArgs;
  }

  /**
   * Get deployer wallet address
   */
  getDeployerAddress(): string {
    return this.deployerWallet.address;
  }

  /**
   * Check if contract is deployed at address
   */
  async isContractDeployed(address: string): Promise<boolean> {
    try {
      const provider = this.deployerWallet.getProvider();
      const code = await provider.getCode(address);
      return code !== '0x';
    } catch {
      return false;
    }
  }

  /**
   * Get contract instance for deployed Fairlaunch
   */
  getContractInstance(address: string): ethers.Contract {
    return new ethers.Contract(address, FairlaunchArtifact.abi, this.deployerWallet.getProvider());
  }
}
