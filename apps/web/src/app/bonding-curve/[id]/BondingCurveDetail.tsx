'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, TrendingUp, Lock } from 'lucide-react';
import { StatusPill } from '@/components/presale/StatusPill';
import {
  FeeSplitDisplay,
  GraduationProgress,
  DEXMigrationDetails,
} from '@/components/bonding/DEXSelector';
import { SwapPanel } from '@/components/bonding/SwapPanel';
import { RecentTradesTable } from '@/components/bonding/RecentTradesTable';
import { UserTransactionsTable } from '@/components/bonding/UserTransactionsTable';
import { TopHoldersList } from '@/components/bonding/TopHoldersList';

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

type TabType = 'overview' | 'chart' | 'swap' | 'trades' | 'transactions' | 'holders';

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
    { key: 'holders', label: 'Holders', enabled: true },
  ];

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen">
      {/* Back Button */}
      <Link
        href="/bonding-curve"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pools
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Header, Chart, Trades/Comments */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Header & Token Stats */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-white">
                    {pool.token_name || 'Unnamed Token'}
                  </h1>
                  <span className="text-xl font-mono text-gray-400">
                    ${pool.token_symbol || 'UNKNOWN'}
                  </span>
                  <StatusPill status={pool.status as any} />
                </div>
                <div className="text-sm font-mono text-gray-500 mb-4 flex items-center gap-2">
                  Contract: {pool.token_address}
                  <a
                    href={`https://testnet.bscscan.com/address/${pool.token_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Main KPIs (Market Cap & Price) right aligned on desktop */}
              <div className="flex flex-row gap-6 md:text-right">
                <div>
                  <div className="text-sm font-medium text-gray-400 mb-1">Market Cap</div>
                  <div className="text-2xl font-bold text-green-400">
                    {(
                      currentPrice *
                      (pool.total_supply / Math.pow(10, pool.token_decimals))
                    ).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                    BNB
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-400 mb-1">Current Price</div>
                  <div className="text-xl font-bold text-white">{currentPrice.toFixed(8)} BNB</div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-1 min-h-[500px] flex flex-col">
            <div className="border-b border-gray-800 p-3 flex gap-4 text-sm font-medium text-gray-400">
               <button className="text-white">Chart</button>
            </div>
            <div className="flex-1 flex flex-col">
               <ChartTab poolAddress={pool.token_address} />
            </div>
          </div>

          {/* Bottom Tabs Area (Trades, Transactions, Overview) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="border-b border-gray-800">
              <div className="flex gap-6 px-6 overflow-x-auto">
                {tabs.filter(t => ['trades', 'transactions', 'overview'].includes(t.key)).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => tab.enabled && setActiveTab(tab.key)}
                    disabled={!tab.enabled}
                    className={`py-4 font-medium transition-colors whitespace-nowrap relative ${
                      activeTab === tab.key
                        ? 'text-white'
                        : tab.enabled
                          ? 'text-gray-500 hover:text-gray-300'
                          : 'text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.key && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6">
              {activeTab === 'overview' && <OverviewTab pool={pool} />}
              {activeTab === 'trades' && <RecentTradesTable poolAddress={pool.token_address} />}
              {activeTab === 'transactions' && <UserTransactionsTable poolAddress={pool.token_address} userAddress={userAddress} />}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Swap, Progress, Info */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Swap Panel Component */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <SwapPanel 
              poolAddress={pool.token_address} 
              targetDex={pool.target_dex} 
              isMigrated={pool.status === 'MIGRATED'} 
            />
          </div>

          {/* Bonding Curve Progress */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-end mb-3">
              <h3 className="text-sm font-bold text-white">Bonding Curve Progress</h3>
              <span className="text-sm font-mono text-blue-400">{progress.toFixed(1)}%</span>
            </div>
            
            <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden mb-3 border border-gray-700/50">
              <div
                className="h-full bg-blue-500 transition-all relative"
                style={{ width: `${Math.min(progress, 100)}%` }}
              >
                 <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse"></div>
              </div>
            </div>
            
            <div className="flex justify-between text-xs font-mono text-gray-500">
              <span>{solRaised.toFixed(4)} BNB raised</span>
              <span>{threshold.toFixed(4)} BNB Target</span>
            </div>

            <p className="text-xs text-gray-400 mt-4 leading-relaxed">
              When the market cap reaches <strong className="text-white">{threshold} BNB</strong>, all liquidity from the bonding curve will be permanently deposited into {pool.target_dex || 'DEX'} and locked.
            </p>
          </div>

          {/* Top Holders inside Right Column (like Pump.fun) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-white">Top Holders</h3>
               <span className="text-xs font-medium bg-blue-500/10 text-blue-400 px-2 py-1 rounded">Metrics</span>
             </div>
             <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <TopHoldersList poolAddress={pool.token_address} totalSupply={pool.total_supply} />
             </div>
          </div>

          {/* Creator Rewards / Fee Display */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="font-bold text-white mb-4">Protocol Details</h3>
            <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center">
                   <span className="text-gray-400">Swap Fee</span>
                   <span className="text-white font-medium">{swapFee}%</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-gray-400">Deploy Fee</span>
                   <span className="text-white font-medium">{(pool.deploy_fee_native || 0) / 1e18} BNB</span>
                </div>
            </div>
          </div>
        </div>
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
            <span className="text-white" suppressHydrationWarning>{new Date(pool.created_at).toLocaleDateString()}</span>
          </div>
          {pool.deployed_at && (
            <div className="flex justify-between">
              <span className="text-gray-400">Deployed</span>
              <span className="text-white" suppressHydrationWarning>{new Date(pool.deployed_at).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartTab({ poolAddress }: { poolAddress: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
          .order('created_at', { ascending: true }); // ASC for chronological chart

        if (error) throw error;

        let chartPoints = [];

        if (swaps && swaps.length > 0) {
           const { formatEther, formatUnits } = await import('viem');
           
           // Push Genesis price from the pool's virtual reserves
           const firstSwap = swaps[0];
           const poolData = firstSwap?.bonding_pools as any;
           const virtNative = Number(formatEther(BigInt(poolData?.virtual_native_reserves || 0)));
           const virtToken = Number(formatUnits(BigInt(poolData?.virtual_token_reserves || 0), 18));
           if (virtToken > 0) {
              chartPoints.push({
                 time: 'Genesis',
                 price: virtNative / virtToken,
              });
           }

           swaps.forEach((swap, index) => {
              const type = swap.swap_type.toUpperCase();
              const ethAmntWei = type === 'BUY' ? swap.input_amount : swap.output_amount;
              const tokenAmntDec = type === 'BUY' ? swap.output_amount : swap.input_amount;
              
              const bnbAmount = Number(formatEther(BigInt(ethAmntWei || 0)));
              const tokenAmount = Number(formatUnits(BigInt(tokenAmntDec || 0), 18));
              
              if (bnbAmount > 0 && tokenAmount > 0) {
                 const price = bnbAmount / tokenAmount;
                 chartPoints.push({
                    time: new Date(swap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    price: price,
                 });
              }
           });
        }
        
        setData(chartPoints);
      } catch (err) {
         console.error('Failed to fetch chart data', err);
      } finally {
         setLoading(false);
      }
    }
    
    fetchChartData();
  }, [poolAddress]);

  if (loading) {
     return (
       <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-400">Loading chart data...</p>
       </div>
     );
  }

  return (
    <div className="w-full h-[450px] p-4 relative">
       <ChartRenderer data={data} />
    </div>
  );
}

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

function ChartRenderer({ data }: { data: any[] }) {
   if (data.length <= 1) {
      return (
         <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">📉</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Trading Data Yet</h3>
            <p className="text-gray-400">Be the first to trade and start the chart!</p>
         </div>
      );
   }

   const minPrice = Math.min(...data.map(d => d.price));
   const maxPrice = Math.max(...data.map(d => d.price));
   const padding = (maxPrice - minPrice) * 0.1;

   return (
      <ResponsiveContainer width="100%" height="100%">
         <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
               <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
               </linearGradient>
            </defs>
            <XAxis dataKey="time" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis 
               domain={[Math.max(0, minPrice - padding), maxPrice + padding]} 
               stroke="#4b5563" 
               fontSize={12} 
               tickFormatter={(val) => val.toFixed(8)}
               tickLine={false}
               axisLine={false}
               orientation="right"
            />
            <Tooltip 
               contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
               itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
               formatter={(value: any) => [Number(value).toFixed(8) + ' BNB', 'Price']}
            />
            <Area 
               type="monotone" 
               dataKey="price" 
               stroke="#3b82f6" 
               strokeWidth={2}
               fillOpacity={1} 
               fill="url(#colorPrice)" 
               isAnimationActive={false}
            />
         </AreaChart>
      </ResponsiveContainer>
   );
}


