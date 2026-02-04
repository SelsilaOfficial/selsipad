'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  StatusBadge,
  ProgressBar,
  FilterPills,
  EmptyState,
  EmptyIcon,
  SkeletonCard,
} from '@/components/ui';
import { PageHeader, PageContainer, BottomSheet } from '@/components/layout';
import type { Project } from '@/lib/data/projects';
import type { FilterPill } from '@/components/ui';

interface ExploreClientContentProps {
  initialProjects: Project[];
}

export function ExploreClientContent({ initialProjects }: ExploreClientContentProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'ended'>('all');
  const [chainFilter, setChainFilter] = useState<'all' | 'EVM' | 'SOL'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'presale' | 'fairlaunch' | 'bonding'>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Filter projects client-side
  const filteredProjects = projects.filter((project) => {
    // 1. Search Filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !project.name.toLowerCase().includes(searchLower) &&
        !project.symbol.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // 2. Chain Filter
    if (chainFilter !== 'all' && project.network !== chainFilter) {
      return false;
    }

    // 3. Status Filter
    if (statusFilter !== 'all' && project.status !== statusFilter) {
      return false;
    }

    // 4. Type Filter (presale, fairlaunch, bonding curve)
    if (typeFilter !== 'all') {
      // Assuming project has a 'type' field from launch_rounds
      const projectType = (project as any).type?.toLowerCase();
      if (typeFilter === 'presale' && projectType !== 'presale') return false;
      if (typeFilter === 'fairlaunch' && projectType !== 'fairlaunch') return false;
      if (typeFilter === 'bonding' && projectType !== 'bonding_curve') return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-bg-page pb-20">
      <PageHeader
        title="Explore Projects"
        actions={
          <button
            onClick={() => setFilterSheetOpen(true)}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors lg:hidden"
          >
            {/* Mobile Filter Icon */}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        }
      />

      <PageContainer className="py-4 space-y-6">
        {/* Search & Desktop Filters */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type="search"
              placeholder="Cari project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg-input border border-border-subtle rounded-xl px-4 py-3 pl-11 text-text-primary placeholder:text-text-tertiary focus:border-primary-main focus:ring-1 focus:ring-primary-main transition-all shadow-sm"
            />
            <svg
              className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Quick Filters (Visible on all screens) */}
          <div className="flex flex-col gap-4">
             {/* Chain Selector */}
             <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">Network / Chain</label>
                <div className="flex gap-2 p-1 bg-bg-elevated rounded-lg w-max">
                  {(['all', 'EVM', 'SOL'] as const).map((chain) => (
                    <button
                      key={chain}
                      onClick={() => setChainFilter(chain)}
                      className={`
                        px-4 py-2 rounded-md text-sm font-medium transition-all active:scale-95
                        ${chainFilter === chain 
                          ? 'bg-bg-card shadow-sm text-primary-main border border-primary-main/20' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}
                      `}
                    >
                      {chain === 'all' ? 'All Chains' : chain === 'EVM' ? 'EVM (BSC/Base)' : 'Solana'}
                    </button>
                  ))}
                </div>
             </div>

             {/* Status Selector */}
             <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">Project Status</label>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'live', 'upcoming', 'ended'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`
                        px-3.5 py-2 rounded-full text-sm font-medium border transition-all active:scale-95
                        ${statusFilter === status
                          ? 'bg-primary-main/10 border-primary-main text-primary-main'
                          : 'bg-transparent border-border-subtle text-text-secondary hover:border-gray-500'}
                      `}
                    >
                      {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
             </div>
          </div>

          {/* Project Type Selector */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">Project Type</label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'presale', 'fairlaunch', 'bonding'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`
                    px-3.5 py-2 rounded-full text-sm font-medium border transition-all active:scale-95
                    ${typeFilter === type
                      ? 'bg-primary-main/10 border-primary-main text-primary-main'
                      : 'bg-transparent border-border-subtle text-text-secondary hover:border-gray-500'}
                  `}
                >
                  {type === 'all' ? 'All Types' : 
                   type === 'presale' ? 'Presale' : 
                   type === 'fairlaunch' ? 'Fairlaunch' :
                   'Bonding Curve'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<EmptyIcon />}
                title="Tidak ada project ditemukan"
                description="Coba ubah filter atau kata kunci pencarian"
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              // Route based on project type
              const detailPath = project.type === 'fairlaunch' 
                ? `/fairlaunch/${project.id}` 
                : project.type === 'presale'
                ? `/presale/${project.id}`
                : `/bonding/${project.id}`;
              
              return (
              <Link key={project.id} href={detailPath}>
                <Card hover className="h-full border-border-subtle group">
                  <CardContent className="space-y-4 p-5">
                    {/* Header: Logo & Status */}
                    <div className="flex items-start justify-between">
                      <div className="w-14 h-14 bg-bg-elevated rounded-xl flex items-center justify-center text-xl shadow-inner border border-white/5 group-hover:scale-105 transition-transform">
                        {project.logo && project.logo !== '/placeholder-logo.png' ? (
                           <img src={project.logo} alt={project.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                           <span className="font-bold text-gray-400">{project.symbol.slice(0, 2)}</span>
                        )}
                      </div>
                      <StatusBadge status={project.status} />
                    </div>

                    {/* Title & Desc */}
                    <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                           <h3 className="text-lg font-bold text-text-primary line-clamp-1 group-hover:text-primary-main transition-colors">{project.name}</h3>
                           {project.network === 'EVM' ? (
                              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">EVM</span>
                           ) : (
                              <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30">SOL</span>
                           )}
                           {/* Chain-specific badge */}
                           {project.network === 'EVM' && project.chain && (
                             <>
                               {(project.chain === '97' || project.chain === '56') && (
                                 <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/30 font-semibold">BNB</span>
                               )}
                               {(project.chain === '8453' || project.chain === '84532') && (
                                 <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 font-semibold">BASE</span>
                               )}
                               {(project.chain === '1' || project.chain === '11155111') && (
                                 <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/30 font-semibold">ETH</span>
                               )}
                             </>
                           )}
                        </div>
                        <p className="text-sm text-text-secondary line-clamp-2 min-h-[40px]">
                           {project.description}
                        </p>
                    </div>

                    {/* Progress */}
                    <div className="space-y-2 pt-2 border-t border-border-subtle/50">
                        <div className="flex justify-between text-xs font-medium">
                           <span className="text-text-secondary">Progress</span>
                           <span className="text-text-primary">
                              {((project.raised / project.target) * 100).toFixed(1)}%
                           </span>
                        </div>
                        <ProgressBar
                          value={project.raised}
                          max={project.target}
                          showPercentage={false}
                          size="sm"
                        />
                        <div className="flex justify-between text-xs text-text-tertiary">
                           <span>{project.raised} {
                             project.network === 'SOL' ? 'SOL' : 
                             (project.chain === '97' || project.chain === '56') ? 'BNB' : 
                             'ETH'
                           }</span>
                           <span>Soft {project.target}</span>
                        </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              );
            })}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
