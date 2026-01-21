/**
 * Chain Switching Utilities
 * Detect current chain and switch wallet network
 */

export type SupportedChain = 'BSC' | 'ETHEREUM' | 'POLYGON' | 'ARBITRUM' | 'SOLANA';

interface ChainConfig {
  chainId: string; // Hex for EVM, 'solana' for Solana
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  BSC: {
    chainId: '0x38', // 56
    chainName: 'BNB Smart Chain',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  ETHEREUM: {
    chainId: '0x1', // 1
    chainName: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://eth.llamarpc.com'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  POLYGON: {
    chainId: '0x89', // 137
    chainName: 'Polygon Mainnet',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  ARBITRUM: {
    chainId: '0xa4b1', // 42161
    chainName: 'Arbitrum One',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
};

/**
 * Get current chain ID from wallet (EVM only)
 */
export async function getCurrentChainId(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }

  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return chainId;
  } catch (error) {
    console.error('Error getting chain ID:', error);
    return null;
  }
}

/**
 * Get chain name from chainId
 */
export function getChainName(chainId: string): string {
  const chain = Object.entries(CHAIN_CONFIGS).find(([_, config]) => config.chainId === chainId);
  return chain ? chain[0] : 'UNKNOWN';
}

/**
 * Check if user is on correct chain
 */
export async function isOnCorrectChain(targetChain: string): Promise<boolean> {
  if (targetChain === 'SOLANA') {
    // For Solana, check if Phantom/Solflare is connected
    return typeof window !== 'undefined' && (window.solana?.isConnected || false);
  }

  const currentChainId = await getCurrentChainId();
  const targetConfig = CHAIN_CONFIGS[targetChain];

  if (!currentChainId || !targetConfig) {
    return false;
  }

  return currentChainId.toLowerCase() === targetConfig.chainId.toLowerCase();
}

/**
 * Switch to target chain (EVM only)
 */
export async function switchToChain(targetChain: string): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet detected');
  }

  if (targetChain === 'SOLANA') {
    throw new Error('Solana switching not supported via EVM wallet');
  }

  const config = CHAIN_CONFIGS[targetChain];
  if (!config) {
    throw new Error(`Unsupported chain: ${targetChain}`);
  }

  try {
    // Try to switch to the chain
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.chainId }],
    });
    return true;
  } catch (switchError: any) {
    // Chain not added to wallet, try to add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: config.chainId,
              chainName: config.chainName,
              nativeCurrency: config.nativeCurrency,
              rpcUrls: config.rpcUrls,
              blockExplorerUrls: config.blockExplorerUrls,
            },
          ],
        });
        return true;
      } catch (addError) {
        console.error('Error adding chain:', addError);
        throw new Error('Failed to add chain to wallet');
      }
    }

    console.error('Error switching chain:', switchError);
    throw new Error('Failed to switch chain');
  }
}

/**
 * Prompt user to switch chain
 * Returns true if switched, false if cancelled
 */
export async function promptChainSwitch(
  targetChain: string,
  reason: string = 'continue'
): Promise<boolean> {
  const config = CHAIN_CONFIGS[targetChain];
  if (!config) {
    throw new Error(`Unsupported chain: ${targetChain}`);
  }

  const confirmed = confirm(
    `This action requires ${config.chainName}.\n\nWould you like to switch networks to ${reason}?`
  );

  if (!confirmed) {
    return false;
  }

  await switchToChain(targetChain);
  return true;
}

/**
 * Ensure user is on correct chain before executing action
 * Wrapper function for chain-specific actions
 */
export async function withChainCheck<T>(
  targetChain: string,
  action: () => Promise<T>,
  actionName: string = 'perform this action'
): Promise<T> {
  const isCorrect = await isOnCorrectChain(targetChain);

  if (!isCorrect) {
    const switched = await promptChainSwitch(targetChain, actionName);
    if (!switched) {
      throw new Error('User cancelled chain switch');
    }
  }

  return action();
}
