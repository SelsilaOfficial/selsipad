/**
 * Deployer Wallet Configuration
 *
 * Manages the hot wallet used for deploying contracts on-chain.
 * Supports multi-network key resolution:
 *   - DEPLOYER_PRIVATE_KEY_MAINNET → used for mainnets (BSC 56, ETH 1, Base 8453)
 *   - DEPLOYER_PRIVATE_KEY_TESTNET → used for testnets (BSC 97, Sepolia, Base Sepolia)
 *   - DEPLOYER_PRIVATE_KEY         → legacy fallback (used if per-network keys not set)
 *
 * This wallet:
 * - Has minimal funds (for gas only)
 * - Only deploys contracts
 * - Never controls user funds
 * - Rotated keys regularly
 */

import { ethers } from 'ethers';

/** Mainnet chain IDs */
const MAINNET_CHAINS = [56, 1, 8453]; // BSC, ETH, Base

export interface DeployerWalletConfig {
  privateKey: string;
  address: string;
  chainId: number;
}

/**
 * Resolve the correct deployer private key for a given chain.
 * Priority:
 *   1. DEPLOYER_PRIVATE_KEY_MAINNET / DEPLOYER_PRIVATE_KEY_TESTNET (per-network)
 *   2. DEPLOYER_PRIVATE_KEY (legacy fallback)
 *
 * @param chainId - The target chain ID
 * @returns The private key string
 * @throws Error if no valid key is found
 */
export function getDeployerPrivateKey(chainId: number): string {
  const isMainnet = MAINNET_CHAINS.includes(chainId);

  // Try per-network key first
  const networkKey = isMainnet
    ? process.env.DEPLOYER_PRIVATE_KEY_MAINNET
    : process.env.DEPLOYER_PRIVATE_KEY_TESTNET;

  // Fallback to legacy single key
  const privateKey = networkKey || process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey || privateKey.length < 64) {
    const envName = isMainnet ? 'DEPLOYER_PRIVATE_KEY_MAINNET' : 'DEPLOYER_PRIVATE_KEY_TESTNET';
    throw new Error(
      `No valid deployer private key found for chain ${chainId}. ` +
        `Set ${envName} or DEPLOYER_PRIVATE_KEY in environment.`
    );
  }

  return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
}

export class DeployerWallet {
  private wallet: ethers.Wallet;
  private provider: ethers.Provider;
  public readonly chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;

    // Get private key for this specific chain (mainnet vs testnet)
    const privateKey = getDeployerPrivateKey(chainId);

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
    const required = (estimatedGas * BigInt(120)) / BigInt(100); // 20% buffer
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
    const configs: Record<
      number,
      {
        name: string;
        currency: string;
        feeSplitter: string;
        platformAdmin: string;
        explorerUrl: string;
      }
    > = {
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
        feeSplitter: '0x5f3cf3D4fD540EFb2eEDA43921292fD08608518D',
        platformAdmin: '0x95D94D86CfC550897d2b80672a3c94c12429a90D',
        explorerUrl: 'https://sepolia.etherscan.io',
      },
      84532: {
        name: 'Base Sepolia',
        currency: 'ETH',
        feeSplitter: '0x069b5487A3CAbD868B498c34DA2d7cCfc2D3Dc4C',
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
