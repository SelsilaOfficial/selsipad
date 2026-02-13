import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { CreatePresaleWizard } from './CreatePresaleWizard';
import { createClient } from '@/lib/supabase/server';
import { checkUserHasDevKYC } from './actions';
import { DevKYCRequiredError } from './DevKYCRequiredError';

export const metadata = {
  title: 'Create Presale | SELSIPAD',
  description: 'Launch your token presale on SELSIPAD',
};

export default async function CreatePresalePage() {
  // Check authentication using custom session management (Pattern 68: Wallet-Only Auth)
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  const walletAddress = session.address;

  // ============================================
  // KYC GATING CHECK (PHASE 3)
  // ============================================

  // Check if user has DEVELOPER_KYC_VERIFIED badge
  const kycBadgeResult = await checkUserHasDevKYC(walletAddress);

  if (!kycBadgeResult.success || !kycBadgeResult.data?.hasBadge) {
    // User does not have required badge - show error page
    return <DevKYCRequiredError />;
  }

  // ============================================
  // END KYC GATING CHECK
  // ============================================

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
    <div
      className="min-h-screen bg-gray-950 py-8"
      style={{
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div className="container mx-auto px-4">
        <CreatePresaleWizard
          walletAddress={walletAddress}
          initialKycStatus={kycStatus as any}
          initialScScanStatus={scScanStatus as any}
        />
      </div>
    </div>
  );
}
