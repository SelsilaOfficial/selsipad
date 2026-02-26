'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatEther, formatUnits } from 'viem';
import { Loader2, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

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
        <div className="py-8 text-center text-gray-500 bg-white/5 border border-white/5 rounded-[16px]">
            Connect wallet to view your transactions
        </div>
    )
  }

  if (loading && transactions.length === 0) {
     return <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#39AEC4]" /></div>;
  }

  return (
    <div className="space-y-3 min-w-[500px]">
      {transactions.length === 0 ? (
        <div className="p-4 text-center text-gray-500 bg-white/5 rounded-[16px] border border-white/5">
          You have no transactions for this token yet.
        </div>
      ) : (
        transactions.map((tx) => (
          <div key={tx.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between p-4 rounded-[16px] bg-white/5 border border-white/5 hover:border-[#39AEC4]/30 hover:bg-white/10 transition-all gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
                tx.type === 'BUY' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {tx.type === 'BUY' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-bold text-white capitalize">{tx.type} TOKEN</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-bold font-mono ${tx.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type === 'BUY' ? '+' : '-'}{tx.amountOut.replace(' TOKEN', '')}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">for {tx.amountIn}</span>
                </div>
              </div>
            </div>
            <div className="text-right w-full sm:w-auto flex justify-end">
              <div>
                 <a 
                   href={`https://testnet.bscscan.com/tx/${tx.txHash}`} 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   className="text-sm font-mono text-[#39AEC4] hover:text-white transition-colors flex items-center justify-end gap-1.5"
                 >
                    {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                    <ExternalLink className="w-3.5 h-3.5" />
                 </a>
                 <p className="text-xs text-gray-500 mt-1">
                   {new Date(tx.timestamp).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                   })}
                 </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
