import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { checkSolanaWallet } from '@/lib/wallet/check-wallet';
import { SolanaWalletPrompt } from '@/components/wallet/SolanaWalletPrompt';
import { CreateBondingCurveWizard } from './CreateBondingCurveWizard';

export const metadata = {
  title: 'Create Bonding Curve | SELSIPAD',
  description: 'Launch your token with permissionless bonding curve on Solana',
};

/**
 * Create Bonding Curve Page
 *
 * ARCHITECTURE:
 * - Requires EVM wallet for authentication (PRIMARY)
 * - Requires Solana wallet for feature execution (SECONDARY)
 * - Shows prompt if Solana wallet not linked
 */
export default async function CreateBondingCurvePage() {
  // 1. Check EVM authentication (PRIMARY wallet)
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  // 2. Check if Solana wallet is linked (SECONDARY wallet)
  const solanaAddress = await checkSolanaWallet();

  // 3. If no Solana wallet, show prompt to connect
  if (!solanaAddress) {
    return (
      <div className="min-h-screen bg-bg-page py-8">
        <SolanaWalletPrompt
          feature="Bonding Curve"
          onConnected={() => {
            // Reload page after wallet linked
            // This is handled client-side
          }}
        />
      </div>
    );
  }

  // 4. Solana wallet exists, show bonding curve form
  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <CreateBondingCurveWizard walletAddress={solanaAddress} />
      </div>
    </div>
  );
}
