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
     return <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-400">
        <thead className="text-xs text-gray-500 uppercase bg-gray-800 border-b border-gray-700">
          <tr>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium text-right">Price (BNB)</th>
            <th className="px-4 py-3 font-medium text-right">Token Amount</th>
            <th className="px-4 py-3 font-medium text-right">Total BNB</th>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Maker</th>
          </tr>
        </thead>
        <tbody>
          {trades.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                No trades found yet. Be the first to trade!
              </td>
            </tr>
          ) : (
            trades.map((trade) => (
              <tr key={trade.id} className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors">
                <td className={`px-4 py-3 font-bold ${trade.type === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                  {trade.type}
                </td>
                <td className="px-4 py-3 text-white text-right font-mono">{trade.priceBnb.toFixed(8)}</td>
                <td className="px-4 py-3 text-white text-right font-mono">{trade.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-white text-right font-mono">{trade.bnbAmount.toFixed(4)}</td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                   {new Date(trade.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <a href={`https://testnet.bscscan.com/address/${trade.maker}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                    {trade.maker.slice(0, 6)}...{trade.maker.slice(-4)}
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
