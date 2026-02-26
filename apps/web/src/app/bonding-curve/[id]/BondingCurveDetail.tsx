'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, ExternalLink, Copy, Lock, Flame, Trophy, Users, Droplet, Globe, Twitter, MessageCircle } from 'lucide-react';
import { StatusPill } from '@/components/presale/StatusPill';
import { SwapPanel } from '@/components/bonding/SwapPanel';
import { RecentTradesTable } from '@/components/bonding/RecentTradesTable';
import { UserTransactionsTable } from '@/components/bonding/UserTransactionsTable';
import { TopHoldersList } from '@/components/bonding/TopHoldersList';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid as RechartsGrid } from 'recharts';
import { useBnbPrice } from '@/hooks/useBnbPrice';

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
  logo_url?: string;
  banner_url?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

interface BondingCurveDetailProps {
  pool: BondingPool;
  userAddress?: string;
}

type TabType = 'chart' | 'overview' | 'trades' | 'transactions' | 'holders';

export function BondingCurveDetail({ pool, userAddress }: BondingCurveDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chart');
  const { bnbPrice } = useBnbPrice();
  
  // ── Metrics Engine ──────────────────────────────────────────────────
  // All raw values from DB are stringified BigInts (wei). Normalize first.
  const tokenDecimals = pool.token_decimals || 18;
  
  // Humanize raw reserves
  const virtualNativeBNB  = Number(pool.virtual_native_reserves || 0) / 1e18;
  const virtualTokenHuman = Number(pool.virtual_token_reserves  || 0) / Math.pow(10, tokenDecimals);
  const actualNativeBNB   = Number(pool.actual_native_reserves  || 0) / 1e18;
  const totalSupply       = Number(pool.total_supply            || 0) / Math.pow(10, tokenDecimals);
  const gradThresholdBNB  = Number(pool.graduation_threshold_native || 0) / 1e18;

  // ── Spot Price (BNB per token) ──
  const spotPriceBNB = virtualTokenHuman > 0 ? virtualNativeBNB / virtualTokenHuman : 0;
  const spotPriceUSD = spotPriceBNB * bnbPrice;

  // ── Liquidity Raised & Progress ──
  const liquidityRaised = actualNativeBNB;  // real BNB in curve
  const progress = gradThresholdBNB > 0 ? (liquidityRaised / gradThresholdBNB) * 100 : 0;

  // ── Circulating Supply ──
  // PRIMARY: totalSupply - actualTokenReserves (tokens still in bonding curve contract)
  // FALLBACK: aggregate from swap events — only if actual_token_reserves is null/missing/stale
  const [circulatingSupply, setCirculatingSupply] = useState(0);
  const [isEstimated, setIsEstimated] = useState(false);

  useEffect(() => {
    async function calcCirculating() {
      // Check if actual_token_reserves is available (not null/undefined/""/0-unset)
      const rawActualToken = pool.actual_token_reserves;
      const hasActualReserves = rawActualToken != null && String(rawActualToken) !== '' && rawActualToken !== undefined;

      if (hasActualReserves) {
        // PRIMARY path: use on-chain reserve data from indexer
        const actualTokenHuman = Number(rawActualToken) / Math.pow(10, tokenDecimals);
        const circulating = totalSupply - actualTokenHuman;
        // Clamp: max(0, min(circulating, totalSupply))
        const clamped = Math.max(0, Math.min(circulating, totalSupply));
        setCirculatingSupply(clamped);
        setIsEstimated(false);
        return;
      }

      // FALLBACK: actual_token_reserves is null/missing → aggregate from swaps
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: swaps } = await supabase
          .from('bonding_swaps')
          .select('swap_type, input_amount, output_amount, bonding_pools!inner(token_address)')
          .eq('bonding_pools.token_address', pool.token_address.toLowerCase());

        if (swaps && swaps.length > 0) {
          const { formatUnits } = await import('viem');
          let netTokens = 0n;
          swaps.forEach(swap => {
            const type = swap.swap_type.toUpperCase();
            if (type === 'BUY') {
              netTokens += BigInt(swap.output_amount || 0);  // tokens out
            } else if (type === 'SELL') {
              netTokens -= BigInt(swap.input_amount || 0);   // tokens returned
            }
          });
          // Normalize with token decimals
          const humanized = Number(formatUnits(netTokens > 0n ? netTokens : 0n, tokenDecimals));
          const clamped = Math.max(0, Math.min(humanized, totalSupply));
          setCirculatingSupply(clamped);
        } else {
          setCirculatingSupply(0);
        }
        setIsEstimated(true);
      } catch (err) {
        console.warn('[MarketCap] Fallback failed:', err);
        setCirculatingSupply(0);
        setIsEstimated(true);
      }
    }
    calcCirculating();
  }, [pool.token_address, pool.actual_token_reserves, totalSupply, tokenDecimals]);

  // ── Market Cap (circulating-based) ──
  const marketCapBNB = Math.max(0, spotPriceBNB * circulatingSupply);
  const marketCapUSD = marketCapBNB * bnbPrice;

  // ── FDV (Fully Diluted Valuation) ──
  const fdvBNB = spotPriceBNB * totalSupply;
  const fdvUSD = fdvBNB * bnbPrice;
  
  const tabs: { key: TabType; label: string; enabled: boolean }[] = [
    { key: 'chart', label: 'Chart', enabled: true },
    { key: 'overview', label: 'Overview', enabled: true },
    { key: 'trades', label: 'Trades', enabled: true },
    { key: 'transactions', label: 'My Transactions', enabled: !!userAddress },
    { key: 'holders', label: 'Holders', enabled: true },
  ];

  return (
    <div className="min-h-screen bg-[#030614] text-white dark relative flex flex-col">
      {/* Starfield & Animated Background */}
      <div className="fixed inset-0 z-0 bg-[url('/starfield.png')] bg-cover bg-center bg-no-repeat opacity-30" />
      <AnimatedBackground />
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />
      
      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 max-w-[1600px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link 
                  href="/bonding-curve"
                  className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
                </Link>
                {/* Logo */}
                {pool.logo_url ? (
                  <img src={pool.logo_url} alt={pool.token_symbol} className="w-10 h-10 rounded-full object-cover shadow-lg shadow-[#39AEC4]/20 border border-white/10" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#39AEC4] to-[#756BBA] flex items-center justify-center font-bold text-lg shadow-lg shadow-[#39AEC4]/20 border border-white/10">
                     {pool.token_symbol?.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight">{pool.token_name || 'Unnamed Token'}</h1>
                    <span className="text-sm text-[#39AEC4] font-medium bg-[#39AEC4]/10 px-2 py-0.5 rounded border border-[#39AEC4]/20">${pool.token_symbol}</span>
                    <StatusPill status={pool.status as any} />
                  </div>
                </div>
              </div>
              
              {/* Network Badge */}
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-amber-400">BSC Testnet</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 max-w-[1600px] flex-1">
          {/* Price Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-8">
            {/* Price */}
            <div className="rounded-[16px] bg-gradient-to-br from-[#39AEC4]/10 to-[#39AEC4]/5 backdrop-blur-xl border border-[#39AEC4]/30 p-4 transition-transform hover:scale-[1.02]">
              <p className="text-xs text-gray-400 mb-1">Price</p>
              <p className="text-lg font-bold text-white" style={{fontFamily: 'Inter, system-ui, -apple-system, sans-serif'}}>{spotPriceBNB.toFixed(10)} <span className="text-xs text-[#39AEC4] font-normal">BNB</span></p>
              {bnbPrice > 0 && <p className="text-xs text-gray-500 mt-0.5">≈ ${spotPriceUSD < 0.0001 ? spotPriceUSD.toFixed(10) : spotPriceUSD.toFixed(6)} USD</p>}
            </div>

            {/* Market Cap */}
            <div className="rounded-[16px] bg-gradient-to-br from-[#756BBA]/10 to-[#756BBA]/5 backdrop-blur-xl border border-[#756BBA]/30 p-4 transition-transform hover:scale-[1.02]">
              <p className="text-xs text-gray-400 mb-1">Market Cap{isEstimated ? ' (Est.)' : ''}</p>
              <p className="text-lg font-bold text-white" style={{fontFamily: 'Inter, system-ui, -apple-system, sans-serif'}}>
                ${marketCapUSD > 1_000_000 ? (marketCapUSD/1_000_000).toFixed(2) + 'M' : marketCapUSD > 1000 ? (marketCapUSD/1000).toFixed(2) + 'K' : marketCapUSD.toFixed(2)}
                <span className="text-xs text-[#756BBA] font-normal ml-1">USD</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{marketCapBNB.toFixed(4)} BNB</p>
            </div>

            {/* Liquidity Raised */}
            <div className="rounded-[16px] bg-gradient-to-br from-green-500/10 to-green-500/5 backdrop-blur-xl border border-green-500/30 p-4 transition-transform hover:scale-[1.02]">
              <p className="text-xs text-gray-400 mb-1">Liquidity Raised</p>
              <p className="text-lg font-bold text-white" style={{fontFamily: 'Inter, system-ui, -apple-system, sans-serif'}}>{liquidityRaised.toFixed(4)} <span className="text-xs text-green-400 font-normal">BNB</span></p>
            </div>

            {/* Graduation Target */}
            <div className="rounded-[16px] bg-gradient-to-br from-amber-500/10 to-amber-500/5 backdrop-blur-xl border border-amber-500/30 p-4 transition-transform hover:scale-[1.02]">
              <p className="text-xs text-gray-400 mb-1">Graduation Target</p>
              <p className="text-lg font-bold text-white" style={{fontFamily: 'Inter, system-ui, -apple-system, sans-serif'}}>{gradThresholdBNB.toFixed(4)} <span className="text-xs text-amber-400 font-normal">BNB</span></p>
            </div>

            <div className="col-span-2 md:col-span-1 rounded-[16px] bg-gradient-to-br from-blue-500/10 to-blue-500/5 backdrop-blur-xl border border-blue-500/30 p-4">
              <p className="text-xs text-gray-400 mb-1">Bonding Curve Progress</p>
              <div className="flex items-end justify-between">
                <p className="text-lg font-bold text-blue-400" style={{fontFamily: 'Inter, system-ui, -apple-system, sans-serif'}}>{progress.toFixed(1)}%</p>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full mt-1.5 overflow-hidden border border-blue-500/30">
                 <div 
                   className="h-full bg-gradient-to-r from-blue-400 to-[#756BBA]"
                   style={{ width: `${Math.min(progress, 100)}%` }}
                 />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6 overflow-x-auto scrollbar-hide py-1">
            <div className="flex gap-2 min-w-max sm:min-w-0">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => tab.enabled && setActiveTab(tab.key)}
                  className={`px-4 sm:px-6 py-2.5 rounded-[12px] font-bold text-sm transition-all capitalize ${
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white shadow-lg shadow-[#756BBA]/30 border border-white/10'
                      : tab.enabled
                         ? 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                         : 'text-gray-600 cursor-not-allowed opacity-50 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content Layout (Grid) */}
          <div className="grid lg:grid-cols-12 gap-6">
            
            {/* Main Content Area (Left 8 columns) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Chart Tab */}
              {activeTab === 'chart' && (
                <PriceChartPanel poolAddress={pool.token_address} tokenDecimals={tokenDecimals} currentSpotPrice={spotPriceBNB} />
              )}

              {/* Top Holders Tab */}
              {activeTab === 'holders' && (
                <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-6 shadow-xl">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                     <Users className="w-5 h-5 text-[#39AEC4]" />
                     Top Holders
                  </h3>
                  <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                     <TopHoldersList poolAddress={pool.token_address} totalSupply={pool.total_supply} />
                  </div>
                </div>
              )}

              {/* Transactions Tab */}
              {activeTab === 'transactions' && (
                <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-6 shadow-xl">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                     <Flame className="w-5 h-5 text-[#39AEC4]" />
                     My Transactions
                  </h3>
                  <div className="overflow-x-auto">
                     <UserTransactionsTable poolAddress={pool.token_address} userAddress={userAddress} />
                  </div>
                </div>
              )}

              {/* Trades Tab */}
              {activeTab === 'trades' && (
                <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-6 shadow-xl">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                     <Flame className="w-5 h-5 text-[#39AEC4]" />
                     Live Trades
                  </h3>
                  <div className="overflow-x-auto">
                     <RecentTradesTable poolAddress={pool.token_address} />
                  </div>
                </div>
              )}

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Description */}
                  {pool.description && (
                    <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-6 shadow-xl">
                      <h3 className="font-bold text-lg mb-3">📝 About</h3>
                      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{pool.description}</p>
                    </div>
                  )}
                  
                  {/* Bonding Curve Mechanics */}
                  <div className="rounded-[20px] bg-gradient-to-br from-[#756BBA]/10 to-[#756BBA]/5 backdrop-blur-xl border border-[#756BBA]/30 p-6 shadow-xl">
                    <h3 className="font-bold text-lg mb-4 text-[#756BBA]">⚡ Bonding Curve Mechanics</h3>
                    <div className="space-y-4 text-sm">
                      <div className="flex items-start gap-3">
                        <span className="text-[#39AEC4] font-bold mt-0.5">•</span>
                        <div>
                          <p className="text-white font-medium">Constant Product AMM</p>
                          <p className="text-gray-400 font-mono text-xs">x * y = k (with virtual reserves)</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-[#39AEC4] font-bold mt-0.5">•</span>
                        <div>
                          <p className="text-white font-medium">Automatic Graduation</p>
                          <p className="text-gray-400">
                            When target of {gradThresholdBNB} BNB is reached, liquidity migrates to {pool.target_dex || 'DEX'}.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fees & LP */}
                  <div className="grid md:grid-cols-2 gap-6">
                     <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-6 shadow-xl">
                       <h3 className="font-bold text-lg mb-4">💰 Fees</h3>
                       <div className="space-y-3">
                         <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                            <span className="text-gray-400 text-sm">Deploy Fee</span>
                            <span className="text-white font-bold">0.05 BNB</span>
                         </div>
                         <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                            <span className="text-gray-400 text-sm">Swap Fee</span>
                            <span className="text-[#39AEC4] font-bold">{(pool.swap_fee_bps || 0) / 100}%</span>
                         </div>
                       </div>
                     </div>

                     <div className="rounded-[20px] bg-gradient-to-br from-amber-500/10 to-amber-500/5 backdrop-blur-xl border border-amber-500/30 p-6 shadow-xl flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                          <Lock className="w-6 h-6 text-amber-400" />
                          <h3 className="text-lg font-bold text-white">LP Lock</h3>
                        </div>
                        <p className="text-gray-400 text-sm">
                          After graduation, LP tokens will be locked permanently (`DEAD_ADDRESS`) to ensure absolute liquidity stability.
                        </p>
                     </div>
                  </div>
                  
                  {/* Token Details */}
                  <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-6 shadow-xl">
                    <h3 className="font-bold text-lg mb-4">Token Details</h3>
                    <div className="space-y-2 text-sm bg-black/20 p-4 rounded-xl border border-white/5">
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400">Total Supply</span>
                        <span className="text-white font-mono">{totalSupply.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400">Circulating Supply{isEstimated ? ' (Est.)' : ''}</span>
                        <span className="text-white font-mono">{circulatingSupply.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400">FDV</span>
                        <span className="text-[#756BBA] font-bold">${fdvUSD > 1_000_000 ? (fdvUSD/1_000_000).toFixed(2) + 'M' : fdvUSD > 1000 ? (fdvUSD/1000).toFixed(2) + 'K' : fdvUSD.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400">Decimals</span>
                        <span className="text-white font-mono">{pool.token_decimals}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400">Created At</span>
                        <span className="text-[#39AEC4]" suppressHydrationWarning>{new Date(pool.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar (Right 4 columns) */}
            <div className="lg:col-span-4">
              <div className="sticky top-24 space-y-6">
                
                {/* Swap Panel Widget Wrapper */}
                <div className="rounded-[20px] bg-gradient-to-br from-[#39AEC4]/10 to-[#756BBA]/10 backdrop-blur-xl border border-[#39AEC4]/30 shadow-[#39AEC4]/10 shadow-xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-black/20">
                       <Flame className="w-5 h-5 text-[#39AEC4]" />
                       <h3 className="font-bold">{pool.status === 'GRADUATED' ? 'Trade on PancakeSwap 🥞' : `Trade ${pool.token_symbol}`}</h3>
                    </div>
                    {/* Inner wrapper for existing SwapPanel to make it blend into the new UI */}
                    <div className="p-5">
                      <SwapPanel 
                        poolAddress={pool.token_address} 
                        targetDex={pool.target_dex || 'PancakeSwap'} 
                        isMigrated={pool.status === 'GRADUATED'} 
                      />
                    </div>
                </div>

                {/* Quick Links */}
                <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-5 shadow-xl">
                   <h3 className="font-bold mb-4 text-sm text-gray-300">Quick Links</h3>
                   <div className="space-y-2">
                     <a href={`https://testnet.bscscan.com/address/${pool.token_address}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-black/40 hover:bg-white/10 transition-all border border-white/5 hover:border-[#39AEC4]/50 group">
                       <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">BscScan (Contract)</span>
                       <ExternalLink className="w-4 h-4 text-[#39AEC4]" />
                     </a>
                     {pool.website && (
                       <a href={pool.website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-black/40 hover:bg-white/10 transition-all border border-white/5 hover:border-[#39AEC4]/50 group">
                         <div className="flex items-center gap-2">
                           <Globe className="w-4 h-4 text-cyan-400" />
                           <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Website</span>
                         </div>
                         <ExternalLink className="w-4 h-4 text-[#39AEC4]" />
                       </a>
                     )}
                     {pool.twitter && (
                       <a href={pool.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-black/40 hover:bg-white/10 transition-all border border-white/5 hover:border-[#39AEC4]/50 group">
                         <div className="flex items-center gap-2">
                           <Twitter className="w-4 h-4 text-blue-400" />
                           <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">X (Twitter)</span>
                         </div>
                         <ExternalLink className="w-4 h-4 text-[#39AEC4]" />
                       </a>
                     )}
                     {pool.telegram && (
                       <a href={pool.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-black/40 hover:bg-white/10 transition-all border border-white/5 hover:border-[#39AEC4]/50 group">
                         <div className="flex items-center gap-2">
                           <MessageCircle className="w-4 h-4 text-blue-300" />
                           <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Telegram</span>
                         </div>
                         <ExternalLink className="w-4 h-4 text-[#39AEC4]" />
                       </a>
                     )}
                     {!pool.website && !pool.twitter && !pool.telegram && (
                       <p className="text-xs text-gray-500 text-center py-2">No social links provided</p>
                     )}
                   </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

// ──────────────── PRICE CHART ────────────────

type ChartTimeFrame = '1H' | '4H' | '1D' | '1W';

const TIMEFRAME_MS: Record<ChartTimeFrame, number> = {
  '1H': 60 * 60 * 1000,
  '4H': 4 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
};

function formatTimeLabel(date: Date, tf: ChartTimeFrame) {
  if (tf === '1H' || tf === '4H') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (tf === '1D') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function PriceChartPanel({ poolAddress, tokenDecimals, currentSpotPrice }: { poolAddress: string; tokenDecimals: number; currentSpotPrice: number }) {
  const [timeframe, setTimeframe] = useState<ChartTimeFrame>('1D');
  const [allData, setAllData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch ALL swap data once
  useEffect(() => {
    async function fetchChartData() {
      if (!poolAddress) return;
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        const { data: swaps, error } = await supabase
          .from('bonding_swaps')
          .select('swap_type, input_amount, output_amount, created_at, bonding_pools!inner(token_address, virtual_native_reserves, virtual_token_reserves)')
          .eq('bonding_pools.token_address', poolAddress.toLowerCase())
          .order('created_at', { ascending: true });

        if (error) throw error;

        const points: any[] = [];

        if (swaps && swaps.length > 0) {
          const tokenDivisor = Math.pow(10, tokenDecimals);

          // Genesis point from pool's virtual reserves
          const poolData = (swaps[0] as any)?.bonding_pools;
          const virtNative = Number(poolData?.virtual_native_reserves || 0) / 1e18;
          const virtToken = Number(poolData?.virtual_token_reserves || 0) / tokenDivisor;
          if (virtToken > 0) {
            const genesisTime = new Date(swaps[0]!.created_at);
            genesisTime.setSeconds(genesisTime.getSeconds() - 1);
            points.push({ timestamp: genesisTime.getTime(), price: virtNative / virtToken });
          }

          // Each swap as a data point — track running spot price
          let runningVNative = virtNative;
          let runningVToken = virtToken;

          const TRADE_FEE = 0.015; // 1.5% fee — must match contract TRADE_FEE_BPS / BPS_DENOMINATOR

          swaps.forEach((swap) => {
            const type = swap.swap_type.toUpperCase();
            const rawBnb = Number(type === 'BUY' ? swap.input_amount : swap.output_amount || 0) / 1e18;
            const tkn = Number(type === 'BUY' ? swap.output_amount : swap.input_amount || 0) / tokenDivisor;

            // Deduct fee to match contract's actual reserve changes
            const netBnb = rawBnb * (1 - TRADE_FEE);

            // Update running virtual reserves to get post-trade spot price
            if (type === 'BUY') {
              runningVNative += netBnb;
              runningVToken -= tkn;
            } else {
              runningVNative -= rawBnb; // sell: grossEthOut removed from reserves
              runningVToken += tkn;
            }

            const spotPrice = runningVToken > 0 ? runningVNative / runningVToken : 0;
            if (spotPrice > 0) {
              points.push({
                timestamp: new Date(swap.created_at).getTime(),
                price: spotPrice,
              });
            }
          });
        }

        // Override the last point with the DB's exact spot price (eliminates float drift)
        if (points.length > 0 && currentSpotPrice > 0) {
          points[points.length - 1].price = currentSpotPrice;
        }

        setAllData(points);
      } catch (err) {
        console.error('[Chart] Failed to fetch data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchChartData();
  }, [poolAddress, tokenDecimals]);

  // Filter data by timeframe
  const filteredData = (() => {
    if (allData.length === 0) return [];
    const now = Date.now();
    const cutoff = now - TIMEFRAME_MS[timeframe];
    const filtered = allData.filter(d => d.timestamp >= cutoff);
    // If all data is older than cutoff, show all data
    const result = filtered.length > 0 ? filtered : allData;
    return result.map(d => ({
      ...d,
      time: formatTimeLabel(new Date(d.timestamp), timeframe),
    }));
  })();

  return (
    <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-6 shadow-xl min-h-[500px] flex flex-col">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h3 className="font-bold text-lg text-white">Price Chart</h3>
        <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
          {(['1H', '4H', '1D', '1W'] as ChartTimeFrame[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                tf === timeframe
                  ? 'bg-[#39AEC4]/20 text-[#39AEC4] shadow-lg shadow-[#39AEC4]/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Content */}
      <div className="flex-1 w-full min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="animate-spin w-8 h-8 border-4 border-[#39AEC4] border-t-transparent rounded-full mb-4" />
            <p className="text-[#39AEC4]">Loading chart data...</p>
          </div>
        ) : filteredData.length <= 1 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="text-6xl mb-4">📈</div>
            <h3 className="text-xl font-bold text-white mb-2">No Trading Data Yet</h3>
            <p className="text-gray-400">Be the first to trade and start the chart!</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={filteredData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <RechartsGrid strokeDasharray="3 3" stroke="#39AEC4" opacity={0.08} />
              <XAxis
                dataKey="time"
                stroke="#4b5563"
                fontSize={11}
                fontFamily="Inter, system-ui, -apple-system, sans-serif"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[(dataMin: number) => Math.max(0, dataMin * 0.9), (dataMax: number) => dataMax * 1.1]}
                stroke="#4b5563"
                fontSize={11}
                fontFamily="Inter, system-ui, -apple-system, sans-serif"
                tickFormatter={(val) => val.toFixed(10)}
                tickLine={false}
                axisLine={false}
                orientation="right"
                width={110}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(3, 6, 20, 0.95)',
                  border: '1px solid #39AEC4',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '13px',
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                  padding: '10px 14px',
                }}
                itemStyle={{ color: '#39AEC4', fontWeight: 'bold' }}
                formatter={(value: any) => [Number(value).toFixed(10) + ' BNB', 'Price']}
                labelStyle={{ color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#39AEC4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#39AEC4', stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
