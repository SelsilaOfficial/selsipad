/**
 * Contract addresses and chain utilities for Selsipad
 */

// Chain ID mapping by network name
const CHAIN_IDS: Record<string, number> = {
  bnb: 97, // BSC Testnet
  ethereum: 11155111, // Sepolia
  base: 84532, // Base Sepolia
};

// Mainnet chain IDs (for future use)
const MAINNET_CHAIN_IDS: Record<string, number> = {
  bnb: 56,
  ethereum: 1,
  base: 8453,
};

export function getChainId(network: string): number {
  return CHAIN_IDS[network] || 97;
}

export function getNetworkName(chainId: number): string {
  const entry = Object.entries(CHAIN_IDS).find(([, id]) => id === chainId);
  return entry ? entry[0] : 'bnb';
}

// Contract addresses per chain
export const CONTRACT_ADDRESSES: Record<
  number,
  {
    fairlaunchFactory?: `0x${string}`;
    presaleFactory?: `0x${string}`;
    tokenFactory?: `0x${string}`;
    escrow?: `0x${string}`;
    blueCheck?: `0x${string}`;
  }
> = {
  // BSC Testnet
  97: {
    fairlaunchFactory: '0xB05fd8F59f723ab590aB4eCb47d16701568B4e12',
    presaleFactory: '0x0000000000000000000000000000000000000000',
    tokenFactory: '0xB05fd8F59f723ab590aB4eCb47d16701568B4e12',
    escrow: '0x0000000000000000000000000000000000000000',
    blueCheck: '0x0000000000000000000000000000000000000000',
  },
  // BSC Mainnet
  56: {
    presaleFactory: '0xdD7B81C73b94F3dc4bE5fBd1feEc675E43F29F65',
    blueCheck: '0x7d33B957D8B27133Fa9e7765A18306A7BA60D275',
  },
  // Sepolia
  11155111: {
    fairlaunchFactory: '0x3e00abF9F9F8F50724EAd093185eEA250601c050',
    tokenFactory: '0x3e00abF9F9F8F50724EAd093185eEA250601c050',
  },
  // Base Sepolia
  84532: {
    fairlaunchFactory: '0x3e00abF9F9F8F50724EAd093185eEA250601c050',
    tokenFactory: '0x3e00abF9F9F8F50724EAd093185eEA250601c050',
  },
};

// Explorer URL helper
export function getExplorerUrl(chainId: number, hash: string): string {
  const explorers: Record<number, string> = {
    97: 'https://testnet.bscscan.com',
    56: 'https://bscscan.com',
    11155111: 'https://sepolia.etherscan.io',
    1: 'https://etherscan.io',
    84532: 'https://sepolia.basescan.org',
    8453: 'https://basescan.org',
  };
  const base = explorers[chainId] || 'https://etherscan.io';
  return `${base}/tx/${hash}`;
}
