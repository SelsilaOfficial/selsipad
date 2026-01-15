import { getUpcomingAMAs, getLiveAMAs } from './actions';
import { AMACard } from '@/components/ama/AMACard';
import { PageHeader, PageContainer } from '@/components/layout';

export default async function AMAPage() {
  const [liveAMAs, upcomingAMAs] = await Promise.all([getLiveAMAs(), getUpcomingAMAs()]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="AMA Sessions" />

      <PageContainer className="py-6 space-y-8">
        {/* Live AMAs */}
        {liveAMAs.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">🔴 Live Now</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveAMAs.map((ama) => (
                <AMACard key={ama.id} ama={ama} />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming AMAs */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">📅 Upcoming</h2>
          {upcomingAMAs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-600 mb-4">No upcoming AMAs scheduled</p>
              <a
                href="/ama/submit"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create AMA
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingAMAs.map((ama) => (
                <AMACard key={ama.id} ama={ama} />
              ))}
            </div>
          )}
        </section>

        {/* CTA for Developers */}
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-2">Host Your Own AMA</h3>
          <p className="mb-6 opacity-90">Connect with your community through live Q&A sessions</p>
          <a
            href="/ama/submit"
            className="inline-block px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Submit AMA Request
          </a>
        </section>
      </PageContainer>
    </div>
  );
}
