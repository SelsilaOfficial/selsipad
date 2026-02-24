'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, TrendingUp, Lock } from 'lucide-react';
import { StatusPill } from '@/components/presale/StatusPill';
import {
  FeeSplitDisplay,
  GraduationProgress,
  DEXMigrationDetails,
} from '@/components/bonding/DEXSelector';

interface BondingPool {
  id: string;
  status: string;
  token_name: string;
  token_symbol: string;
  token_address: string;
  token_decimals: number;
  total_supply: number;
  virtual_native_reserves: number;
  virtual_token_reserves: number;
  actual_native_reserves: number;
  actual_token_reserves: number;
  deploy_fee_native: number;
  swap_fee_bps: number;
  graduation_threshold_native: number;
  target_dex: string;
  created_at: string;
  deployed_at: string;
}

interface BondingCurveDetailProps {
  pool: BondingPool;
  userAddress?: string;
}

type TabType = 'overview' | 'chart' | 'swap' | 'trades' | 'transactions';

export function BondingCurveDetail({ pool, userAddress }: BondingCurveDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Calculate metrics
  const solRaised = (pool.actual_native_reserves || 0) / 1e18;
  const threshold = (pool.graduation_threshold_native || 0) / 1e18;
  const progress = threshold > 0 ? (solRaised / threshold) * 100 : 0;
  const swapFee = (pool.swap_fee_bps || 0) / 100;

  // Price calculation (simplified - actual would use bonding curve formula)
  const currentPrice =
    (pool.virtual_native_reserves || 0) > 0 && (pool.virtual_token_reserves || 0) > 0
      ? pool.virtual_native_reserves / pool.virtual_token_reserves / 1e18
      : 0;

  const tabs: { key: TabType; label: string; enabled: boolean }[] = [
    { key: 'overview', label: 'Overview', enabled: true },
    { key: 'chart', label: 'Chart', enabled: true },
    { key: 'swap', label: 'Swap', enabled: pool.status === 'LIVE' },
    { key: 'trades', label: 'Trades', enabled: true },
    { key: 'transactions', label: 'Transactions', enabled: !!userAddress },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Button */}
      <Link
        href="/bonding-curve"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pools
      </Link>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {pool.token_name || 'Unnamed Token'}
            </h1>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-lg font-mono text-gray-400">
                {pool.token_symbol || 'UNKNOWN'}
              </span>
              <StatusPill status={pool.status as any} />
            </div>
            <div className="text-sm font-mono text-gray-500">
              Contract: {pool.token_address?.slice(0, 12)}...{pool.token_address?.slice(-12)}
              <a
                href={`https://testnet.bscscan.com/address/${pool.token_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-2 text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Current Price</div>
            <div className="text-xl font-bold text-white">{currentPrice.toFixed(8)} BNB</div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">BNB Raised</div>
            <div className="text-xl font-bold text-white">{solRaised.toFixed(4)} BNB</div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Swap Fee</div>
            <div className="text-xl font-bold text-white">{swapFee}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Target DEX</div>
            <div className="text-xl font-bold text-white">{pool.target_dex || 'TBA'}</div>
          </div>
        </div>

        {/* Graduation Progress */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Graduation Progress</span>
            <span className="text-white font-semibold">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-600 transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Raised: {solRaised.toFixed(4)} BNB</span>
            <span className="text-gray-500">Target: {threshold.toFixed(4)} BNB</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-800">
        <div className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => tab.enabled && setActiveTab(tab.key)}
              disabled={!tab.enabled}
              className={`pb-3 px-1 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : tab.enabled
                    ? 'text-gray-500 hover:text-gray-300'
                    : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        {activeTab === 'overview' && <OverviewTab pool={pool} />}
        {activeTab === 'chart' && <ChartTab />}
        {activeTab === 'swap' && <SwapTab userAddress={userAddress} />}
        {activeTab === 'trades' && <TradesTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
      </div>
    </div>
  );
}

function OverviewTab({ pool }: { pool: BondingPool }) {
  const deployFee = (pool.deploy_fee_native || 0) / 1e18;
  const swapFee = (pool.swap_fee_bps || 0) / 100;

  return (
    <div className="space-y-6">
      {/* Graduation Progress */}
      <GraduationProgress
        actualSol={(pool.actual_native_reserves || 0).toString()}
        thresholdSol={(pool.graduation_threshold_native || 0).toString()}
        status={pool.status}
      />

      {/* Fee Split Display */}
      <FeeSplitDisplay
        swapFeeBps={pool.swap_fee_bps}
        totalVolume={(pool.actual_native_reserves || 0).toString()}
      />

      {/* DEX Migration Info */}
      <DEXMigrationDetails targetDex={pool.target_dex} status={pool.status} />

      {/* Bonding Curve Mechanics */}
      <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">⚡ Bonding Curve Mechanics</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-blue-400 font-bold">•</span>
            <div>
              <p className="text-white font-medium">Permissionless Launch</p>
              <p className="text-gray-400">No KYC required • Team vesting mandatory</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-400 font-bold">•</span>
            <div>
              <p className="text-white font-medium">Constant Product AMM</p>
              <p className="text-gray-400 font-mono text-xs">x * y = k (with virtual reserves)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-400 font-bold">•</span>
            <div>
              <p className="text-white font-medium">Automatic Graduation</p>
              <p className="text-gray-400">
                When target BNB reached → migrate to {pool.target_dex || 'DEX'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fees */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">💰 Fees</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Deploy Fee</div>
            <div className="text-xl font-bold text-white">{deployFee} BNB</div>
            <div className="text-xs text-gray-500 mt-1">One-time</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Swap Fee</div>
            <div className="text-xl font-bold text-white">{swapFee}%</div>
            <div className="text-xs text-gray-500 mt-1">100% Protocol</div>
          </div>
        </div>
      </div>

      {/* LP Lock Requirement */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Lock className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">🔒 LP Lock Requirement</h3>
            <p className="text-gray-400 text-sm">
              After graduation, LP tokens will be locked for{' '}
              <span className="text-white font-semibold">minimum 12 months</span> to ensure
              liquidity stability.
            </p>
          </div>
        </div>
      </div>

      {/* Reserves */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">📊 Reserves</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Virtual Reserves (AMM)</div>
            <div className="space-y-1 text-sm">
              <div>BNB: {((pool.virtual_native_reserves || 0) / 1e18).toFixed(4)}</div>
              <div>Token: {((pool.virtual_token_reserves || 0) / 1e18).toFixed(4)}</div>
            </div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Actual Reserves</div>
            <div className="space-y-1 text-sm">
              <div>BNB: {((pool.actual_native_reserves || 0) / 1e18).toFixed(4)}</div>
              <div>Token: {((pool.actual_token_reserves || 0) / 1e18).toFixed(4)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Info */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">🪙 Token Info</h3>
        <div className="p-4 bg-gray-800 rounded-lg space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Supply</span>
            <span className="text-white font-mono">
              {(pool.total_supply / Math.pow(10, pool.token_decimals)).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Decimals</span>
            <span className="text-white font-mono">{pool.token_decimals}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Created</span>
            <span className="text-white">{new Date(pool.created_at).toLocaleDateString()}</span>
          </div>
          {pool.deployed_at && (
            <div className="flex justify-between">
              <span className="text-gray-400">Deployed</span>
              <span className="text-white">{new Date(pool.deployed_at).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartTab() {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📈</div>
      <h3 className="text-xl font-semibold text-white mb-2">Chart Coming Soon</h3>
      <p className="text-gray-400">Candlestick chart with timeframes will be available soon</p>
    </div>
  );
}

function SwapTab({ userAddress }: { userAddress?: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">💱</div>
      <h3 className="text-xl font-semibold text-white mb-2">Swap Panel Coming Soon</h3>
      <p className="text-gray-400">
        {userAddress
          ? 'BUY/SELL swap functionality will be available after smart contract integration'
          : 'Connect your Solana wallet to swap'}
      </p>
    </div>
  );
}

function TradesTab() {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📝</div>
      <h3 className="text-xl font-semibold text-white mb-2">Recent Trades</h3>
      <p className="text-gray-400">Trade history will appear here</p>
    </div>
  );
}

function TransactionsTab() {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">🔗</div>
      <h3 className="text-xl font-semibold text-white mb-2">Your Transactions</h3>
      <p className="text-gray-400">Your transaction history will appear here</p>
    </div>
  );
}
