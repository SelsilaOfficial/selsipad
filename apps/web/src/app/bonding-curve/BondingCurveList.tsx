'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, TrendingUp } from 'lucide-react';
import { StatusPill } from '@/components/presale/StatusPill';

interface BondingPool {
  id: string;
  status: string;
  token_name: string;
  token_symbol: string;
  token_mint: string;
  actual_sol_reserves: number;
  graduation_threshold_sol: number;
  swap_fee_bps: number;
  created_at: string;
}

interface BondingCurveListProps {
  pools: BondingPool[];
}

export function BondingCurveList({ pools: initialPools }: BondingCurveListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'volume'>('newest');

  const filteredPools = initialPools.filter((pool) => {
    // Status filter
    if (statusFilter !== 'ALL' && pool.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        pool.token_name?.toLowerCase().includes(query) ||
        pool.token_symbol?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Sort (simplified - volume would need additional data)
  const sortedPools = [...filteredPools].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Bonding Curve</h1>
          <p className="text-gray-400">Permissionless token launch on Solana</p>
        </div>
        <Link
          href="/create/bonding-curve"
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-semibold transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Pool
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Status Filter */}
        <div className="flex gap-2">
          {['ALL', 'LIVE', 'GRADUATED', 'GRADUATING'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('newest')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              sortBy === 'newest'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Newest
          </button>
          <button
            onClick={() => setSortBy('volume')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              sortBy === 'volume'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Volume
          </button>
        </div>

        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by token name or symbol..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      {sortedPools.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-block p-6 bg-gray-800/30 rounded-full mb-4">
            <TrendingUp className="w-12 h-12 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {initialPools.length === 0
              ? 'No bonding curve pools yet'
              : 'No pools match your filters'}
          </h3>
          <p className="text-gray-400 mb-6">
            {initialPools.length === 0
              ? 'Be the first to create a permissionless pool'
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPools.map((pool) => (
            <PoolCard key={pool.id} pool={pool} />
          ))}
        </div>
      )}
    </div>
  );
}

function PoolCard({ pool }: { pool: BondingPool }) {
  const solRaised = pool.actual_sol_reserves / 1e9; // Convert lamports to SOL
  const threshold = pool.graduation_threshold_sol / 1e9;
  const progress = threshold > 0 ? (solRaised / threshold) * 100 : 0;
  const swapFee = pool.swap_fee_bps / 100; // Convert bps to percentage

  return (
    <Link
      href={`/bonding-curve/${pool.id}`}
      className="block p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500/50 transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-2">
            {pool.token_name || 'Unnamed Token'}
          </h3>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono text-gray-400">
              {pool.token_symbol || 'UNKNOWN'}
            </span>
            <StatusPill status={pool.status as any} />
          </div>
          <div className="text-xs text-gray-500 font-mono truncate">
            {pool.token_mint?.slice(0, 8)}...{pool.token_mint?.slice(-8)}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-500">SOL Raised</div>
          <div className="text-sm font-semibold text-white mt-1">{solRaised.toFixed(2)} SOL</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Swap Fee</div>
          <div className="text-sm font-semibold text-white mt-1">{swapFee}%</div>
        </div>
      </div>

      {/* Graduation Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Graduation</span>
          <span className="text-white font-semibold">{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-cyan-600 transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{solRaised.toFixed(2)}</span>
          <span>{threshold.toFixed(2)} SOL</span>
        </div>
      </div>

      {/* Info */}
      <div className="pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-500">⚡ Permissionless • 💰 1.5% fee (50/50 split)</p>
      </div>
    </Link>
  );
}
