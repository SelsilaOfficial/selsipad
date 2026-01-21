import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { OwnerPresalesDashboard } from './OwnerPresalesDashboard';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'My Presales | SELSIPAD',
  description: 'Manage your presales',
};

export default async function OwnerPresalesDashboardPage() {
  // Check authentication using custom session management (Pattern 68: Wallet-Only Auth)
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  const walletAddress = session.address;
  const supabase = createClient();

  // Fetch user's presales
  const { data: presales, error } = await supabase
    .from('launch_rounds')
    .select('*')
    .eq('created_by', session.userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch presales:', error);
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <OwnerPresalesDashboard presales={presales || []} walletAddress={walletAddress} />
      </div>
    </div>
  );
}
