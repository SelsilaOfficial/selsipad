import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { CreateFairlaunchWizard } from './CreateFairlaunchWizard';

export const metadata = {
  title: 'Create Fairlaunch | SELSIPAD',
  description: 'Launch your fairlaunch on SELSIPAD - Pro-rata tokenomics with softcap only',
};

export default async function CreateFairlaunchPage() {
  // Check authentication using custom session management (Pattern 68: Wallet-Only Auth)
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  const walletAddress = session.address;

  return (
    <CreateFairlaunchWizard walletAddress={walletAddress} />
  );
}
