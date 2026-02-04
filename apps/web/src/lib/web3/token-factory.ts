/**
 * Token Factory Configuration
 * Addresses and ABIs for SimpleTokenFactory across all networks
 */

import { type Address, parseEther } from 'viem';
import SimpleTokenFactoryABI from './abis/SimpleTokenFactory.json';

// ===== TOKEN FACTORY ADDRESSES =====

export const TOKEN_FACTORY_ADDRESSES: Record<string, Address> = {
  localhost: '0x0000000000000000000000000000000000000000', // TBD
  ethereum: '0x0000000000000000000000000000000000000000', // TBD
  bnb: '0x0000000000000000000000000000000000000000', // TBD
  base: '0x0000000000000000000000000000000000000000', // TBD
  sepolia: '0x2aDF8E4a91dC34d992e12FA51d78a4F7E06a5D6b', // ✅ Deployed 2026-01-29
  bsc_testnet: '0x4924e4Dc79f3673a25ea29D26822A5Ee3535Ce6B', // ✅ Deployed 2026-01-29
  base_sepolia: '0x2aDF8E4a91dC34d992e12FA51d78a4F7E06a5D6b', // ✅ Deployed 2026-01-29
  solana: '0x0000000000000000000000000000000000000000', // N/A
} as const;

// ===== TOKEN CREATION FEES =====

export const TOKEN_CREATION_FEES: Record<string, bigint> = {
  localhost: parseEther('0.01'),
  ethereum: parseEther('0.1'),
  bnb: parseEther('0.2'),
  base: parseEther('0.05'),
  sepolia: parseEther('0.01'), // Testnet
  bsc_testnet: parseEther('0.2'), // Matches BSC mainnet for testing
  base_sepolia: parseEther('0.01'), // Testnet
  solana: BigInt(0), // N/A
};

// ===== ABI EXPORT =====

export { SimpleTokenFactoryABI };

// ===== HELPER FUNCTIONS =====

/**
 * Get token factory address for network
 */
export function getTokenFactoryAddress(network: string): Address {
  return TOKEN_FACTORY_ADDRESSES[network] || ('0x0000000000000000000000000000000000000000' as Address);
}

/**
 * Get token creation fee for network
 */
export function getTokenCreationFee(network: string): bigint {
  return TOKEN_CREATION_FEES[network] || parseEther('0.01');
}

/**
 * Check if token factory is deployed on network
 */
export function isTokenFactoryAvailable(network: string): boolean {
  const address = TOKEN_FACTORY_ADDRESSES[network];
  return address !== '0x0000000000000000000000000000000000000000';
}
