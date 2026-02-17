import { createServiceRoleClient as createClient } from '@/lib/supabase/service-role';
import { notFound, redirect } from 'next/navigation';
import { FairlaunchReviewClient } from './FairlaunchReviewClient';

async function getRound(id: string) {
  const supabase = createClient();

  console.log('[Review Detail] Fetching round with id:', id);

  // 1. Fetch Round
  const { data: round, error } = await supabase
    .from('launch_rounds')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !round) {
    console.error('[Review Detail] Error fetching round:', error, 'ID:', id);
    return null;
  }

  console.log(
    '[Review Detail] Found round:',
    round.id,
    'status:',
    round.status,
    'type:',
    round.type
  );

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
  // Fetch round — admin auth is handled by the AdminShell layout
  const round = await getRound(params.id);

  if (!round) {
    notFound();
  }

  // Allow viewing submitted rounds AND approved rounds (for deployment)
  const allowedStatuses = ['SUBMITTED', 'APPROVED', 'DEPLOYED'];
  if (!allowedStatuses.includes(round.status)) {
    redirect('/admin/fairlaunch/review');
  }

  return <FairlaunchReviewClient round={round} />;
}
