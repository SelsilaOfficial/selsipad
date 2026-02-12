import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LockQueueList } from '@/components/admin/locks/LockQueueList';
import { ActiveLocksList } from '@/components/admin/locks/ActiveLocksList';

export default async function AdminLiquidityLocksPage() {
  const supabase = createClient();

  // Check admin session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/admin/login');
  }

  // Fetch ready-to-lock rounds
  const { data: readyLocks } = await supabase
    .from('launch_rounds')
    .select(
      `
      id,
      project:projects!inner(id, name),
      result,
      lock_status,
      liquidity_locks(*)
    `
    )
    .eq('result', 'SUCCESS')
    .in('lock_status', ['NONE', 'PENDING'])
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch active locks with on-chain details
  const { data: activeLocks } = await supabase
    .from('liquidity_locks')
    .select(
      `
      id,
      chain,
      lock_id,
      lp_token,
      locker_address,
      amount,
      beneficiary,
      locked_at,
      locked_until,
      lock_tx_hash,
      status,
      round:launch_rounds!inner(
        id,
        project:projects!inner(id, name)
      )
    `
    )
    .eq('status', 'LOCKED')
    .order('locked_at', { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Liquidity Lock Management</h1>
          <p className="text-gray-400">Manage LP locks for successful presale rounds</p>
        </div>

        {/* Queue Section */}
        <div className="mb-8">
          <LockQueueList queue={readyLocks || []} />
        </div>

        {/* Active Locks Section */}
        <div>
          <ActiveLocksList locks={activeLocks || []} />
        </div>
      </div>
    </div>
  );
}
