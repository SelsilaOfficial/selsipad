import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { CreateFairlaunchWizard } from './CreateFairlaunchWizard';
import { createClient } from '@/lib/supabase/server';

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
  const supabase = createClient();

  // Fetch user's KYC status
  const { data: kycData } = await supabase
    .from('kyc_submissions')
    .select('status')
    .eq('wallet_address', walletAddress)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const kycStatus = kycData?.status || 'PENDING';

  // Fetch latest SC Scan status (placeholder for now)
  const scScanStatus = 'NOT_REQUESTED';

  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <CreateFairlaunchWizard
          walletAddress={walletAddress}
          initialKycStatus={kycStatus as any}
          initialScScanStatus={scScanStatus as any}
        />
      </div>
    </div>
  );
}
