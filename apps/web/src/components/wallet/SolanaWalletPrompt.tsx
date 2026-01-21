'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Card, CardContent } from '@/components/ui';
import { signMessageSolana } from '@/lib/wallet/signMessage';

interface SolanaWalletPromptProps {
  /** Feature name that requires Solana */
  feature: string;
  /** Optional callback when wallet successfully linked */
  onConnected?: () => void;
}

/**
 * Prompt component to request Solana wallet connection
 * Used when user tries to access Solana-specific features without wallet
 */
export function SolanaWalletPrompt({ feature, onConnected }: SolanaWalletPromptProps) {
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { publicKey, signMessage, connected } = useWallet();

  const handleLink = async () => {
    if (!publicKey || !signMessage) {
      setError('Please connect your Solana wallet first');
      return;
    }

    setIsLinking(true);
    setError(null);

    try {
      // 1. Sign authentication message
      const signResult = await signMessageSolana(signMessage, publicKey);

      // 2. Link wallet to current user
      const response = await fetch('/api/wallet/link-solana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: publicKey.toBase58(),
          signature: signResult.signature,
          message: signResult.message,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[SolanaWallet] Linked successfully:', data);

        // Call callback or reload page
        if (onConnected) {
          onConnected();
        } else {
          window.location.reload();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to link wallet');
      }
    } catch (err: any) {
      console.error('[SolanaWallet] Link error:', err);
      setError(err.message || 'Failed to link Solana wallet');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-primary-soft rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-primary-main" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.2 7.9l-11.3 11.3c-.4.4-1 .4-1.4 0l-5.3-5.3c-.4-.4-.4-1 0-1.4l1.4-1.4c.4-.4 1-.4 1.4 0l3.2 3.2 9.2-9.2c.4-.4 1-.4 1.4 0l1.4 1.4c.4.4.4 1 0 1.4z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h2 className="text-heading-lg font-semibold">Solana Wallet Required</h2>
            <p className="text-body-sm text-text-secondary">
              <strong>{feature}</strong> runs on Solana blockchain. Connect your Solana wallet to
              continue.
            </p>
          </div>

          {/* Wallet Button */}
          <div className="space-y-3">
            <WalletMultiButton
              style={{
                width: '100%',
                justifyContent: 'center',
                backgroundColor: 'hsl(var(--primary-main))',
                color: 'hsl(var(--primary-text))',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                height: '2.75rem',
              }}
            />

            {/* Link Button (shown after connected) */}
            {connected && publicKey && (
              <button
                onClick={handleLink}
                disabled={isLinking}
                className="w-full px-4 py-3 bg-success-main text-white rounded-lg font-medium hover:bg-success-hover transition-colors disabled:opacity-50"
              >
                {isLinking ? 'Linking Wallet...' : 'Link Wallet & Continue'}
              </button>
            )}
          </div>

          {/* Info */}
          <div className="bg-bg-elevated border border-border-subtle rounded-lg p-4">
            <p className="text-caption text-text-secondary">
              💡 Your Solana wallet will be linked to your account for future use. You can remove it
              later from your profile settings.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-error-soft border border-error-main rounded-lg p-4">
              <p className="text-body-sm text-error-main">❌ {error}</p>
            </div>
          )}

          {/* Supported Wallets */}
          <div className="text-center">
            <p className="text-caption text-text-secondary mb-2">Supported wallets:</p>
            <div className="flex items-center justify-center gap-2 text-xs text-text-secondary">
              <span>Phantom</span>
              <span>•</span>
              <span>Solflare</span>
              <span>•</span>
              <span>Backpack</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
