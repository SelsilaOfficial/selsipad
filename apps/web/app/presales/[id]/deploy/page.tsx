import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { DeployPresaleClient } from './DeployPresaleClient';

export default async function DeployPresalePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: round, error } = await supabase
    .from('launch_rounds')
    .select(
      `
      *,
      projects (
        id,
        name,
        symbol,
        logo_url,
        description,
        owner_user_id
      )
    `
    )
    .eq('id', params.id)
    .single();

  if (error || !round) notFound();

  // Only owner can deploy
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || round.projects?.owner_user_id !== user.id) {
    redirect(`/presales/${params.id}`);
  }

  // Already deployed? Redirect to detail
  if (round.status === 'DEPLOYED' || round.status === 'LIVE') {
    redirect(`/presales/${params.id}`);
  }

  // Must be in APPROVED_TO_DEPLOY
  if (round.status !== 'APPROVED_TO_DEPLOY') {
    redirect(`/dashboard/owner/presales`);
  }

  return <DeployPresaleClient round={round} />;
}
