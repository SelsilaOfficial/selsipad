import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { BondingCurveDetail } from './BondingCurveDetail';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('bonding_pools')
    .select('token_name')
    .eq('id', params.id)
    .single();

  const tokenName = data?.token_name || 'Bonding Curve Pool';

  return {
    title: `${tokenName} | SELSIPAD Bonding Curve`,
    description: `Trade ${tokenName} on bonding curve with permissionless pricing`,
  };
}

export default async function BondingCurveDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const session = await getServerSession();

  // Fetch pool detail
  const { data: pool, error } = await supabase
    .from('bonding_pools')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !pool) {
    redirect('/bonding-curve');
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <BondingCurveDetail pool={pool} userAddress={session?.address} />
      </div>
    </div>
  );
}
