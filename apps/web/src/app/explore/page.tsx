'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  FilterPills,
  EmptyState,
  EmptyIcon,
  SkeletonCard,
} from '@/components/ui';
import { PageHeader, PageContainer, BottomSheet } from '@/components/layout';
import { getAllProjects, Project } from '@/lib/data/projects';
import type { FilterPill } from '@/components/ui';
import { ExploreProjectCard } from '@/components/explore/ExploreProjectCard';
import { Search, Filter, X } from 'lucide-react';

export default function ExplorePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterPill[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Load initial data
  useState(() => {
    getAllProjects().then((data) => {
      setProjects(data);
      setLoading(false);
    });
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    // TODO: Debounce and re-fetch
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id));
    // TODO: Re-fetch with updated filters
  };

  const clearFilters = () => {
    setFilters([]);
    // TODO: Re-fetch
  };

  return (
    <div className="min-h-screen bg-bg-page pb-20 relative overflow-hidden">
      <PageContainer className="relative z-10 pt-8 pb-12 space-y-8">
        {/* Hero Header */}
        <div className="text-center space-y-4 mb-12">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight"
          >
            <span className="animate-text-glow bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Explore Ecosystem
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 max-w-xl mx-auto text-lg"
          >
            Discover the next big opportunity on Selsipad. Verified, audited, and ready for launch.
          </motion.p>
        </div>

        {/* Search & Filter Bar */}
        <div className="sticky top-20 z-30 bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center gap-2 max-w-3xl mx-auto shadow-2xl shadow-indigo-500/10">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search projects by name, token, or contract..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-white/5 border border-transparent rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:bg-white/10 focus:border-indigo-500/50 transition-all outline-none"
            />
          </div>
          <button
            onClick={() => setFilterSheetOpen(true)}
            className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {/* Active Filters */}
        {filters.length > 0 && (
          <div className="flex justify-center">
            <FilterPills filters={filters} onRemove={removeFilter} onClearAll={clearFilters} />
          </div>
        )}

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="max-w-md mx-auto mt-12">
            <Card className="bg-white/5 border-white/10">
              <CardContent>
                <EmptyState
                  icon={<EmptyIcon />}
                  title="No projects found"
                  description="Try adjusting your filters or search query."
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {projects.map((project, index) => (
                <ExploreProjectCard key={project.id} project={project} index={index} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </PageContainer>

      {/* Filter Bottom Sheet */}
      <BottomSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filter Projects"
      >
        <div className="space-y-6 p-4">
          {/* Status Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
              Status
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(['live', 'upcoming', 'ended'] as const).map((status) => (
                <button
                  key={status}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-400 transition-all capitalize"
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Network Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
              Network
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(['SOL', 'EVM'] as const).map((network) => (
                <button
                  key={network}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-400 transition-all"
                >
                  {network}
                </button>
              ))}
            </div>
          </div>

          <button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02] transition-all">
            Apply Filters
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
