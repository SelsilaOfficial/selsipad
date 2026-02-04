/**
 * DEX Configuration for Fairlaunch
 * Maps DEX platform names to bytes32 IDs used by smart contracts
 */

import { keccak256, toHex, zeroAddress } from 'viem';

// DEX identifier mapping (keccak256 hash)
// Using viem equivalents for ethers.id
export const DEX_IDS = {
  'Uniswap': keccak256(toHex('UNISWAP')),           // Ethereum/Sepolia
  'PancakeSwap': keccak256(toHex('PANCAKESWAP')),   // BSC/BSC Testnet
  'BaseSwap': keccak256(toHex('BASESWAP')),         // Base/Base Sepolia
  'Raydium': keccak256(toHex('RAYDIUM')),           // Solana (not used for EVM)
} as const;

export type DexPlatform = keyof typeof DEX_IDS;

/**
 * Convert DEX platform name to bytes32 ID for smart contract
 */
export function getDexId(platform: string): string {
  const dexId = DEX_IDS[platform as DexPlatform];
  
  if (!dexId) {
    // Fallback: hash the platform name
    return keccak256(toHex(platform.toUpperCase()));
  }
  
  return dexId;
}

/**
 * Get available DEX platforms for a specific network
 */
export function getAvailableDexForNetwork(network: string): Array<{
  id: string;
  name: string;
  logo?: string;
}> {
  const mapping: Record<string, typeof dexOptions> = {
    ethereum: [
      { id: 'Uniswap', name: 'Uniswap V2' },
    ],
    sepolia: [
      { id: 'Uniswap', name: 'Uniswap V2' },
    ],
    bnb: [
      { id: 'PancakeSwap', name: 'PancakeSwap V2' },
    ],
    bsc_testnet: [
      { id: 'PancakeSwap', name: 'PancakeSwap V2' },
    ],
    base: [
      { id: 'BaseSwap', name: 'BaseSwap' },
      { id: 'Uniswap', name: 'Uniswap V3' },
    ],
    base_sepolia: [
      { id: 'BaseSwap', name: 'BaseSwap' },
      { id: 'Uniswap', name: 'Uniswap V3' },
    ],
    localhost: [
      { id: 'Uniswap', name: 'Uniswap V2 (Local)' },
    ],
  };

  const dexOptions = [
    { id: 'Uniswap', name: 'Uniswap V2' },
    { id: 'PancakeSwap', name: 'PancakeSwap V2' },
    { id: 'BaseSwap', name: 'BaseSwap' },
  ];

  return mapping[network] || [{ id: 'Uniswap', name: 'Uniswap V2' }];
}

/**
 * Get DEX router address for network
 * Note: This should match the router configured in FairlaunchFactory
 */
export function getDexRouterAddress(network: string, dexPlatform: string): string {
  // Router addresses per network
  const routers: Record<string, Record<string, string>> = {
    ethereum: {
      'Uniswap': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    sepolia: {
      'Uniswap': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    bnb: {
      'PancakeSwap': '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    },
    bsc_testnet: {
      'PancakeSwap': '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
    },
    base: {
      'BaseSwap': '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86',
      'Uniswap': '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
    },
    base_sepolia: {
      'BaseSwap': '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86', // Example
      'Uniswap': '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
    },
  };

  return routers[network]?.[dexPlatform] || zeroAddress;
}
