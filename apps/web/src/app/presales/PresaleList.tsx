'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { LaunchRound } from '@selsipad/shared';
import { NetworkBadge } from '@/components/presale/NetworkBadge';
import { StatusPill } from '@/components/presale/StatusPill';

interface PresaleListProps {
  initialRounds: any[];
}

export function PresaleList({ initialRounds }: PresaleListProps) {
  const router = useRouter();
  const [rounds, setRounds] = useState(initialRounds);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    network: 'all',
    status: 'all',
    type: 'all',
    search: '',
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const fetchFilteredRounds = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.network !== 'all') params.append('network', filters.network);
        if (filters.status !== 'all') params.append('status', filters.status);
        if (filters.type !== 'all') params.append('type', filters.type);
        if (filters.search) params.append('search', filters.search);

        const response = await fetch(`/api/rounds?${params.toString()}`);
        const data = await response.json();
        setRounds(data.rounds || []);
      } catch (error) {
        console.error('Error fetching rounds:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchFilteredRounds, 300);
    return () => clearTimeout(debounce);
  }, [filters]);

  const calculateProgress = (raised: number, params: any) => {
    if (params.hardcap) {
      return Math.min((raised / params.hardcap) * 100, 100);
    }
    return 0;
  };

  const formatTimeRemaining = (endAt: string) => {
    const end = new Date(endAt);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  return (
    <div>
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search presales..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />

          {/* Network Filter */}
          <select
            value={filters.network}
            onChange={(e) => handleFilterChange('network', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Networks</option>
            <option value="EVM">EVM</option>
            <option value="SOLANA">Solana</option>
          </select>

          {/* Type Filter */}
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="PRESALE">Presale</option>
            <option value="FAIRLAUNCH">Fairlaunch</option>
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="LIVE">Live</option>
            <option value="ENDED">Ended</option>
            <option value="FINALIZED">Finalized</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 animate-pulse"
            >
              <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full mb-4" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && rounds.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
          <div className="text-gray-400 dark:text-gray-500 text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No presales found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your filters or check back later for new presales
          </p>
        </div>
      )}

      {/* Presale Cards Grid */}
      {!loading && rounds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rounds.map((round) => (
            <div
              key={round.id}
              onClick={() => router.push(`/presales/${round.id}`)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
            >
              {/* Header with Logo */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {round.projects?.logo_url ? (
                      <img
                        src={round.projects.logo_url}
                        alt={round.projects.name}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {round.projects?.symbol?.[0] || 'P'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {round.projects?.name || 'Unnamed Project'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {round.projects?.symbol || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 mb-4">
                  <NetworkBadge network={round.chain} />
                  <StatusPill status={round.status as any} />
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {round.type}
                  </span>
                </div>

                {/* Progress Bar */}
                {round.type === 'PRESALE' && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Progress</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {calculateProgress(round.total_raised, round.params).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${calculateProgress(round.total_raised, round.params)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                      <span>
                        {round.total_raised} {round.raise_asset}
                      </span>
                      <span>
                        {round.params.hardcap} {round.raise_asset}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Participants</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {round.total_participants}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Time Left</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatTimeRemaining(round.end_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-750 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {round.params.min_contribution && (
                    <>
                      Min: {round.params.min_contribution} {round.raise_asset}
                      {round.params.max_contribution && (
                        <>
                          {' '}
                          • Max: {round.params.max_contribution} {round.raise_asset}
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
