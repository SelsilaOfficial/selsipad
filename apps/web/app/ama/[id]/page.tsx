import { createClient } from '@supabase/supabase-js';
import { PageHeader, PageContainer } from '@/components/layout';
import { notFound } from 'next/navigation';
import { getAMAMessages } from '@/lib/data/ama';
import dynamicImport from 'next/dynamic';

// Dynamic import to prevent SSR issues with Supabase client
const AMALiveRoom = dynamicImport(
  () => import('@/components/ama/AMALiveRoom').then((mod) => ({ default: mod.AMALiveRoom })),
  { ssr: false }
);

// Force dynamic rendering for real-time status
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getAMAById(id: string) {
  // Use service role to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch without embedded relations (FK not set up)
  const { data: ama, error } = await supabase
    .from('ama_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching AMA:', error);
    return null;
  }

  return ama;
}

export default async function AMADetailPage({ params }: { params: { id: string } }) {
  const ama = await getAMAById(params.id);

  if (!ama) {
    notFound();
  }

  const messages = await getAMAMessages(params.id);

  const isLive = ama.status === 'LIVE';
  const isEnded = ama.status === 'ENDED';
  const isPinned = ama.status === 'PINNED';
  const isPending = ama.status === 'PENDING';

  // Debug logging
  console.log('[AMA Detail] ID:', ama.id);
  console.log('[AMA Detail] Status:', ama.status);
  console.log('[AMA Detail] isLive:', isLive);
  console.log('[AMA Detail] Messages count:', messages.length);

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400',
    PINNED: 'bg-indigo-500/20 text-indigo-400',
    LIVE: 'bg-green-500/20 text-green-400',
    ENDED: 'bg-gray-500/20 text-gray-400',
    REJECTED: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-20">
      <PageHeader title="AMA Session" />

      <PageContainer className="py-6">
        <div className="max-w-4xl mx-auto">
          {/* Header Card */}
          <div className="bg-gradient-to-br from-[#14142b] to-[#0a0a0f] rounded-xl border border-white/10 p-8 mb-6">
            {/* Status Badge */}
            {isLive && (
              <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2 bg-green-500/20 text-green-400 rounded-full w-fit mx-auto">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="font-bold">LIVE NOW</span>
              </div>
            )}

            {/* Title */}
            <h1 className="text-3xl font-bold text-white mb-4 text-center">{ama.project_name}</h1>

            {/* Project Info */}
            <div className="flex items-center justify-center gap-3 mb-6">
              {ama.projects?.logo_url && (
                <img
                  src={ama.projects.logo_url}
                  alt={ama.projects.name}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div className="text-center">
                <p className="font-semibold text-white">@{ama.profiles?.nickname || 'Unknown'}</p>
                <p className="text-sm text-gray-400">
                  {ama.profiles?.kyc_status === 'APPROVED' ? '✓ Dev Verified' : 'Developer'}
                </p>
              </div>
            </div>

            {/* Host Info */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-xs text-gray-500">Hosted by</span>
              <span className="px-2 py-0.5 bg-[#39AEC4]/20 text-[#39AEC4] text-xs font-bold rounded border border-[#39AEC4]/30">
                🛡️ SELSIPAD Team
              </span>
              {ama.type && ama.type !== 'TEXT' && (
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded border ${
                    ama.type === 'VIDEO'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  {ama.type === 'VIDEO' ? '📹' : '🎙️'} {ama.type}
                </span>
              )}
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    statusColors[ama.status] || 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {ama.status}
                </span>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Scheduled</p>
                <p className="font-semibold text-white">
                  {new Date(ama.scheduled_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-gray-400">
                  {new Date(ama.scheduled_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Payment</p>
                <p className="font-semibold text-indigo-400">
                  {Number(ama.payment_amount_bnb).toFixed(4)} BNB
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Messages</p>
                <p className="font-semibold text-white">{messages.length}</p>
              </div>
            </div>

            {/* Description */}
            {ama.description && (
              <div className="border-t border-white/10 pt-6">
                <h3 className="font-semibold text-white mb-2">About This AMA</h3>
                <p className="text-gray-300 whitespace-pre-wrap">{ama.description}</p>
              </div>
            )}
          </div>

          {/* Live Chat Room (only for LIVE status) */}
          {isLive && (
            <AMALiveRoom
              amaId={ama.id}
              projectName={ama.project_name}
              developerId={ama.developer_id}
              initialMessages={messages}
            />
          )}

          {/* Status Section (for non-live) */}
          {!isLive && (
            <div className="bg-gradient-to-br from-[#14142b] to-[#0a0a0f] rounded-xl border border-white/10 p-8 text-center">
              {isPinned && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">📌 Scheduled Session</h3>
                  <p className="text-gray-400 mb-4">
                    Starts in{' '}
                    {Math.ceil(
                      (new Date(ama.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    )}{' '}
                    days
                  </p>
                  <button className="px-8 py-4 bg-white/10 text-gray-400 rounded-lg cursor-not-allowed font-medium text-lg">
                    Chat Opens When Live
                  </button>
                </div>
              )}

              {isPending && (
                <div>
                  <h3 className="text-xl font-bold text-yellow-400 mb-4">⏳ Pending Approval</h3>
                  <p className="text-gray-400">This AMA request is waiting for admin review.</p>
                </div>
              )}

              {isEnded && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Session Ended</h3>
                  <p className="text-gray-400">
                    This AMA ended on{' '}
                    {new Date(ama.ended_at!).toLocaleDateString('en-US', {
                      dateStyle: 'long',
                    })}
                  </p>

                  {/* Show archived messages */}
                  {messages.length > 0 && (
                    <div className="mt-6 text-left">
                      <h4 className="text-lg font-semibold text-white mb-4">
                        Chat Archive ({messages.length} messages)
                      </h4>
                      <div className="max-h-96 overflow-y-auto space-y-3">
                        {messages.map((msg: any) => (
                          <div key={msg.id} className="p-3 bg-white/5 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`font-medium ${
                                  msg.is_host
                                    ? 'text-[#39AEC4]'
                                    : msg.is_developer
                                      ? 'text-indigo-400'
                                      : 'text-white'
                                }`}
                              >
                                {msg.username}
                              </span>
                              {msg.is_host && (
                                <span className="text-xs bg-[#39AEC4]/30 text-[#39AEC4] px-1 rounded">
                                  HOST
                                </span>
                              )}
                              {msg.is_developer && !msg.is_host && (
                                <span className="text-xs bg-indigo-500/30 text-indigo-300 px-1 rounded">
                                  DEV
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {new Date(msg.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-gray-300">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {ama.status === 'REJECTED' && (
                <div>
                  <h3 className="text-xl font-bold text-red-400 mb-4">Request Rejected</h3>
                  <p className="text-gray-400 mb-4">{ama.rejection_reason}</p>
                  <p className="text-sm text-gray-500">Refund has been processed.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
