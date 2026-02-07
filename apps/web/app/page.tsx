import { PageContainer } from '@/components/layout';
import { PageBackground } from '@/components/home/PageBackground';
import { DashboardHeader } from '@/components/home/DashboardHeader';
import { DashboardCombinedGrid } from '@/components/home/DashboardCombinedGrid';
import { StatsRow } from '@/components/home/StatsRow';
import { Footer } from '@/components/layout/Footer';

export default async function HomePage() {
  return (
    <div className="min-h-screen relative font-sans selection:bg-indigo-500/30 flex flex-col">
      <PageBackground />

      <DashboardHeader />

      <main className="relative flex-1">
        <PageContainer>
          <div className="py-8">
            <h1 className="sr-only">Selsipad Dashboard</h1>

            {/* Combined Trending + Quick Actions Grid */}
            <DashboardCombinedGrid />

            {/* Bottom Stats */}
            <StatsRow />
          </div>
        </PageContainer>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
