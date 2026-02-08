import Link from 'next/link';
import {
  Card,
  CardContent,
  StatusBadge,
  ProgressBar,
  EmptyState,
  EmptyIcon,
} from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { getTrendingProjects, getFeaturedProjects } from '@/lib/data/projects';
import { DashboardHeader } from '@/components/home/DashboardHeader';
import { Hero } from '@/components/home/Hero';
import { Footer } from '@/components/layout/Footer';

export default async function HomePage() {
  // Fetch data (server component)
  const [trending, featured] = await Promise.all([getTrendingProjects(), getFeaturedProjects()]);

  return (
    <div className="min-h-screen bg-bg-page pb-20">
      {/* Header */}
      <DashboardHeader />

      {/* Hero Section */}
      <Hero />

      <PageContainer className="py-6 space-y-8">
        {/* Trending Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-heading-lg text-text-primary">🔥 Trending</h2>
            <Link href="/explore" className="text-body-sm text-primary-main hover:underline">
              Lihat Semua
            </Link>
          </div>

          {trending.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<EmptyIcon />}
                  title="Belum ada project trending"
                  description="Jelajahi project yang tersedia"
                />
              </CardContent>
            </Card>
          ) : (
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              {trending.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className="flex-shrink-0 w-40"
                >
                  <Card hover className="h-full">
                    <CardContent className="space-y-2">
                      <div className="w-12 h-12 bg-bg-elevated rounded-lg flex items-center justify-center text-2xl">
                        {project.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-heading-sm truncate">{project.name}</h3>
                        <StatusBadge status={project.status} />
                      </div>
                      <div className="text-caption text-text-secondary">
                        {project.raised}/{project.target} {project.network}
                      </div>
                      <ProgressBar
                        value={project.raised}
                        max={project.target}
                        showPercentage={false}
                        size="sm"
                      />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Featured Section */}
        <section>
          <h2 className="text-heading-lg text-text-primary mb-4">Featured Projects</h2>

          <div className="space-y-4">
            {featured.map((project) => (
              <Link key={project.id} href={`/project/${project.id}`}>
                <Card hover>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-bg-elevated rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                        {project.symbol.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-heading-md">{project.name}</h3>
                          <StatusBadge status={project.status} />
                        </div>
                        <p className="text-body-sm text-text-secondary line-clamp-2">
                          {project.description}
                        </p>
                      </div>
                    </div>

                    <ProgressBar
                      value={project.raised}
                      max={project.target}
                      label={`${project.raised}/${project.target} ${project.network} Raised`}
                      showPercentage
                    />

                    <div className="flex gap-2">
                      {project.kyc_verified && (
                        <span className="px-2 py-1 bg-status-success-bg/50 text-status-success-text text-caption rounded-full border border-status-success-text/30">
                          ✓ KYC
                        </span>
                      )}
                      {project.audit_status === 'pass' && (
                        <span className="px-2 py-1 bg-status-success-bg/50 text-status-success-text text-caption rounded-full border border-status-success-text/30">
                          ✓ Audit
                        </span>
                      )}
                      {project.lp_lock && (
                        <span className="px-2 py-1 bg-status-success-bg/50 text-status-success-text text-caption rounded-full border border-status-success-text/30">
                          🔒 LP Lock
                        </span>
                      )}
                      <span className="px-2 py-1 bg-bg-elevated text-text-secondary text-caption rounded-full">
                        {project.network}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-4">
          <Link href="/explore">
            <Card hover className="h-full">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <svg
                  className="w-12 h-12 text-primary-main mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <h3 className="text-heading-sm">Jelajahi Projects</h3>
                <p className="text-caption text-text-secondary mt-1">Browse all projects</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/portfolio">
            <Card hover className="h-full">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <svg
                  className="w-12 h-12 text-primary-main mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <h3 className="text-heading-sm">Portfolio</h3>
                <p className="text-caption text-text-secondary mt-1">Your investments</p>
              </CardContent>
            </Card>
          </Link>
        </section>
      </PageContainer>

      {/* Footer */}
      <Footer />
    </div>
  );
}
