'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatEther, formatUnits } from 'viem';
import { Loader2 } from 'lucide-react';

interface TradeEvent {
  id: string;
  type: 'BUY' | 'SELL';
  priceBnb: number;
  tokenAmount: number;
  bnbAmount: number;
  timestamp: string;
  maker: string;
}

export function RecentTradesTable({ poolAddress }: { poolAddress: string }) {
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchTrades() {
      if (!poolAddress) return;
      try {
        setLoading(true);
        // We know that token_decimals is 18 for bonding curves by default 
        const { data, error } = await supabase
          .from('bonding_swaps')
          .select('*, bonding_pools!inner(token_address)')
          .eq('bonding_pools.token_address', poolAddress.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(50);
          
        if (error) throw error;
        
        if (data) {
           const formattedTrades: TradeEvent[] = data.map(swap => {
              const type = swap.swap_type.toUpperCase() as 'BUY' | 'SELL';
              // input_amount and output_amount represent ETH in WEI and Token in 18 decimals interchangeably
              const ethAmountWei = type === 'BUY' ? swap.input_amount : swap.output_amount;
              const tokenAmountDec = type === 'BUY' ? swap.output_amount : swap.input_amount;
              
              const bnbAmount = Number(formatEther(BigInt(ethAmountWei || 0)));
              const tokenAmount = Number(formatUnits(BigInt(tokenAmountDec || 0), 18));
              const priceBnb = bnbAmount > 0 && tokenAmount > 0 ? bnbAmount / tokenAmount : 0;
              
              return {
                 id: swap.id,
                 type,
                 priceBnb,
                 tokenAmount,
                 bnbAmount,
                 timestamp: swap.created_at,
                 maker: swap.wallet_address || 'Unknown'
              };
           });
           setTrades(formattedTrades);
        }
      } catch (err) {
        console.error('Failed to fetch trades:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTrades();
    
    // Set up realtime subscription
    const channel = supabase.channel(`trades_${poolAddress}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bonding_swaps',
      }, () => {
         // Silently refetch on new inserts
         fetchTrades();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [poolAddress, supabase]);

  if (loading && trades.length === 0) {
     return <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#39AEC4]" /></div>;
  }

  return (
    <div className="space-y-2 min-w-[500px]">
      {trades.length === 0 ? (
        <div className="p-4 text-center text-gray-500 bg-white/5 rounded-lg border border-white/5">
          No trades found yet. Be the first to trade!
        </div>
      ) : (
        trades.map((trade) => (
          <div key={trade.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-[#39AEC4]/30 transition-all">
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                 {trade.type === 'BUY' ? (
                   <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                     <span className="text-green-400 text-xs font-bold">B</span>
                   </div>
                 ) : (
                   <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                     <span className="text-red-400 text-xs font-bold">S</span>
                   </div>
                 )}
              </div>
              <div>
                <p className="text-sm">
                  <span className={`font-bold ${trade.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.type === 'BUY' ? 'Bought' : 'Sold'}
                  </span>
                  <span className="text-gray-300 ml-2 font-mono">
                    {trade.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                   <span>{new Date(trade.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                   <span>•</span>
                   <a href={`https://testnet.bscscan.com/address/${trade.maker}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#39AEC4] transition-colors font-mono">
                     {trade.maker.slice(0, 6)}...{trade.maker.slice(-4)}
                   </a>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-white font-mono">{trade.bnbAmount.toFixed(4)} BNB</p>
              <p className="text-xs text-gray-500 font-mono">@ {trade.priceBnb.toFixed(8)}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
