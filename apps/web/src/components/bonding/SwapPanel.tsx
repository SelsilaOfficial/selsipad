'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseEther, formatEther, parseAbi, parseUnits, formatUnits } from 'viem';
import { Loader2, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

interface SwapPanelProps {
  poolAddress: string;
  targetDex: string;
  isMigrated: boolean;
  onSuccess?: () => void;
}

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_BONDING_CURVE_FACTORY_ADDRESS as `0x${string}`;

const FACTORY_ABI = parseAbi([
  'function buyToken(address _token, address _referrer) external payable',
  'function sellToken(address _token, uint256 tokenAmount, address _referrer) external',
  'function getAmountOut(address _token, uint256 ethIn) external view returns (uint256 tokensOut)',
  'function getAmountIn(address _token, uint256 tokenAmount) external view returns (uint256 ethOut)',
]);

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

export function SwapPanel({ poolAddress, targetDex, isMigrated, onSuccess }: SwapPanelProps) {
  const { address: userAddress } = useAccount();
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amountIn, setAmountIn] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState('');
  const [referrer, setReferrer] = useState<`0x${string}`>('0x0000000000000000000000000000000000000000');

  // Resolve referrer wallet via server action (bypasses RLS)
  useEffect(() => {
    async function fetchReferrer() {
      if (!userAddress) return;
      try {
        const { getReferrerWallet } = await import('@/actions/referral/get-referrer-wallet');
        const wallet = await getReferrerWallet(userAddress);
        if (wallet) {
          setReferrer(wallet as `0x${string}`);
          console.log('[SwapPanel] Resolved referrer:', wallet);
        }
      } catch (err) {
        console.warn('[SwapPanel] Could not resolve referrer:', err);
      }
    }
    fetchReferrer();
  }, [userAddress]);

  // Debounce input for quote fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAmount(amountIn);
    }, 500);
    return () => clearTimeout(timer);
  }, [amountIn]);

  // Balances
  const { data: bnbBalance, refetch: refetchBnb } = useBalance({ address: userAddress });
  const { data: tokenBalanceRaw, refetch: refetchToken } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  });

  // Token Decimals
  const { data: tokenDecimals = 18 } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  // Quotes
  const amountInParsed = debouncedAmount && !isNaN(Number(debouncedAmount)) ? 
    (mode === 'buy' ? parseEther(debouncedAmount) : parseUnits(debouncedAmount, tokenDecimals)) : 0n;

  const { data: amountOutQuote, isLoading: isQuoteLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: mode === 'buy' ? 'getAmountOut' : 'getAmountIn',
    args: amountInParsed > 0n ? [poolAddress as `0x${string}`, amountInParsed] : undefined,
    query: { enabled: amountInParsed > 0n },
  });

  const estimatedReceive = amountOutQuote ? 
    (mode === 'buy' ? formatUnits(amountOutQuote, tokenDecimals) : formatEther(amountOutQuote)) : '';

  // Allowance check (only for sell)
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress && FACTORY_ADDRESS ? [userAddress, FACTORY_ADDRESS] : undefined,
    query: { enabled: mode === 'sell' && !!userAddress },
  });

  const needsApproval = mode === 'sell' && amountInParsed > 0n && (allowance || 0n) < amountInParsed;

  // Contracts Write
  const { writeContract, data: txHash, isPending: isWritePending, reset: resetWrite } = useWriteContract();
  
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Handle Success Side Effects
  useEffect(() => {
    if (isTxSuccess) {
      toast.success('Transaction Successful!');
      setAmountIn('');
      refetchBnb();
      refetchToken();
      refetchAllowance();
      if (onSuccess) onSuccess();
      resetWrite();
    }
  }, [isTxSuccess]);

  const handleAction = () => {
    if (!amountInParsed) return;

    if (needsApproval) {
      writeContract({
        address: poolAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [FACTORY_ADDRESS, amountInParsed],
      }, {
        onError: (err) => toast.error('Approval failed: ' + err.message)
      });
      return;
    }

    if (mode === 'buy') {
      writeContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'buyToken',
        args: [poolAddress as `0x${string}`, referrer],
        value: amountInParsed,
      }, {
        onError: (err) => toast.error('Buy failed: ' + err.message)
      });
    } else {
      writeContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'sellToken',
        args: [poolAddress as `0x${string}`, amountInParsed, referrer],
      }, {
        onError: (err) => toast.error('Sell failed: ' + err.message)
      });
    }
  };

  const isButtonDisabled = isMigrated || isWritePending || isTxConfirming || amountInParsed === 0n;

  return (
    <div className="w-full">
      <div className="flex bg-gray-800 p-1 border-b border-gray-800">
        <button
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            mode === 'buy' ? 'bg-green-500 text-white rounded-t-lg shadow-[0_-2px_0_0_#22c55e_inset]' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => { setMode('buy'); setAmountIn(''); }}
        >
          Buy
        </button>
        <button
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            mode === 'sell' ? 'bg-red-500 text-white rounded-t-lg shadow-[0_-2px_0_0_#ef4444_inset]' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => { setMode('sell'); setAmountIn(''); }}
        >
          Sell
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Input Card */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50">
          <div className="flex justify-between text-xs font-medium text-gray-400 mb-3">
            <span>You pay</span>
            <button 
               className="hover:text-white transition-colors"
               onClick={() => {
                 if (mode === 'buy' && bnbBalance) setAmountIn(formatEther(bnbBalance.value));
                 if (mode === 'sell' && tokenBalanceRaw) setAmountIn(formatUnits(tokenBalanceRaw as bigint, tokenDecimals));
               }}
            >
              Balance: {mode === 'buy' ? Number(bnbBalance ? formatEther(bnbBalance.value) : 0).toFixed(4) : Number(tokenBalanceRaw ? formatUnits(tokenBalanceRaw as bigint, tokenDecimals) : 0).toLocaleString()}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="w-full bg-transparent text-3xl font-bold text-white outline-none placeholder:text-gray-600 appearance-none"
            />
            <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700 font-medium text-white shrink-0">
               {mode === 'buy' ? 'BNB' : 'TOKEN'}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
             {['0.1', '0.5', '1'].map(val => (
                <button 
                  key={val}
                  onClick={() => setAmountIn(val)}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                >
                  {val} {mode === 'buy' ? 'BNB' : ''}
                </button>
             ))}
          </div>
        </div>

        <div className="flex justify-center -my-3 relative z-10">
          <div className="bg-gray-700 border-4 border-gray-900 rounded-full p-1.5 text-white shadow-lg">
            <ArrowDown className="w-4 h-4" />
          </div>
        </div>

        {/* Output Card */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50">
          <div className="flex justify-between text-xs font-medium text-gray-400 mb-3">
            <span>You receive (estimated)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-full text-3xl font-bold text-gray-500 truncate h-[36px] flex items-center">
               {isQuoteLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (estimatedReceive || '0.0')}
            </div>
            <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700 font-medium text-white shrink-0">
               {mode === 'buy' ? 'TOKEN' : 'BNB'}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {isMigrated ? (
          <button disabled className="w-full py-4 mt-2 bg-gray-800 text-gray-500 font-bold rounded-xl cursor-not-allowed border border-gray-700">
            Trading Migrated to {targetDex || 'DEX'}
          </button>
        ) : !userAddress ? (
          <button disabled className="w-full py-4 mt-2 bg-blue-600/50 text-white/50 font-bold rounded-xl cursor-not-allowed">
            Connect Wallet to Trade
          </button>
        ) : (
          <button 
            disabled={isButtonDisabled}
            onClick={handleAction}
            className={`w-full py-4 mt-2 text-white font-bold text-lg rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
              isButtonDisabled ? 'opacity-50 cursor-not-allowed bg-gray-700' : 
              needsApproval ? 'bg-blue-600 hover:bg-blue-500' :
              mode === 'buy' ? 'bg-green-500 hover:bg-green-400' : 'bg-red-500 hover:bg-red-400'
            }`}
          >
            {isWritePending || isTxConfirming ? (
               <><Loader2 className="w-5 h-5 animate-spin"/> Processing...</>
            ) : needsApproval ? (
               'Approve TOKEN'
            ) : (
               mode === 'buy' ? 'Place Trade' : 'Sell TOKEN'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
