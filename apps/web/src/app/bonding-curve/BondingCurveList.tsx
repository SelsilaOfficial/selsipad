'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, TrendingUp, ArrowLeft } from 'lucide-react';
import { StatusPill } from '@/components/presale/StatusPill';

interface BondingPool {
  id: string;
  status: string;
  token_name: string;
  token_symbol: string;
  token_address: string;
  actual_native_reserves: number;
  graduation_threshold_native: number;
  swap_fee_bps: number;
  created_at: string;
  logo_url?: string;
  banner_url?: string;
  description?: string;
}

interface BondingCurveListProps {
  pools: BondingPool[];
}

export function BondingCurveList({ pools: initialPools }: BondingCurveListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'volume'>('newest');

  const filteredPools = initialPools.filter((pool) => {
    if (statusFilter !== 'ALL' && pool.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        pool.token_name?.toLowerCase().includes(query) ||
        pool.token_symbol?.toLowerCase().includes(query)
      );
    }
    return true;
  });

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
        <div className="flex items-center gap-3">
          <Link href="/explore" className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Bonding Curve</h1>
            <p className="text-gray-400 text-sm">Permissionless token launch on BSC</p>
          </div>
        </div>
        <Link
          href="/create/bonding-curve"
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:opacity-90 text-white rounded-xl font-semibold transition-all shadow-lg shadow-[#39AEC4]/20"
        >
          <Plus className="w-5 h-5" />
          Create Token
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          {['ALL', 'LIVE', 'GRADUATED', 'GRADUATING'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                statusFilter === status
                  ? 'bg-[#39AEC4]/20 text-[#39AEC4] border border-[#39AEC4]/50'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('newest')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              sortBy === 'newest'
                ? 'bg-[#39AEC4]/20 text-[#39AEC4] border border-[#39AEC4]/50'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            Newest
          </button>
          <button
            onClick={() => setSortBy('volume')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              sortBy === 'volume'
                ? 'bg-[#39AEC4]/20 text-[#39AEC4] border border-[#39AEC4]/50'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            Volume
          </button>
        </div>

        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by token name or symbol..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#39AEC4]/50 focus:border-[#39AEC4]"
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
              ? 'Be the first to create a token!'
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
  const bnbRaised = Number(pool.actual_native_reserves || 0) / 1e18;
  const threshold = Number(pool.graduation_threshold_native || 0) / 1e18;
  const progress = threshold > 0 ? (bnbRaised / threshold) * 100 : 0;
  const swapFee = (pool.swap_fee_bps || 0) / 100;

  return (
    <Link
      href={`/bonding-curve/${pool.id}`}
      className="block rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 hover:border-[#39AEC4]/50 transition-all group overflow-hidden shadow-xl hover:shadow-[#39AEC4]/10"
    >
      {/* Banner Hero */}
      <div className="relative">
        <div className="h-32 overflow-hidden">
          {pool.banner_url ? (
            <img src={pool.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#39AEC4]/30 via-[#756BBA]/20 to-black/60" />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>
        
        {/* Status pill on top-right */}
        <div className="absolute top-3 right-3">
          <StatusPill status={pool.status as any} />
        </div>

        {/* Logo overlapping bottom-left */}
        <div className="absolute -bottom-5 left-4">
          {pool.logo_url ? (
            <img src={pool.logo_url} alt={pool.token_symbol} className="w-14 h-14 rounded-2xl object-cover border-2 border-gray-900 shadow-lg" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#39AEC4] to-[#756BBA] flex items-center justify-center font-bold text-2xl text-white border-2 border-gray-900 shadow-lg">
              {pool.token_symbol?.charAt(0) || '?'}
            </div>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="px-5 pt-8 pb-5">
        {/* Token Name & Symbol */}
        <h3 className="text-lg font-bold text-white group-hover:text-[#39AEC4] transition-colors truncate">
          {pool.token_name || 'Unnamed Token'}
        </h3>
        <span className="text-sm font-mono text-[#39AEC4]">${pool.token_symbol || 'TKN'}</span>

        {pool.description && (
          <p className="text-xs text-gray-400 mt-2 line-clamp-2">{pool.description}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4 mb-4">
          <div className="bg-black/30 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">BNB Raised</div>
            <div className="text-sm font-bold text-white mt-0.5">{bnbRaised.toFixed(4)} BNB</div>
          </div>
          <div className="bg-black/30 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Swap Fee</div>
            <div className="text-sm font-bold text-white mt-0.5">{swapFee}%</div>
          </div>
        </div>

        {/* Graduation Progress */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-400">Graduation</span>
            <span className="text-[#39AEC4] font-bold">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>{bnbRaised.toFixed(4)}</span>
            <span>{threshold.toFixed(1)} BNB</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/5 bg-black/20">
        <p className="text-[10px] text-gray-500 whitespace-nowrap truncate">⚡ Bonding Curve • 💰 {swapFee}% fee • 🔄 Auto-migration</p>
      </div>
    </Link>
  );
}
