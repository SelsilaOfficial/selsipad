'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatUnits } from 'viem';
import { Loader2 } from 'lucide-react';

interface Holder {
  address: string;
  tokenAmount: number;
  percentage: number;
}

export function TopHoldersList({ poolAddress, totalSupply }: { poolAddress: string; totalSupply: number }) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchHolders() {
      if (!poolAddress || !totalSupply) return;
      try {
        setLoading(true);
        // Fetch all swaps for the pool to aggregate balances.
        const { data, error } = await supabase
          .from('bonding_swaps')
          .select('wallet_address, swap_type, input_amount, output_amount, bonding_pools!inner(token_address)')
          .eq('bonding_pools.token_address', poolAddress.toLowerCase())
          .limit(2000); // 2000 is usually enough for a bonding curve phase
          
        if (error) throw error;
        
        if (data) {
           const balances: Record<string, bigint> = {};
           
           data.forEach(swap => {
              const type = swap.swap_type.toUpperCase();
              const wallet = swap.wallet_address.toLowerCase();
              if (!balances[wallet]) balances[wallet] = 0n;
              
              if (type === 'BUY') {
                 balances[wallet] += BigInt(swap.output_amount || 0);
              } else if (type === 'SELL') {
                 balances[wallet] -= BigInt(swap.input_amount || 0);
              }
           });
           
           const actualTotalSupply = totalSupply / Math.pow(10, 18);
           
           const aggregatedHolders: Holder[] = Object.entries(balances)
              .filter(([_, bal]) => bal > 0n)
              .map(([address, bal]) => {
                 const tokenAmount = Number(formatUnits(bal, 18));
                 return {
                    address,
                    tokenAmount,
                    percentage: (tokenAmount / actualTotalSupply) * 100
                 };
              })
              .sort((a, b) => b.tokenAmount - a.tokenAmount)
              .slice(0, 50);
              
           setHolders(aggregatedHolders);
        }
      } catch (err) {
        console.error('Failed to fetch holders:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHolders();
    
    const channel = supabase.channel(`holders_${poolAddress}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bonding_swaps',
      }, () => {
         fetchHolders();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [poolAddress, totalSupply, supabase]);

  if (loading && holders.length === 0) {
     return <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#39AEC4]" /></div>;
  }

  return (
    <div className="space-y-3">
      {holders.length === 0 ? (
        <div className="p-4 text-center text-gray-500 bg-white/5 rounded-[16px] border border-white/5">
          No active holders found yet.
        </div>
      ) : (
        holders.map((holder, index) => (
          <div key={holder.address} className="flex flex-wrap sm:flex-nowrap items-center justify-between p-4 rounded-[16px] bg-white/5 border border-white/5 hover:border-[#39AEC4]/30 hover:bg-white/10 transition-all gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-[#39AEC4] to-[#756BBA] flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-[#39AEC4]/20">
                {index + 1}
              </div>
              <div>
                <a 
                   href={`https://testnet.bscscan.com/address/${holder.address}`} 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   className="font-mono text-sm text-gray-300 hover:text-white transition-colors"
                >
                   {holder.address.slice(0, 8)}...{holder.address.slice(-6)}
                </a>
                <p className="text-xs text-gray-500 mt-0.5">{holder.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens</p>
              </div>
            </div>
            <div className="text-right w-full sm:w-auto flex justify-end">
              <div className="flex items-center gap-3">
                 <p className="font-bold text-[#39AEC4] text-sm sm:text-base">{holder.percentage.toFixed(2)}%</p>
                 <div className="w-16 h-1.5 bg-black/40 rounded-full overflow-hidden shrink-0 hidden sm:block">
                    <div className="h-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA]" style={{ width: `${Math.min(holder.percentage, 100)}%` }} />
                 </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
