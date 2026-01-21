import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { FairlaunchDetail } from './FairlaunchDetail';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('launch_rounds')
    .select('params')
    .eq('id', params.id)
    .single();

  const projectName = data?.params?.project_name || 'Fairlaunch';

  return {
    title: `${projectName} | SELSIPAD Fairlaunch`,
    description: `Participate in ${projectName} fair launch token sale`,
  };
}

export default async function FairlaunchDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const session = await getServerSession();

  // Fetch fairlaunch detail
  const { data: fairlaunch, error } = await supabase
    .from('launch_rounds')
    .select('*')
    .eq('id', params.id)
    .eq('sale_type', 'fairlaunch')
    .single();

  if (error || !fairlaunch) {
    redirect('/fairlaunch');
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <FairlaunchDetail fairlaunch={fairlaunch} userAddress={session?.address} />
      </div>
    </div>
  );
}
