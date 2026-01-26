'use client';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo, useState, useEffect, type ReactNode } from 'react';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: ReactNode;
}

/**
 * Solana Wallet Provider
 *
 * Provides wallet connection functionality for Solana wallets
 * Supports: Phantom, Solflare
 *
 * Usage:
 * Wrap your app with this provider in the root layout
 */
export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  // Get network from localStorage (set by NetworkSelector)
  const [network, setNetwork] = useState<WalletAdapterNetwork>(WalletAdapterNetwork.Mainnet);

  useEffect(() => {
    // Read selected network from localStorage
    const savedNetwork = localStorage.getItem('selectedNetwork');

    if (savedNetwork === 'devnet') {
      setNetwork(WalletAdapterNetwork.Devnet);
    } else if (savedNetwork === 'mainnet-beta') {
      setNetwork(WalletAdapterNetwork.Mainnet);
    } else {
      // Default to mainnet if EVM network is selected or no selection
      setNetwork(WalletAdapterNetwork.Mainnet);
    }

    // Listen for storage changes (network selector updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedNetwork') {
        if (e.newValue === 'devnet') {
          setNetwork(WalletAdapterNetwork.Devnet);
        } else if (e.newValue === 'mainnet-beta') {
          setNetwork(WalletAdapterNetwork.Mainnet);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Get RPC endpoint based on selected network
  const endpoint = useMemo(() => {
    // Use custom RPC if provided
    if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    }

    // Use devnet RPC if in devnet mode
    if (network === WalletAdapterNetwork.Devnet && process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL) {
      return process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL;
    }

    // Fallback to public cluster
    return clusterApiUrl(network);
  }, [network]);

  // Initialize wallet adapters
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
