import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { FairlaunchReviewClient } from './FairlaunchReviewClient';

async function getRound(id: string) {
  const supabase = createClient();

  // 1. Fetch Round
  const { data: round, error } = await supabase
    .from('launch_rounds')
    .select('*')
    .eq('id', id)
    .eq('sale_type', 'fairlaunch')
    .single();

  if (error || !round) {
    console.error('Error fetching round:', error);
    return null;
  }

  // 2. Fetch Project (if project_id exists)
  if (round.project_id) {
    const { data: project } = await supabase
      .from('projects')
      .select('name, description, logo_url, website, twitter, telegram, discord, token_address')
      .eq('id', round.project_id)
      .single();

    if (project) {
      // Merge project data into round.projects structure expected by client
      round.projects = project;
    }
  }

  return round;
}

export default async function FairlaunchReviewDetailPage({ params }: { params: { id: string } }) {
  // 1. Check admin authentication
  const { getServerSession } = await import('@/lib/auth/session');
  const session = await getServerSession();

  if (!session?.userId) {
    redirect('/');
  }

  // Check if user is admin from profiles table
  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', session.userId)
    .single();

  if (!profile?.is_admin) {
    redirect('/');
  }

  // 2. Fetch round
  const round = await getRound(params.id);

  if (!round) {
    notFound();
  }

  // Allow viewing submitted rounds AND approved rounds (for deployment)
  const allowedStatuses = ['SUBMITTED', 'SUBMITTED_FOR_REVIEW', 'APPROVED_TO_DEPLOY', 'DEPLOYED'];
  if (!allowedStatuses.includes(round.status)) {
    redirect('/admin/fairlaunch/review');
  }

  return <FairlaunchReviewClient round={round} />;
}
