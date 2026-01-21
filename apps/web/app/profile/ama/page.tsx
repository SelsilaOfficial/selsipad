import { getServerSession } from '@/lib/auth/session';
import { getMyAMAs } from '@/app/ama/actions';
import { PageHeader, PageContainer } from '@/components/layout';
import { redirect } from 'next/navigation';

export default async function MyAMAsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/');
  }

  const myAMAs = await getMyAMAs();

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
      <PageHeader title="My AMAs" backUrl="/profile" />

      <PageContainer className="py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Your AMA Sessions</h2>
          <a
            href="/ama/submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + New AMA
          </a>
        </div>

        {/* AMA List */}
        {myAMAs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No AMAs Yet</h3>
            <p className="text-gray-600 mb-6">Create your first AMA session</p>
            <a
              href="/ama/submit"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create AMA
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {myAMAs.map((ama) => (
              <div key={ama.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{ama.title}</h3>
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-medium ${
                          statusColors[ama.status as keyof typeof statusColors]
                        }`}
                      >
                        {ama.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{ama.projects.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(ama.scheduled_at).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {ama.status === 'APPROVED' && (
                      <form action={`/api/ama/${ama.id}/start`} method="POST">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          Start
                        </button>
                      </form>
                    )}

                    {ama.status === 'LIVE' && (
                      <form action={`/api/ama/${ama.id}/end`} method="POST">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          End
                        </button>
                      </form>
                    )}

                    {['SUBMITTED', 'PAID', 'APPROVED'].includes(ama.status) && (
                      <form action={`/api/ama/${ama.id}/cancel`} method="POST">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </form>
                    )}

                    <a
                      href={`/ama/${ama.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      View
                    </a>
                  </div>
                </div>

                {ama.description && (
                  <p className="text-gray-700 text-sm line-clamp-2">{ama.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
