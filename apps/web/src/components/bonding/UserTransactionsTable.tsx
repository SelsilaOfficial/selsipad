'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatEther, formatUnits } from 'viem';
import { Loader2 } from 'lucide-react';

interface UserTxEvent {
  id: string;
  type: 'BUY' | 'SELL';
  amountIn: string;
  amountOut: string;
  txHash: string;
  timestamp: string;
}

export function UserTransactionsTable({ poolAddress, userAddress }: { poolAddress: string; userAddress?: string }) {
  const [transactions, setTransactions] = useState<UserTxEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetchTransactions() {
      if (!poolAddress || !userAddress) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('bonding_swaps')
          .select('*, bonding_pools!inner(token_address)')
          .eq('bonding_pools.token_address', poolAddress.toLowerCase())
          .eq('wallet_address', userAddress.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(50);
          
        if (error) throw error;
        
        if (data) {
           const formattedTx = data.map(swap => {
              const type = swap.swap_type.toUpperCase() as 'BUY' | 'SELL';
              const ethAmntWei = type === 'BUY' ? swap.input_amount : swap.output_amount;
              const tokenAmntDec = type === 'BUY' ? swap.output_amount : swap.input_amount;
              
              const bnbFormatted = Number(formatEther(BigInt(ethAmntWei || 0))).toFixed(4) + ' BNB';
              const tokenFormatted = Number(formatUnits(BigInt(tokenAmntDec || 0), 18)).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' TOKEN';

              return {
                 id: swap.id,
                 type,
                 amountIn: type === 'BUY' ? bnbFormatted : tokenFormatted,
                 amountOut: type === 'BUY' ? tokenFormatted : bnbFormatted,
                 txHash: swap.tx_hash,
                 timestamp: swap.created_at,
              };
           });
           setTransactions(formattedTx);
        }
      } catch (err) {
        console.error('Failed to fetch user transactions:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchTransactions();
    
    if (!userAddress) return;
    
    // Set up realtime subscription tailored for this user
    const channel = supabase.channel(`user_tx_${poolAddress}_${userAddress}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bonding_swaps',
        filter: `wallet_address=eq.${userAddress.toLowerCase()}`
      }, () => {
         fetchTransactions();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [poolAddress, userAddress, supabase]);

  if (!userAddress) {
    return (
        <div className="py-8 text-center text-gray-500 bg-gray-900 border border-gray-800 rounded-xl">
            Connect wallet to view your transactions
        </div>
    )
  }

  if (loading && transactions.length === 0) {
     return <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-400">
        <thead className="text-xs text-gray-500 uppercase bg-gray-800 border-b border-gray-700">
          <tr>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium text-right">Amount In</th>
            <th className="px-4 py-3 font-medium text-right">Amount Out</th>
            <th className="px-4 py-3 font-medium">Tx Hash</th>
            <th className="px-4 py-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                You have no transactions for this token yet.
              </td>
            </tr>
          ) : (
            transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors">
                <td className={`px-4 py-3 font-bold ${tx.type === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                  {tx.type}
                </td>
                <td className="px-4 py-3 text-white text-right font-mono">{tx.amountIn}</td>
                <td className="px-4 py-3 text-white text-right font-mono">{tx.amountOut}</td>
                <td className="px-4 py-3 font-mono text-xs">
                    <a href={`https://testnet.bscscan.com/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                        {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                    </a>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                   {new Date(tx.timestamp).toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
