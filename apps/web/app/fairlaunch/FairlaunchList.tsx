'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import type { PoolStatus } from '@selsipad/shared';
import { NetworkBadge } from '@/components/presale/NetworkBadge';
import { StatusPill } from '@/components/presale/StatusPill';

interface Fairlaunch {
  id: string;
  status: string;
  chain: string; // Changed from network to match DB schema
  params: any;
  created_at: string;
  start_at: string;
  end_at: string;
  total_raised: number;
  total_participants: number;
}

interface FairlaunchListProps {
  fairlaunches: Fairlaunch[];
}

// Helper to get native currency symbol from chain ID or network name
function getNativeCurrency(chainId?: string, networkName?: string): string {
  // Check by network name first
  if (networkName?.includes('bsc') || networkName?.includes('bnb')) {
    return 'BNB';
  }
  
  // Check by chain ID
  if (chainId === '97' || chainId === '56') {
    return 'BNB'; // BSC Testnet & Mainnet
  }
  if (chainId === '8453' || chainId === '84532') {
    return 'ETH'; // Base networks
  }
  if (chainId === '1' || chainId === '11155111') {
    return 'ETH'; // Ethereum Mainnet & Sepolia
  }
  
  return 'ETH'; // Default
}

// Helper to get chain badge color and label
function getChainBadge(chainId?: string, networkName?: string): { label: string; color: string } {
  const currency = getNativeCurrency(chainId, networkName);
  
  if (currency === 'BNB') {
    return { label: 'BNB', color: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' };
  }
  
  // Check if Base
  if (chainId === '8453' || chainId === '84532' || networkName?.includes('base')) {
    return { label: 'BASE', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' };
  }
  
  return { label: 'ETH', color: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' };
}

export function FairlaunchList({ fairlaunches: initialFairlaunches }: FairlaunchListProps) {
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFairlaunches = initialFairlaunches.filter((fl) => {
    // Network filter - use chain field from DB
    if (networkFilter !== 'ALL') {
      const chain = fl.chain || '';
      // Map chain ID to network type
      const isEVM = ['1', '11155111', '56', '97', '8453', '84532'].includes(chain);
      const isSolana = chain === 'SOLANA';
      
      if (networkFilter === 'EVM' && !isEVM) return false;
      if (networkFilter === 'SOLANA' && !isSolana) return false;
    }

    // Status filter
    if (statusFilter !== 'ALL' && fl.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (
      searchQuery &&
      !fl.params?.project_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Fairlaunch</h1>
          <p className="text-gray-400">No hardcap - final price determined by total raised</p>
        </div>
        <Link
          href="/create/fairlaunch"
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-semibold transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Fairlaunch
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Network Filter */}
        <div className="flex gap-2">
          {['ALL', 'EVM', 'SOLANA'].map((network) => (
            <button
              key={network}
              onClick={() => setNetworkFilter(network)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                networkFilter === network
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {network}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {['ALL', 'LIVE', 'ENDED', 'UPCOMING'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project name..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredFairlaunches.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-block p-6 bg-gray-800/30 rounded-full mb-4">
            <Plus className="w-12 h-12 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {initialFairlaunches.length === 0
              ? 'No fairlaunches yet'
              : 'No fairlaunches match your filters'}
          </h3>
          <p className="text-gray-400 mb-6">
            {initialFairlaunches.length === 0
              ? 'Be the first to create a fairlaunch'
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFairlaunches.map((fairlaunch) => (
            <FairlaunchCard key={fairlaunch.id} fairlaunch={fairlaunch} />
          ))}
        </div>
      )}
    </div>
  );
}

function FairlaunchCard({ fairlaunch }: { fairlaunch: Fairlaunch }) {
  const projectName = fairlaunch.params?.project_name || 'Unnamed Project';
  const softcap = fairlaunch.params?.softcap || 0;
  const raised = fairlaunch.total_raised || 0;
  const progress = softcap > 0 ? (raised / softcap) * 100 : 0;

  // Calculate time left
  const now = new Date();
  const endDate = new Date(fairlaunch.end_at);
  const timeLeft = endDate.getTime() - now.getTime();
  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <Link
      href={`/fairlaunch/${fairlaunch.id}`}
      className="block p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-green-500/50 transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {fairlaunch.params?.logo_url && (
            <img
              src={fairlaunch.params.logo_url}
              alt={projectName}
              className="w-12 h-12 rounded-lg object-cover mb-3"
            />
          )}
          <h3 className="text-lg font-bold text-white group-hover:text-green-400 transition-colors mb-2">
            {projectName}
          </h3>
          <div className="flex items-center gap-2">
            <NetworkBadge network={fairlaunch.params?.network_name || 'EVM'} chainId={fairlaunch.chain} />
            <StatusPill status={fairlaunch.status as PoolStatus} />
            {fairlaunch.params?.token_symbol && (
              <span className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">
                Token: {fairlaunch.params.token_symbol}
              </span>
            )}
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getChainBadge(fairlaunch.chain, fairlaunch.params?.network_name).color}`}>
              {getChainBadge(fairlaunch.chain, fairlaunch.params?.network_name).label}
            </span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Raised vs Softcap</span>
          <span className="text-white font-semibold">{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-600 to-emerald-600 transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{raised.toLocaleString()} {getNativeCurrency(fairlaunch.chain, fairlaunch.params?.network_name)}</span>
          <span>Soft {softcap.toLocaleString()} {getNativeCurrency(fairlaunch.chain, fairlaunch.params?.network_name)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-500">Participants</div>
          <div className="text-sm font-semibold text-white mt-1">
            {fairlaunch.total_participants || 0}
          </div>
        </div>
        {fairlaunch.status === 'LIVE' && timeLeft > 0 && (
          <div>
            <div className="text-xs text-gray-500">Time Left</div>
            <div className="text-sm font-semibold text-white mt-1">
              {daysLeft}d {hoursLeft}h
            </div>
          </div>
        )}
      </div>

      {/* Note */}
      <div className="pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-500">💡 Final price = Total Raised / Tokens For Sale</p>
      </div>
    </Link>
  );
}
