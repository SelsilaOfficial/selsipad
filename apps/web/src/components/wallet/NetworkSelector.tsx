'use client';

import { useState, useEffect } from 'react';

// Network definitions
export interface NetworkConfig {
  id: string;
  name: string;
  type: 'EVM' | 'SOL';
  chainId?: number; // For EVM
  rpcUrl?: string;
  isTestnet: boolean;
  icon?: string;
}

export const EVM_NETWORKS: NetworkConfig[] = [
  // Mainnet
  { id: 'base', name: 'Base Mainnet', type: 'EVM', chainId: 8453, isTestnet: false, icon: '🔵' },
  {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    type: 'EVM',
    chainId: 1,
    isTestnet: false,
    icon: '⟠',
  },
  { id: 'bsc', name: 'BSC Mainnet', type: 'EVM', chainId: 56, isTestnet: false, icon: '🟡' },
  // Testnet
  {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    type: 'EVM',
    chainId: 84532,
    isTestnet: true,
    icon: '🔵',
  },
  {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    type: 'EVM',
    chainId: 11155111,
    isTestnet: true,
    icon: '⟠',
  },
  { id: 'bsc-testnet', name: 'BSC Testnet', type: 'EVM', chainId: 97, isTestnet: true, icon: '🟡' },
];

export const SOLANA_NETWORKS: NetworkConfig[] = [
  { id: 'mainnet-beta', name: 'Solana Mainnet', type: 'SOL', isTestnet: false, icon: '◎' },
  { id: 'devnet', name: 'Solana Devnet', type: 'SOL', isTestnet: true, icon: '◎' },
];

export const ALL_NETWORKS = [...EVM_NETWORKS, ...SOLANA_NETWORKS];

const STORAGE_KEY = 'selectedNetwork';

interface NetworkSelectorProps {
  onNetworkChange?: (network: NetworkConfig) => void;
  defaultNetwork?: string;
  compact?: boolean;
}

/**
 * Network Selector Component
 *
 * Allows users to select blockchain network before connecting wallet
 * Supports 6 EVM networks (3 mainnet + 3 testnet) and 2 Solana networks
 */
export function NetworkSelector({
  onNetworkChange,
  defaultNetwork = 'base',
  compact = false,
}: NetworkSelectorProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfig>(
    ALL_NETWORKS.find((n) => n.id === defaultNetwork) || EVM_NETWORKS[0]!
  );
  const [isOpen, setIsOpen] = useState(false);

  // Load saved network from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const network = ALL_NETWORKS.find((n) => n.id === saved);
      if (network) {
        setSelectedNetwork(network);
      }
    }
  }, []);

  // Save to localStorage and notify parent when network changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedNetwork.id);
    onNetworkChange?.(selectedNetwork);
  }, [selectedNetwork, onNetworkChange]);

  const handleSelectNetwork = (network: NetworkConfig) => {
    setSelectedNetwork(network);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 bg-bg-elevated border border-border-subtle rounded-md text-xs hover:bg-bg-hover transition-colors"
        >
          <span>{selectedNetwork.icon}</span>
          <span className="hidden sm:inline">{selectedNetwork.name}</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-1 w-56 bg-bg-elevated border border-border-subtle rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
              <div className="py-1">
                {/* EVM Networks */}
                <div className="px-3 py-1.5 text-xs font-semibold text-text-secondary uppercase">
                  EVM Networks
                </div>
                {EVM_NETWORKS.map((network) => (
                  <button
                    key={network.id}
                    onClick={() => handleSelectNetwork(network)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-hover transition-colors ${
                      selectedNetwork.id === network.id
                        ? 'bg-primary-soft/10 text-primary-main'
                        : ''
                    }`}
                  >
                    <span className="text-base">{network.icon}</span>
                    <span className="flex-1 text-left">{network.name}</span>
                    {network.isTestnet && (
                      <span className="px-1.5 py-0.5 bg-warning-soft/20 text-warning text-xs rounded">
                        Testnet
                      </span>
                    )}
                  </button>
                ))}

                {/* Solana Networks */}
                <div className="px-3 py-1.5 mt-1 text-xs font-semibold text-text-secondary uppercase border-t border-border-subtle">
                  Solana Networks
                </div>
                {SOLANA_NETWORKS.map((network) => (
                  <button
                    key={network.id}
                    onClick={() => handleSelectNetwork(network)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-hover transition-colors ${
                      selectedNetwork.id === network.id
                        ? 'bg-primary-soft/10 text-primary-main'
                        : ''
                    }`}
                  >
                    <span className="text-base">{network.icon}</span>
                    <span className="flex-1 text-left">{network.name}</span>
                    {network.isTestnet && (
                      <span className="px-1.5 py-0.5 bg-warning-soft/20 text-warning text-xs rounded">
                        Testnet
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Full size variant
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-text-primary mb-2">Select Network</label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-bg-elevated border border-border-subtle rounded-md hover:bg-bg-hover transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{selectedNetwork.icon}</span>
            <div className="text-left">
              <div className="text-sm font-medium">{selectedNetwork.name}</div>
              <div className="text-xs text-text-secondary">
                {selectedNetwork.type} • {selectedNetwork.isTestnet ? 'Testnet' : 'Mainnet'}
              </div>
            </div>
          </div>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 right-0 mt-1 bg-bg-elevated border border-border-subtle rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
              <div className="py-1">
                {/* EVM Networks */}
                <div className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">
                  EVM Networks
                </div>
                {EVM_NETWORKS.map((network) => (
                  <button
                    key={network.id}
                    onClick={() => handleSelectNetwork(network)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors ${
                      selectedNetwork.id === network.id ? 'bg-primary-soft/10' : ''
                    }`}
                  >
                    <span className="text-xl">{network.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{network.name}</div>
                      <div className="text-xs text-text-secondary">Chain ID: {network.chainId}</div>
                    </div>
                    {network.isTestnet && (
                      <span className="px-2 py-1 bg-warning-soft/20 text-warning text-xs rounded">
                        Testnet
                      </span>
                    )}
                    {selectedNetwork.id === network.id && (
                      <svg
                        className="w-5 h-5 text-primary-main"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}

                {/* Solana Networks */}
                <div className="px-3 py-2 mt-1 text-xs font-semibold text-text-secondary uppercase border-t border-border-subtle">
                  Solana Networks
                </div>
                {SOLANA_NETWORKS.map((network) => (
                  <button
                    key={network.id}
                    onClick={() => handleSelectNetwork(network)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors ${
                      selectedNetwork.id === network.id ? 'bg-primary-soft/10' : ''
                    }`}
                  >
                    <span className="text-xl">{network.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{network.name}</div>
                      <div className="text-xs text-text-secondary">
                        {network.isTestnet ? 'Development Network' : 'Production Network'}
                      </div>
                    </div>
                    {network.isTestnet && (
                      <span className="px-2 py-1 bg-warning-soft/20 text-warning text-xs rounded">
                        Testnet
                      </span>
                    )}
                    {selectedNetwork.id === network.id && (
                      <svg
                        className="w-5 h-5 text-primary-main"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to get current selected network
 */
export function useSelectedNetwork(): NetworkConfig {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfig>(EVM_NETWORKS[0]!);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const network = ALL_NETWORKS.find((n) => n.id === saved);
      if (network) {
        setSelectedNetwork(network);
      }
    }

    // Listen for storage changes (for cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const network = ALL_NETWORKS.find((n) => n.id === e.newValue);
        if (network) {
          setSelectedNetwork(network);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return selectedNetwork;
}
