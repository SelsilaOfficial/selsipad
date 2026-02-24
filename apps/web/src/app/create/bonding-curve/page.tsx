import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { CreateBondingCurveWizard } from './CreateBondingCurveWizard';

export const metadata = {
  title: 'Create Bonding Curve | SELSIPAD',
  description: 'Launch your token with permissionless EVM bonding curve',
};

/**
 * Create Bonding Curve Page
 *
 * ARCHITECTURE:
 * - Requires EVM wallet for authentication (PRIMARY)
 * - EVM Smart Contract Factory interaction is handled natively in Wizard via Wagmi
 */
export default async function CreateBondingCurvePage() {
  // 1. Check EVM authentication (PRIMARY wallet)
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  // 2. EVM wallet exists (via auth session), show bonding curve form
  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <CreateBondingCurveWizard walletAddress={""} />
      </div>
    </div>
  );
}
