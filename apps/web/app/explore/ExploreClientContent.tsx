'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Filter, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';
import { ExploreProjectCard } from '@/components/explore/ExploreProjectCard';
import type { Project } from '@/lib/data/projects';
import { Card, CardContent, EmptyState, EmptyIcon } from '@/components/ui';

type NetworkType = 'All' | 'EVM' | 'Solana';
type StatusType = 'All' | 'Upcoming' | 'Live' | 'Ended';
type ProjectType = 'All' | 'Presale' | 'Fairlaunch' | 'Bonding Curve';

interface ExploreClientContentProps {
  initialProjects: Project[];
}

export function ExploreClientContent({ initialProjects }: ExploreClientContentProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>('All');
  const [selectedStatus, setSelectedStatus] = useState<StatusType>('All');
  const [selectedType, setSelectedType] = useState<ProjectType>('All');
  const [showFilters, setShowFilters] = useState(false);

  // Filter projects
  const filteredProjects = useMemo(() => {
    return initialProjects.filter((project) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        project.name.toLowerCase().includes(searchLower) ||
        project.symbol.toLowerCase().includes(searchLower) ||
        project.description.toLowerCase().includes(searchLower);

      // Network filter
      let matchesNetwork = true;
      if (selectedNetwork === 'EVM') matchesNetwork = project.network === 'EVM';
      if (selectedNetwork === 'Solana') matchesNetwork = project.network === 'SOL';

      // Status filter
      let matchesStatus = true;
      if (selectedStatus !== 'All') {
        matchesStatus = project.status === selectedStatus.toLowerCase();
      }

      // Type filter
      let matchesType = true;
      if (selectedType !== 'All') {
        // Map 'Bonding Curve' to matching type if it existed, currently only presale/fairlaunch
        if (selectedType === 'Bonding Curve') {
          // Assuming 'bonding_curve' doesn't exist yet in Project type, so strict check might fail or return false
          // safe cast as any if needs checking unknown types
          matchesType = (project as any).type === 'bonding_curve';
        } else {
          matchesType = project.type === selectedType.toLowerCase();
        }
      }

      return matchesSearch && matchesNetwork && matchesStatus && matchesType;
    });
  }, [initialProjects, searchQuery, selectedNetwork, selectedStatus, selectedType]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedNetwork('All');
    setSelectedStatus('All');
    setSelectedType('All');
  };

  const hasActiveFilters =
    searchQuery || selectedNetwork !== 'All' || selectedStatus !== 'All' || selectedType !== 'All';

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Background Layer */}
      <AnimatedBackground />

      {/* Subtle Dark Overlay for Readability */}
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              {/* Back Button & Title */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/')}
                  className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
                </button>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold">Explore Launchpad</h1>
                  <p className="text-xs text-gray-400">{filteredProjects.length} projects found</p>
                </div>
              </div>

              {/* Filter Toggle (Mobile) */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors"
              >
                <Filter className="w-5 h-5 text-[#39AEC4]" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-3 sm:mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects by name, symbol, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-[16px] bg-white/5 backdrop-blur-xl border border-[#39AEC4]/20 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#39AEC4]/40 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[#39AEC4]/10 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Network Toggle */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Network</label>
                  <div className="flex items-center gap-1 bg-white/5 rounded-[12px] p-1 border border-[#39AEC4]/20">
                    <button
                      onClick={() => setSelectedNetwork('All')}
                      className={`flex-1 px-3 py-2 rounded-[8px] text-xs font-semibold transition-all ${
                        selectedNetwork === 'All'
                          ? 'bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSelectedNetwork('EVM')}
                      className={`flex-1 px-3 py-2 rounded-[8px] text-xs font-semibold transition-all ${
                        selectedNetwork === 'EVM'
                          ? 'bg-gradient-to-r from-[#39AEC4] to-[#4EABC8] text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      EVM
                    </button>
                    <button
                      onClick={() => setSelectedNetwork('Solana')}
                      className={`flex-1 px-3 py-2 rounded-[8px] text-xs font-semibold transition-all ${
                        selectedNetwork === 'Solana'
                          ? 'bg-gradient-to-r from-[#756BBA] to-[#8B7FD8] text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Solana
                    </button>
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as StatusType)}
                    className="w-full px-3 py-2 rounded-[12px] bg-white/5 backdrop-blur-xl border border-[#39AEC4]/20 text-white text-xs font-semibold focus:outline-none focus:border-[#39AEC4]/40 transition-colors cursor-pointer appearance-none"
                    style={{ backgroundImage: 'none' }}
                  >
                    <option value="All" className="bg-black text-white">
                      All Status
                    </option>
                    <option value="Upcoming" className="bg-black text-white">
                      Upcoming
                    </option>
                    <option value="Live" className="bg-black text-white">
                      Live
                    </option>
                    <option value="Ended" className="bg-black text-white">
                      Ended
                    </option>
                  </select>
                </div>

                {/* Project Type Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Project Type</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as ProjectType)}
                    className="w-full px-3 py-2 rounded-[12px] bg-white/5 backdrop-blur-xl border border-[#39AEC4]/20 text-white text-xs font-semibold focus:outline-none focus:border-[#39AEC4]/40 transition-colors cursor-pointer appearance-none"
                    style={{ backgroundImage: 'none' }}
                  >
                    <option value="All" className="bg-black text-white">
                      All Types
                    </option>
                    <option value="Presale" className="bg-black text-white">
                      Presale
                    </option>
                    <option value="Fairlaunch" className="bg-black text-white">
                      Fairlaunch
                    </option>
                    <option value="Bonding Curve" className="bg-black text-white">
                      Bonding Curve
                    </option>
                  </select>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <div className="flex items-end">
                    <button
                      onClick={clearFilters}
                      className="w-full px-4 py-2 rounded-[12px] bg-gradient-to-r from-[#39AEC4]/20 to-[#756BBA]/20 border border-[#39AEC4]/30 hover:from-[#39AEC4]/30 hover:to-[#756BBA]/30 transition-all text-xs font-semibold flex items-center justify-center gap-2 h-[34px]"
                    >
                      <X className="w-4 h-4" />
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12">
          {/* Projects Grid */}
          {filteredProjects.length > 0 ? (
            <motion.div layout className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {filteredProjects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ExploreProjectCard project={project} index={index} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#39AEC4]/20 to-[#756BBA]/20 border border-[#39AEC4]/30 flex items-center justify-center mb-4">
                <Search className="w-10 h-10 text-[#39AEC4]/50" />
              </div>
              <h3 className="text-xl font-bold mb-2">No Projects Found</h3>
              <p className="text-sm text-gray-400 mb-6 text-center max-w-md">
                We couldn't find any projects matching your search criteria. Try adjusting your
                filters.
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/30 font-semibold"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
