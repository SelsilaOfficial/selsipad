/**
 * Example: Using SolanaWalletPrompt in a Solana Feature Page
 *
 * This demonstrates how to check for Solana wallet and prompt connection
 * when user tries to access a Solana-specific feature.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { checkSolanaWallet } from '@/lib/wallet/check-wallet';
import { SolanaWalletPrompt } from '@/components/wallet/SolanaWalletPrompt';

export default async function SolanaFeaturePage() {
  // 1. Verify user is authenticated with EVM wallet
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  // 2. Check if Solana wallet is linked
  const solanaAddress = await checkSolanaWallet();

  // 3. If no Solana wallet, show prompt
  if (!solanaAddress) {
    return (
      <div className="min-h-screen bg-bg-page py-8">
        <SolanaWalletPrompt
          feature="Bonding Curve"
          onConnected={() => {
            // Reload page after wallet linked
            window.location.reload();
          }}
        />
      </div>
    );
  }

  // 4. Solana wallet exists, render feature
  return (
    <div className="min-h-screen bg-bg-page py-8">
      <h1>Bonding Curve</h1>
      <p>Solana Address: {solanaAddress}</p>
      {/* Your Solana feature UI here */}
    </div>
  );
}
