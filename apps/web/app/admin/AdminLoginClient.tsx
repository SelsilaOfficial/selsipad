'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Wallet, AlertCircle } from 'lucide-react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';

export default function AdminLoginClient() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const checkAdminAccess = async () => {
    if (!address) {
      setError('Please connect your EVM wallet first');
      return;
    }

    setIsChecking(true);
    setError('');

    try {
      const walletAddress = address;

      // Call admin login API (creates session)
      const response = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await response.json();

      if (data.success) {
        // Cookie is automatically set by the server
        // Check if MFA setup required
        if (data.mfa_required) {
          router.push('/admin/mfa/setup');
        } else {
          router.push(data.redirectTo || '/admin/dashboard');
        }
      } else {
        setError(data.error || 'Access denied. Your EVM wallet is not authorized as admin.');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Failed to verify admin access. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Admin Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-600 rounded-full mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">SELSIPAD Platform Management</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Admin Authentication</h2>
            <p className="text-gray-400 text-sm">
              Connect your authorized EVM admin wallet to access the dashboard
            </p>
          </div>

          {/* Connect EVM Wallet Button (Web3Modal) */}
          <div className="mb-6">
            {mounted ? (
              isConnected ? (
                <button
                  onClick={handleDisconnect}
                  className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors"
                >
                  Disconnect Wallet
                </button>
              ) : (
                <button
                  onClick={() => open()}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
                >
                  Connect Wallet
                </button>
              )
            ) : (
              <div className="flex justify-center">
                <div className="w-full px-6 py-3 bg-purple-600 rounded-lg text-white text-center">
                  Loading wallet...
                </div>
              </div>
            )}
          </div>

          {/* Wallet Status */}
          {isConnected && address && (
            <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex items-start gap-3">
                <Wallet className="w-5 h-5 text-green-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-400 font-medium text-sm mb-1">EVM Wallet Connected</p>
                  <p className="text-gray-300 text-xs font-mono break-all">
                    {address}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Access Button */}
          {isConnected && address && (
            <button
              onClick={checkAdminAccess}
              disabled={isChecking}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <Shield className="w-5 h-5" />
              {isChecking ? 'Verifying...' : 'Access Admin Dashboard'}
            </button>
          )}

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-950/30 border border-blue-800/40 rounded-lg">
            <p className="text-blue-300 text-xs text-center">
              <strong>Note:</strong> Only authorized EVM admin wallets can access this dashboard.
              Contact system administrator if you need access.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <a href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            ← Back to Homepage
          </a>
        </div>
      </div>
    </div>
  );
}
