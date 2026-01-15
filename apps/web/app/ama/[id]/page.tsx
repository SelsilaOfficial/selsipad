import { createClient } from '@/lib/supabase/server';
import { PageHeader, PageContainer } from '@/components/layout';
import { notFound } from 'next/navigation';

export default async function AMADetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // Fetch AMA details
  const { data: ama } = await supabase
    .from('ama_sessions')
    .select(
      `
      *,
      projects (
        name,
        logo_url,
        description
      )
    `
    )
    .eq('id', params.id)
    .single();

  if (!ama) {
    notFound();
  }

  // Fetch host profile
  const { data: host } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_url, bluecheck_status')
    .eq('user_id', ama.host_id)
    .single();

  const isLive = ama.status === 'LIVE';
  const isEnded = ama.status === 'ENDED';
  const isUpcoming = ama.status === 'APPROVED';

  const statusColors = {
    SUBMITTED: 'bg-gray-100 text-gray-800',
    PAID: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    LIVE: 'bg-red-100 text-red-800',
    ENDED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-600',
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="AMA Session" backUrl="/ama" />

      <PageContainer className="py-6">
        <div className="max-w-4xl mx-auto">
          {/* Header Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
            {/* Status Badge */}
            {isLive && (
              <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2 bg-red-100 text-red-800 rounded-full inline-flex mx-auto">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="font-bold">LIVE NOW</span>
              </div>
            )}

            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">{ama.title}</h1>

            {/* Project Info */}
            <div className="flex items-center justify-center gap-3 mb-6">
              {ama.projects.logo_url && (
                <img
                  src={ama.projects.logo_url}
                  alt={ama.projects.name}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div className="text-center">
                <p className="font-semibold text-gray-900">{ama.projects.name}</p>
                <p className="text-sm text-gray-600">{ama.projects.description}</p>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Type</p>
                <p className="font-semibold text-gray-900">{ama.type}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    statusColors[ama.status as keyof typeof statusColors]
                  }`}
                >
                  {ama.status}
                </span>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Scheduled</p>
                <p className="font-semibold text-gray-900">
                  {new Date(ama.scheduled_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(ama.scheduled_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Host</p>
                <div className="flex items-center justify-center gap-1">
                  <p className="font-semibold text-gray-900">{host?.username || 'Unknown'}</p>
                  {(host?.bluecheck_status === 'VERIFIED' ||
                    host?.bluecheck_status === 'ACTIVE') && (
                    <span className="text-blue-500">✓</span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {ama.description && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-semibold text-gray-900 mb-2">About This AMA</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{ama.description}</p>
              </div>
            )}
          </div>

          {/* Join/Status Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            {isLive && ama.type === 'TEXT' && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Join the Discussion</h3>
                <p className="text-gray-600 mb-6">
                  Ask questions and interact with {host?.username}
                </p>
                <button className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg">
                  Join Text Chat
                </button>
              </div>
            )}

            {isLive && (ama.type === 'VOICE' || ama.type === 'VIDEO') && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Get Access Link</h3>
                <p className="text-gray-600 mb-6">Join the live {ama.type.toLowerCase()} session</p>
                <button className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg">
                  Get {ama.type} Link
                </button>
              </div>
            )}

            {isUpcoming && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Upcoming Session</h3>
                <p className="text-gray-600 mb-4">
                  Starts in{' '}
                  {Math.ceil(
                    (new Date(ama.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  )}{' '}
                  days
                </p>
                <button className="px-8 py-4 bg-gray-200 text-gray-600 rounded-lg cursor-not-allowed font-medium text-lg">
                  Not Started Yet
                </button>
              </div>
            )}

            {isEnded && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Session Ended</h3>
                <p className="text-gray-600">
                  This AMA ended on{' '}
                  {new Date(ama.ended_at!).toLocaleDateString('en-US', {
                    dateStyle: 'long',
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
