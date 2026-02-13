'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { type Project } from '@/lib/data/projects';
import { formatDistanceToNow } from 'date-fns';

interface Transaction {
  id: string;
  wallet_address: string;
  amount: number;
  tx_hash: string;
  created_at: string;
  chain: string;
}

interface TransactionsTableProps {
  project: Project;
}

export default function TransactionsTable({ project }: TransactionsTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchTransactions() {
      try {
        // project.id is likely the round_id based on getProjectById logic
        const { data, error } = await supabase
          .from('contributions')
          .select('*')
          .eq('round_id', project.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('Error fetching transactions:', error);
          return;
        }

        if (data) {
          setTransactions(data as Transaction[]);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    }

    if (project.id) {
      fetchTransactions();
    }
  }, [project.id]);

  if (loading) {
    return (
      <div className="w-full text-center py-8 text-gray-400 animate-pulse">
        Loading transactions...
      </div>
    );
  }

  if (transactions.length === 0) {
    return <div className="w-full text-center py-8 text-gray-500">No transactions found.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider">
            <th className="px-4 py-3 font-medium">Wallet</th>
            <th className="px-4 py-3 font-medium text-right">Amount</th>
            <th className="px-4 py-3 font-medium text-right">Time</th>
            <th className="px-4 py-3 font-medium text-right">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 text-sm font-mono text-gray-300">
                {tx.wallet_address.slice(0, 6)}...{tx.wallet_address.slice(-4)}
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium text-white">
                {Number(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                {project.currency}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-400">
                {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
              </td>
              <td className="px-4 py-3 text-sm text-right">
                <a
                  href={`https://testnet.bscscan.com/tx/${tx.tx_hash}`} // Hardcoded for BSC Testnet for now, or map chain
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline text-xs"
                >
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
