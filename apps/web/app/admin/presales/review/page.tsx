import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminReviewQueue } from './AdminReviewQueue';

export const metadata = {
  title: 'Admin Review Queue | SELSIPAD',
  description: 'Review and approve presale submissions',
};

export default async function AdminReviewPage() {
  // Check authentication (Pattern 68: Wallet-Only Auth)
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  const supabase = createClient();

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', session.userId)
    .single();

  if (!profile?.is_admin) {
    redirect('/'); // Non-admin cannot access
  }

  // Fetch presales awaiting review
  const { data: presales, error } = await supabase
    .from('launch_rounds')
    .select('*')
    .eq('status', 'SUBMITTED_FOR_REVIEW')
    .order('created_at', { ascending: true }); // FIFO queue

  if (error) {
    console.error('Failed to fetch presales:', error);
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <AdminReviewQueue presales={presales || []} />
      </div>
    </div>
  );
}
