/**
 * Deployer Wallet Configuration
 * 
 * Manages the hot wallet used for deploying Fairlaunch contracts.
 * This wallet:
 * - Has minimal funds (for gas only)
 * - Only deploys contracts
 * - Never controls user funds
 * - Rotated keys regularly
 */

import { ethers } from 'ethers';

export interface DeployerWalletConfig {
  privateKey: string;
  address: string;
  chainId: number;
}

export class DeployerWallet {
  private wallet: ethers.Wallet;
  private provider: ethers.Provider;
  public readonly chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;

    // Get private key from environment
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey || privateKey.length !== 66) {
      throw new Error('Invalid DEPLOYER_PRIVATE_KEY in environment');
    }

    // Get RPC URL for chain
    const rpcUrl = this.getRpcUrl(chainId);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Create wallet instance
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  /**
   * Get the deployer wallet address
   */
  get address(): string {
    return this.wallet.address;
  }

  /**
   * Get the ethers Wallet instance
   */
  getWallet(): ethers.Wallet {
    return this.wallet;
  }

  /**
   * Get the provider instance
   */
  getProvider(): ethers.Provider {
    return this.provider;
  }

  /**
   * Check deployer wallet balance
   */
  async getBalance(): Promise<bigint> {
    return await this.provider.getBalance(this.wallet.address);
  }

  /**
   * Validate wallet has sufficient balance for deployment
   */
  async validateBalance(estimatedGas: bigint): Promise<boolean> {
    const balance = await this.getBalance();
    const required = estimatedGas * BigInt(120) / BigInt(100); // 20% buffer
    return balance >= required;
  }

  /**
   * Get RPC URL for chain ID
   */
  private getRpcUrl(chainId: number): string {
    const rpcUrls: Record<number, string> = {
      // BSC Testnet
      97: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
      // BSC Mainnet
      56: process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed1.binance.org',
      // Sepolia
      11155111: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
      // Ethereum Mainnet
      1: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      // Base Sepolia
      84532: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      // Base Mainnet
      8453: process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
    };

    const rpcUrl = rpcUrls[chainId];
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for chain ID ${chainId}`);
    }

    return rpcUrl;
  }

  /**
   * Get network configuration for chain
   */
  static getNetworkConfig(chainId: number) {
    const configs: Record<number, {
      name: string;
      currency: string;
      feeSplitter: string;
      platformAdmin: string;
      explorerUrl: string;
    }> = {
      97: {
        name: 'BSC Testnet',
        currency: 'tBNB',
        feeSplitter: '0x2672af17eA89bc5e46BB52385C45Cb42e5eC8C48',
        platformAdmin: '0x95D94D86CfC550897d2b80672a3c94c12429a90D',
        explorerUrl: 'https://testnet.bscscan.com',
      },
      56: {
        name: 'BSC Mainnet',
        currency: 'BNB',
        feeSplitter: '0x0000000000000000000000000000000000000000', // TODO: Deploy
        platformAdmin: '0x0000000000000000000000000000000000000000', // TODO: Set
        explorerUrl: 'https://bscscan.com',
      },
      11155111: {
        name: 'Sepolia',
        currency: 'SepoliaETH',
        feeSplitter: '0x99470899b8C0e229d79ad0c96619210CbDD07755',
        platformAdmin: '0x95D94D86CfC550897d2b80672a3c94c12429a90D',
        explorerUrl: 'https://sepolia.etherscan.io',
      },
      84532: {
        name: 'Base Sepolia',
        currency: 'ETH',
        feeSplitter: '0x99470899b8C0e229d79ad0c96619210CbDD07755',
        platformAdmin: '0x95D94D86CfC550897d2b80672a3c94c12429a90D',
        explorerUrl: 'https://sepolia.basescan.org',
      },
    };

    const config = configs[chainId];
    if (!config) {
      throw new Error(`No network configuration for chain ID ${chainId}`);
    }

    return config;
  }
}
