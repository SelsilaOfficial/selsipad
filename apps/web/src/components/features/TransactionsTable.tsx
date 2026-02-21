'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { type Project } from '@/lib/data/projects';
import { formatDistanceToNow } from 'date-fns';
import { formatEther } from 'viem';

interface Transaction {
  id: string;
  wallet_address: string;
  amount: string;
  tx_hash: string;
  created_at: string;
  chain: string;
  referrer?: string;
}

interface TransactionsTableProps {
  project: Project;
}

// Presale event: Contributed(address indexed user, uint256 amount, address referral)
const PRESALE_CONTRIBUTED_TOPIC =
  '0xec470969f3350ca5a15f0d85053f8763ffd0ee39c7b74fcdc5af7862718e292a';
// Fairlaunch event: Contributed(address indexed user, uint256 amount, uint256 totalRaised)
const FAIRLAUNCH_CONTRIBUTED_TOPIC =
  '0xfa35a310d7113dddce1c275da946348e9aaebf9050b00b372033c4d84b0bd6eb';

function getExplorerUrl(chain: string): { api: string; ui: string; key: string } {
  switch (chain) {
    case '97':
    case 'bsc-testnet':
      return {
        api: 'https://api-testnet.bscscan.com/api',
        ui: 'https://testnet.bscscan.com',
        key: process.env.NEXT_PUBLIC_BSCSCAN_API_KEY || '',
      };
    case '56':
    case 'bsc':
      return {
        api: 'https://api.bscscan.com/api',
        ui: 'https://bscscan.com',
        key: process.env.NEXT_PUBLIC_BSCSCAN_API_KEY || '',
      };
    default:
      return {
        api: 'https://api-testnet.bscscan.com/api',
        ui: 'https://testnet.bscscan.com',
        key: process.env.NEXT_PUBLIC_BSCSCAN_API_KEY || '',
      };
  }
}

export default function TransactionsTable({ project }: TransactionsTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'db' | 'chain'>('db');

  useEffect(() => {
    async function fetchTransactions() {
      try {
        // Step 1: Try database first
        const supabase = createClient();
        const { data: dbData, error: dbError } = await supabase
          .from('contributions')
          .select('*')
          .eq('round_id', project.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!dbError && dbData && dbData.length > 0) {
          setTransactions(
            dbData.map((d: any) => ({
              id: d.id,
              wallet_address: d.wallet_address || 'Unknown',
              amount: String(d.amount),
              tx_hash: d.tx_hash,
              created_at: d.created_at,
              chain: project.chain || '97',
            }))
          );
          setSource('db');
          setLoading(false);
          return;
        }

        // Step 2: Fallback → read on-chain events from BSCScan
        if (project.contract_address) {
          const explorer = getExplorerUrl(project.chain || '97');
          // Use the correct event topic based on project type
          const topic =
            project.type === 'fairlaunch'
              ? FAIRLAUNCH_CONTRIBUTED_TOPIC
              : PRESALE_CONTRIBUTED_TOPIC;
          const params = new URLSearchParams({
            module: 'logs',
            action: 'getLogs',
            address: project.contract_address,
            topic0: topic,
            fromBlock: '0',
            toBlock: 'latest',
            apikey: explorer.key,
          });

          const res = await fetch(`${explorer.api}?${params}`);
          const json = await res.json();

          if (json.status === '1' && json.result?.length > 0) {
            const onChainTxs: Transaction[] = json.result.map((log: any, i: number) => {
              // topics[1] = user address (indexed)
              const userAddr = '0x' + (log.topics[1]?.slice(26) || '');
              // data contains: amount (bytes 0-32), referral (bytes 32-64)
              const amountHex = log.data.slice(0, 66);
              const referralHex = '0x' + (log.data.slice(66, 130) || '');

              const amountWei = BigInt(amountHex);
              const amountEth = formatEther(amountWei);

              return {
                id: `chain-${i}`,
                wallet_address: userAddr,
                amount: amountEth,
                tx_hash: log.transactionHash,
                created_at: new Date(parseInt(log.timeStamp, 16) * 1000).toISOString(),
                chain: project.chain || '97',
                referrer:
                  referralHex !== '0x0000000000000000000000000000000000000000'
                    ? referralHex
                    : undefined,
              };
            });

            setTransactions(onChainTxs.reverse()); // newest first
            setSource('chain');
          }
        }
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    }

    if (project.id) {
      fetchTransactions();
    }
  }, [project.id, project.contract_address, project.chain]);

  const explorer = getExplorerUrl(project.chain || '97');

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
      {source === 'chain' && (
        <div className="px-4 py-2 text-[10px] text-gray-500 border-b border-white/5">
          📡 Showing on-chain data from BSCScan
        </div>
      )}
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
                <a
                  href={`${explorer.ui}/address/${tx.wallet_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors"
                >
                  {tx.wallet_address.slice(0, 6)}...
                  {tx.wallet_address.slice(-4)}
                </a>
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium text-white">
                {Number(tx.amount).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{' '}
                {project.currency}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-400">
                {formatDistanceToNow(new Date(tx.created_at), {
                  addSuffix: true,
                })}
              </td>
              <td className="px-4 py-3 text-sm text-right">
                <a
                  href={`${explorer.ui}/tx/${tx.tx_hash}`}
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
