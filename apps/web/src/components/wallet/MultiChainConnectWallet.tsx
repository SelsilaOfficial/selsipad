'use client';

import { useState, useEffect } from 'react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useSignMessage } from 'wagmi';
import { signMessageEVM, verifyAndCreateSession } from '@/lib/wallet/signMessage';
import { useRouter } from 'next/navigation';

/**
 * Multi-Chain Connect Wallet Button with Auto Sign-In
 *
 * Automatically triggers sign-in flow after wallet connection
 * Includes network selector for choosing blockchain network
 */
export function MultiChainConnectWallet() {
  const [mounted, setMounted] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // EVM
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);
  // Auto sign-in when EVM wallet connects (only if not already authenticated)
  useEffect(() => {
    const checkAndAuth = async () => {
      if (isConnected && address && !isAuthenticating) {
        // Check if already authenticated (skip if error)
        try {
          const res = await fetch('/api/auth/session');
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated) {
              console.log('[Wallet] Already authenticated, skipping signature');
              return;
            }
          }
        } catch (error) {
          // Ignore errors, proceed with auth
          console.log('[Wallet] Session check failed, proceeding with auth');
        }

        // Not authenticated - trigger sign
        handleEVMAuth();
      }
    };
    checkAndAuth();
  }, [isConnected, address]);

  const handleEVMAuth = async () => {
    if (!address) return;

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Sign authentication message
      const signResult = await signMessageEVM(signMessageAsync, address);

      // Verify and create session
      const result = await verifyAndCreateSession('evm', signResult);

      if (result.success) {
        // Redirect to profile or refresh
        router.push('/profile');
        router.refresh();
      } else {
        setAuthError(result.error || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('EVM auth error:', error);
      if (error.message?.includes('rejected')) {
        setAuthError('Signature rejected');
      } else {
        setAuthError(error.message || 'Failed to sign message');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Prevent SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <button
          className="h-10 px-4 rounded-md text-sm font-medium"
          style={{
            backgroundColor: 'hsl(var(--primary-main))',
            color: 'hsl(var(--primary-text))',
          }}
          disabled
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* EVM Wallet Button - PRIMARY authentication */}
      <button
        onClick={() => open()}
        style={{
          backgroundColor: isConnected ? 'hsl(var(--bg-elevated))' : 'hsl(var(--primary-main))',
          color: isConnected ? 'hsl(var(--text-primary))' : 'hsl(var(--primary-text))',
          borderRadius: '0.375rem',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          height: '2.5rem',
          transition: 'background-color 0.2s',
        }}
        disabled={isAuthenticating}
      >
        {isConnected && address
          ? `${address.slice(0, 6)}...${address.slice(-4)}`
          : 'Connect Wallet'}
      </button>

      {/* Status Messages */}
      {isAuthenticating && <p className="text-xs text-text-secondary">🔐 Signing...</p>}

      {authError && <p className="text-xs text-error">❌ {authError}</p>}
    </div>
  );
}
