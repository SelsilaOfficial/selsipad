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
  sepolia: '0x8b81a2fd4Db786ab1f3A298804FFB6C845797842', // ✅ Redeployed 2026-02-28 (0.1 ETH fee)
  bsc_testnet: '0x28DBa6468e7e5AD805374244B5D528375fC4610A', // ✅ Deployed 2026-02-07 Hybrid
  base_sepolia: '0x0bd090FFA318F0A00066eAA9C074cB59CB7D5010', // ✅ Redeployed 2026-02-28 (0.1 ETH fee)
  solana: '0x0000000000000000000000000000000000000000', // N/A
} as const;

// ===== TOKEN CREATION FEES =====

export const TOKEN_CREATION_FEES: Record<string, bigint> = {
  localhost: parseEther('0.01'),
  ethereum: parseEther('0.1'),
  bnb: parseEther('0.2'),
  base: parseEther('0.05'),
  sepolia: parseEther('0.1'), // Testnet — matches mainnet
  bsc_testnet: parseEther('0.2'), // Matches BSC mainnet for testing
  base_sepolia: parseEther('0.1'), // Testnet — matches mainnet
  solana: BigInt(0), // N/A
};

// ===== ABI EXPORT =====

export { SimpleTokenFactoryABI };

// ===== HELPER FUNCTIONS =====

/**
 * Get token factory address for network
 */
export function getTokenFactoryAddress(network: string): Address {
  const addr = TOKEN_FACTORY_ADDRESSES[network];
  if (!addr || addr === '0x0000000000000000000000000000000000000000') {
    throw new Error(
      `Token factory not deployed on network: "${network}". Available: ${Object.keys(
        TOKEN_FACTORY_ADDRESSES
      )
        .filter((k) => TOKEN_FACTORY_ADDRESSES[k] !== '0x0000000000000000000000000000000000000000')
        .join(', ')}`
    );
  }
  return addr;
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
