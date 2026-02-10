import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PresaleDetailClient } from './PresaleDetailClient';
import { getServerSession } from '@/lib/auth/session';

export default async function PresaleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // Fetch round details
  const { data: round, error } = await supabase
    .from('launch_rounds')
    .select(
      `
      *,
      projects (*)
    `
    )
    .eq('id', params.id)
    .single();

  if (error || !round) {
    notFound();
  }

  // Check user via wallet session (not JWT auth.getUser)
  const session = await getServerSession();
  const userId = session?.userId || null;
  const isOwner = !!(userId && round.projects?.owner_user_id === userId);
  const isPublic = ['APPROVED', 'DEPLOYED', 'LIVE', 'ACTIVE', 'ENDED', 'FINALIZED'].includes(
    round.status
  );

  if (!isOwner && !isPublic) {
    notFound();
  }

  // Fetch user's contribution if logged in
  let userContribution = null;
  if (userId) {
    const { data: contrib } = await supabase
      .from('contributions')
      .select('*')
      .eq('round_id', params.id)
      .eq('user_id', userId)
      .in('status', ['PENDING', 'CONFIRMED'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    userContribution = contrib;
  }

  // Fetch ALL contributions for this round (for Transactions tab)
  const { data: allContributions } = await supabase
    .from('contributions')
    .select('id, amount, tx_hash, status, wallet_address, created_at, user_id')
    .eq('round_id', params.id)
    .in('status', ['PENDING', 'CONFIRMED'])
    .order('created_at', { ascending: false });

  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <PresaleDetailClient
        round={round}
        userContribution={userContribution}
        allContributions={allContributions || []}
        isOwner={isOwner}
      />
    </div>
  );
}
