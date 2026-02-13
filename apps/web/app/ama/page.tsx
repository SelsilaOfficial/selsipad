import { getUpcomingAMAs, getLiveAMAs, getEndedAMAs } from './actions';
import { AMACard } from '@/components/ama/AMACard';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';
import Link from 'next/link';
import { ArrowLeft, Mic2, Radio, Calendar, Sparkles, History } from 'lucide-react';

// Force dynamic rendering for real-time AMA status
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AMAPage() {
  const [liveAMAs, upcomingAMAs, endedAMAs] = await Promise.all([
    getLiveAMAs(),
    getUpcomingAMAs(),
    getEndedAMAs(),
  ]);

  return (
    <div className="min-h-screen bg-black text-white dark relative overflow-hidden">
      {/* Animated Background Layer */}
      <AnimatedBackground />

      {/* Subtle Dark Overlay for Readability */}
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 max-w-7xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/" className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
                </Link>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold">AMA Sessions</h1>
                  <p className="text-xs text-gray-400">Developer Q&A Live</p>
                </div>
              </div>

              <Link
                href="/ama/submit"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/30 font-semibold text-sm"
              >
                <Mic2 className="w-4 h-4" />
                Host AMA
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 max-w-7xl space-y-8">
          {/* Live AMAs */}
          {liveAMAs.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-full bg-red-500/20 border border-red-500/30">
                  <Radio className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    Live Now
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  </h2>
                  <p className="text-xs text-gray-400">Join ongoing sessions</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {liveAMAs.map((ama: any) => (
                  <AMACard
                    key={ama.id}
                    id={ama.id}
                    projectName={ama.project_name}
                    description={ama.description}
                    scheduledAt={ama.scheduled_at}
                    developerName="Developer"
                    status="LIVE"
                    isLive={true}
                    type={ama.type || 'VOICE'}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming AMAs */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-full bg-[#39AEC4]/20 border border-[#39AEC4]/30">
                <Calendar className="w-5 h-5 text-[#39AEC4]" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Upcoming</h2>
                <p className="text-xs text-gray-400">Scheduled sessions</p>
              </div>
            </div>

            {upcomingAMAs.length === 0 ? (
              <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-8 sm:p-12 shadow-xl shadow-[#756BBA]/10 text-center min-h-[250px] flex flex-col items-center justify-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#39AEC4]/20 to-[#756BBA]/20 border border-[#39AEC4]/30 flex items-center justify-center mx-auto mb-4">
                  <Mic2 className="w-8 h-8 sm:w-10 sm:h-10 text-[#39AEC4]" />
                </div>
                <p className="text-lg font-bold mb-2">No Upcoming AMAs</p>
                <p className="text-sm text-gray-400">Check back later for scheduled sessions</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {upcomingAMAs.map((ama: any) => (
                  <AMACard
                    key={ama.id}
                    id={ama.id}
                    projectName={ama.project_name}
                    description={ama.description}
                    scheduledAt={ama.scheduled_at}
                    developerName="Developer"
                    status="PINNED"
                    type={ama.type || 'VOICE'}
                  />
                ))}
              </div>
            )}
          </section>

          {/* History / Past AMAs */}
          {endedAMAs.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-full bg-white/10 border border-white/20">
                  <History className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold">Past Sessions</h2>
                  <p className="text-xs text-gray-400">Browse completed AMAs</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {endedAMAs.map((ama: any) => (
                  <AMACard
                    key={ama.id}
                    id={ama.id}
                    projectName={ama.project_name}
                    description={ama.description}
                    scheduledAt={ama.scheduled_at}
                    developerName="Developer"
                    status="ENDED"
                    type={ama.type || 'VOICE'}
                    messageCount={ama.message_count}
                  />
                ))}
              </div>
            </section>
          )}

          {/* CTA Section */}
          <section className="rounded-[20px] bg-gradient-to-br from-[#39AEC4]/10 to-[#756BBA]/10 backdrop-blur-xl border border-[#39AEC4]/30 p-6 sm:p-10 shadow-xl shadow-[#756BBA]/20 text-center relative overflow-hidden">
            {/* Decorative glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#756BBA]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#39AEC4]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="relative z-10">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#39AEC4] to-[#756BBA] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#756BBA]/30">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-2">Host Your Own AMA</h3>
              <p className="text-gray-300 mb-2 text-sm sm:text-base">
                Connect with your community through live Q&A sessions
              </p>
              <p className="text-[#39AEC4] text-sm mb-6">
                ⏱️ 60 minutes session • 💰 $100 USD fee (paid in BNB via Chainlink pricing)
              </p>
              <Link
                href="/ama/submit"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/50 font-bold text-base"
              >
                <Mic2 className="w-5 h-5" />
                Submit AMA Request
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
