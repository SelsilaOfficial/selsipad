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
     return <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-400">
        <thead className="text-xs text-gray-500 uppercase bg-gray-800 border-b border-gray-700">
          <tr>
            <th className="px-4 py-3 font-medium">Rank</th>
            <th className="px-4 py-3 font-medium">Address</th>
            <th className="px-4 py-3 font-medium text-right">Token Amount</th>
            <th className="px-4 py-3 font-medium text-right">% Supply</th>
          </tr>
        </thead>
        <tbody>
          {holders.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                No active holders found yet.
              </td>
            </tr>
          ) : (
            holders.map((holder, index) => (
              <tr key={holder.address} className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 font-bold text-gray-300">
                  #{index + 1}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <a href={`https://testnet.bscscan.com/address/${holder.address}`} target="_blank" rel="noopener noreferrer" className="text-white hover:text-blue-400 transition-colors">
                     {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                  </a>
                </td>
                <td className="px-4 py-3 text-white text-right font-mono">
                  {holder.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-white text-right font-mono">
                  <div className="flex items-center justify-end gap-2">
                     <span>{holder.percentage.toFixed(2)}%</span>
                     <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-blue-500" style={{ width: `${Math.min(holder.percentage, 100)}%` }} />
                     </div>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
