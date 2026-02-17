'use client';

import { useState, useEffect, useRef } from 'react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useSignMessage } from 'wagmi';
import { signMessageEVM, verifyAndCreateSession } from '@/lib/wallet/signMessage';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wallet } from 'lucide-react';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const prevConnectedRef = useRef(false);

  // EVM
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
    // Capture referral code from URL (?ref=CODE)
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref);
      // Also persist to localStorage in case user navigates before signing in
      localStorage.setItem('selsipad_referral_code', ref);
    } else {
      // Check localStorage for previously captured code
      const storedRef = localStorage.getItem('selsipad_referral_code');
      if (storedRef) setReferralCode(storedRef);
    }
  }, [searchParams]);

  // Detect wallet disconnect and clear server-side session
  useEffect(() => {
    if (!mounted) return;

    // Detect transition from connected → disconnected
    if (prevConnectedRef.current && !isConnected) {
      console.log('[Wallet] Disconnect detected — clearing server session');
      setIsAuthenticated(false);

      // Clear server-side session (cookies + DB)
      fetch('/api/auth/logout', { method: 'POST' })
        .then(() => {
          console.log('[Wallet] Server session cleared');
          // Clear any local wallet storage
          localStorage.removeItem('wallet_address');
          // Force page refresh to re-evaluate server-side session guards
          router.refresh();
        })
        .catch((err) => {
          console.error('[Wallet] Failed to clear server session:', err);
          // Still refresh to ensure UI reflects disconnected state
          router.refresh();
        });
    }

    prevConnectedRef.current = isConnected;
  }, [mounted, isConnected, router]);

  // Check session status on mount and when address changes
  useEffect(() => {
    const checkSession = async () => {
      if (!isConnected || !address) {
        setIsAuthenticated(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            const sessionWallet = data.user?.address?.toLowerCase();
            const connectedWallet = address.toLowerCase();
            setIsAuthenticated(sessionWallet === connectedWallet);
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    };

    if (mounted) {
      checkSession();
    }
  }, [mounted, isConnected, address]);

  // Users must now manually click "Sign In" after connecting wallet
  /*
  useEffect(() => {
    const checkAndAuth = async () => {
      if (isConnected && address && !isAuthenticating) {
        // Check if already authenticated AND wallet matches
        try {
          const res = await fetch('/api/auth/session');
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated) {
              // IMPORTANT: Check if authenticated wallet matches connected wallet
              const sessionWallet = data.user?.address?.toLowerCase();
              const connectedWallet = address.toLowerCase();

              if (sessionWallet === connectedWallet) {
                console.log('[Wallet] Already authenticated with same wallet, skipping signature');
                return;
              } else {
                // Different wallet detected! Clear old session
                console.log('[Wallet] Different wallet detected, clearing old session');
                console.log('[Wallet] Session wallet:', sessionWallet);
                console.log('[Wallet] Connected wallet:', connectedWallet);

                // Logout old session
                await fetch('/api/auth/logout', { method: 'POST' });

                // Proceed with new auth
                console.log('[Wallet] Proceeding with new wallet authentication');
              }
            }
          }
        } catch (error) {
          // Ignore errors, proceed with auth
          console.log('[Wallet] Session check failed, proceeding with auth');
        }

        // Not authenticated OR different wallet - trigger sign
        handleEVMAuth();
      }
    };
    checkAndAuth();
  }, [isConnected, address]);
  */

  const handleEVMAuth = async () => {
    if (!address) return;

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Sign authentication message
      const signResult = await signMessageEVM(signMessageAsync, address);

      // Verify and create session (with referral code if available)
      const result = await verifyAndCreateSession('evm', signResult, referralCode || undefined);

      if (result.success) {
        // Success! Update auth state, clear referral code, and refresh
        console.log('[Wallet] Authentication successful');
        setIsAuthenticated(true);
        // Clear stored referral code after successful auth
        localStorage.removeItem('selsipad_referral_code');
        setReferralCode(null);
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
          className="h-10 px-6 py-2 rounded-full border border-[#39AEC4]/30 bg-[#39AEC4]/10 backdrop-blur-sm text-sm font-medium text-white/80"
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
        className={`
          flex items-center justify-center gap-2 px-6 py-2 rounded-full 
          text-sm font-bold transition-all duration-300 shadow-lg shadow-[#756BBA]/20
          ${
            isConnected
              ? 'bg-[#39AEC4]/10 border border-[#39AEC4]/30 text-white shadow-[0_0_15px_rgba(57,174,196,0.1)]'
              : 'bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white hover:opacity-90 hover:shadow-[0_0_20px_rgba(117,107,186,0.4)] border-none'
          }
        `}
        disabled={isAuthenticating}
      >
        {isConnected && address ? (
          <>
            <span className="hidden md:inline font-mono">{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
            <span className="md:hidden">
              <Wallet className="w-4 h-4" />
            </span>
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            <span>Connect</span>
          </>
        )}
      </button>

      {/* Sign In Button - shows lock state based on auth status */}
      {isConnected && address && (
        <button
          onClick={handleEVMAuth}
          disabled={isAuthenticating || isAuthenticated}
          className={`
            flex items-center justify-center gap-2 px-6 py-2 rounded-full 
            border text-sm font-medium transition-all duration-300
            ${
              isAuthenticated
                ? 'bg-green-500/10 border-green-500/30 text-green-400 cursor-default'
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/50 cursor-pointer animate-pulse'
            }
          `}
        >
          {isAuthenticating ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              <span className="hidden md:inline">Signing...</span>
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <img
                src="/assets/auth-purple-icon.jpg"
                alt="Auth"
                className={`w-5 h-5 object-contain transition-transform duration-300 ${isAuthenticated ? '' : 'scale-x-[-1]'}`}
              />
              <span className="hidden md:inline">{isAuthenticated ? 'Signed In' : 'Sign In'}</span>
            </div>
          )}
        </button>
      )}

      {/* Status Messages */}
      {authError && <p className="text-xs text-red-400 animate-pulse">❌ {authError}</p>}
    </div>
  );
}
