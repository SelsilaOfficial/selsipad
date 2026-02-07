'use client';

import { createWeb3Modal } from '@web3modal/wagmi/react';
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors';
import { createConfig, http } from 'wagmi';
import { mainnet, bsc, base, sepolia, baseSepolia, bscTestnet } from 'wagmi/chains';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

interface EVMWalletProviderProps {
  children: ReactNode;
}

// Fix for "unstorage" and "idb-keyval" errors in SSR
// We MUST NOT define global.window because it breaks Next.js server detection
if (typeof window === 'undefined') {
  // Mock localStorage
  if (!global.localStorage) {
    (global as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
  }

  // Mock indexedDB for WalletConnect with callback triggering
  if (!(global as any).indexedDB) {
    const createRequest = (result: any) => {
      const req: any = { result };
      // Trigger success on next tick to allow assigning onsuccess
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess({ target: req });
      }, 0);
      return req;
    };

    (global as any).indexedDB = {
      open: () =>
        createRequest({
          result: {
            objectStoreNames: { contains: () => false },
            createObjectStore: () => ({ createIndex: () => {} }),
            transaction: () => ({
              objectStore: () => ({
                put: () => createRequest(undefined),
                get: () => createRequest(undefined),
                delete: () => createRequest(undefined),
                getAllKeys: () => createRequest([]),
                clear: () => createRequest(undefined),
              }),
            }),
            close: () => {},
          },
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
    };
  }
}

// Configure chains - Mainnet + Testnet
const chains = [
  // Mainnets
  base,
  mainnet,
  bsc,
  // Testnets
  baseSepolia,
  sepolia,
  bscTestnet,
] as const;

// Get project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'selsipad-default-id';

// Manually configure connectors (avoiding all optional wagmi connectors)
const wagmiConfig = createConfig({
  chains,
  connectors: [
    walletConnect({ projectId, showQrModal: false }),
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: 'SELSIPAD' }),
  ],
  transports: {
    // Mainnets
    [base.id]: http(),
    [mainnet.id]: http(),
    [bsc.id]: http(),
    // Testnets
    [baseSepolia.id]: http(),
    [sepolia.id]: http(),
    [bscTestnet.id]: http(),
  },
  ssr: true,
});

// Create Web3Modal
createWeb3Modal({
  wagmiConfig,
  projectId,
  enableAnalytics: false,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': 'hsl(var(--primary-main))',
    '--w3m-border-radius-master': '0.375rem',
  },
});

// Create query client
const queryClient = new QueryClient();

/**
 * EVM Wallet Provider (Web3Modal - Simplified)
 *
 * Manually configured connectors to avoid optional dependencies:
 * - WalletConnect (for mobile wallets)
 * - Injected (MetaMask, Trust, Brave, etc.)
 * - Coinbase Wallet
 *
 * Uses Web3Modal v3 for production-ready wallet integration
 */
export function EVMWalletProvider({ children }: EVMWalletProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
