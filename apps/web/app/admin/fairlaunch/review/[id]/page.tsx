import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { FairlaunchReviewClient } from './FairlaunchReviewClient';

async function getRound(id: string) {
  const supabase = createClient();

  const { data: round, error } = await supabase
    .from('launch_rounds')
    .select(
      `
      *,
      profiles(wallet_address, username)
    `
    )
    .eq('id', id)
    .eq('sale_type', 'fairlaunch')
    .single();

  if (error || !round) {
    return null;
  }

  return round;
}

export default async function FairlaunchReviewDetailPage({ params }: { params: { id: string } }) {
  const round = await getRound(params.id);

  if (!round) {
    notFound();
  }

  // If already reviewed, redirect back to list
  if (!['SUBMITTED', 'SUBMITTED_FOR_REVIEW'].includes(round.status)) {
    redirect('/admin/fairlaunch/review');
  }

  return <FairlaunchReviewClient round={round} />;
}
