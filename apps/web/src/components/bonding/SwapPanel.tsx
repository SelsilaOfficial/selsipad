'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseEther, formatEther, parseAbi, parseUnits, formatUnits } from 'viem';
import { Loader2, ArrowDown, Info } from 'lucide-react';
import { toast } from 'sonner';

interface SwapPanelProps {
  poolAddress: string;
  targetDex: string;
  isMigrated: boolean;
  onSuccess?: () => void;
}

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_BONDING_CURVE_FACTORY_ADDRESS as `0x${string}`;

// PancakeSwap V2 Router (BSC Testnet)
const PCS_ROUTER = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1' as `0x${string}`;
const WBNB = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' as `0x${string}`;

const FACTORY_ABI = parseAbi([
  'function buyToken(address _token, address _referrer, uint256 _minAmountOut) external payable',
  'function sellToken(address _token, uint256 tokenAmount, address _referrer, uint256 _minAmountOut) external',
  'function getAmountOut(address _token, uint256 ethIn) external view returns (uint256 tokensOut)',
  'function getAmountIn(address _token, uint256 tokenAmount) external view returns (uint256 ethOut)',
]);

const PCS_ROUTER_ABI = parseAbi([
  'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external',
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
  const [slippage, setSlippage] = useState('1.0');
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

  // Parse input amount
  const amountInParsed = debouncedAmount && !isNaN(Number(debouncedAmount)) ? 
    (mode === 'buy' ? parseEther(debouncedAmount) : parseUnits(debouncedAmount, tokenDecimals)) : 0n;

  // Quotes — Bonding Curve mode
  const { data: amountOutQuote, isLoading: isQuoteLoadingBC } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: mode === 'buy' ? 'getAmountOut' : 'getAmountIn',
    args: amountInParsed > 0n ? [poolAddress as `0x${string}`, amountInParsed] : undefined,
    query: { enabled: amountInParsed > 0n && !isMigrated },
  });

  // Quotes — DEX mode (PancakeSwap Router)
  const dexPath = mode === 'buy'
    ? [WBNB, poolAddress as `0x${string}`]
    : [poolAddress as `0x${string}`, WBNB];
  const { data: dexAmountsOut, isLoading: isQuoteLoadingDEX } = useReadContract({
    address: PCS_ROUTER,
    abi: PCS_ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: amountInParsed > 0n ? [amountInParsed, dexPath] : undefined,
    query: { enabled: amountInParsed > 0n && isMigrated },
  });

  const isQuoteLoading = isMigrated ? isQuoteLoadingDEX : isQuoteLoadingBC;
  const rawQuoteValue = isMigrated
    ? (dexAmountsOut ? (dexAmountsOut as bigint[])[1] : undefined)
    : amountOutQuote;

  const estimatedReceiveRaw = rawQuoteValue ? 
    (mode === 'buy' ? formatUnits(rawQuoteValue as bigint, tokenDecimals) : formatEther(rawQuoteValue as bigint)) : '';
  // Format: tokens → max 2 decimals with commas, BNB → max 8 decimals
  const estimatedReceive = estimatedReceiveRaw
    ? mode === 'buy'
      ? Number(estimatedReceiveRaw).toLocaleString(undefined, { maximumFractionDigits: 2 })
      : Number(estimatedReceiveRaw).toFixed(8)
    : '';

  // Allowance check (only for sell) — target changes based on mode
  const approvalTarget = isMigrated ? PCS_ROUTER : FACTORY_ADDRESS;
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress && approvalTarget ? [userAddress, approvalTarget] : undefined,
    query: { enabled: mode === 'sell' && !!userAddress },
  });

  const needsApproval = mode === 'sell' && amountInParsed > 0n && (allowance || 0n) < amountInParsed;

  // Contracts Write
  const { writeContract, data: txHash, isPending: isWritePending, reset: resetWrite } = useWriteContract();
  
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Track whether last tx was an approval (don't clear input after approve)
  const [lastAction, setLastAction] = useState<'approve' | 'trade' | null>(null);

  // Handle Success Side Effects
  useEffect(() => {
    if (isTxSuccess) {
      if (lastAction === 'approve') {
        toast.success('Approval Successful! Now click Sell to proceed.');
        refetchAllowance();
        resetWrite();
        setLastAction(null);
        // Don't clear amountIn — user wants to sell
      } else {
        toast.success('Transaction Successful!');
        setAmountIn('');
        refetchBnb();
        refetchToken();
        refetchAllowance();
        if (onSuccess) onSuccess();
        resetWrite();
        setLastAction(null);
      }
    }
  }, [isTxSuccess]);

  const handleAction = () => {
    if (!amountInParsed) return;

    if (needsApproval) {
      setLastAction('approve');
      const MAX_UINT256 = 2n ** 256n - 1n;
      writeContract({
        address: poolAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [approvalTarget, MAX_UINT256],
      }, {
        onError: (err) => toast.error('Approval failed: ' + err.message)
      });
      return;
    }

    setLastAction('trade');
    const slippageBps = Math.round(parseFloat(slippage) * 100);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min

    if (isMigrated) {
      // ── DEX Mode: PancakeSwap V2 Router ──
      if (mode === 'buy') {
        let minOut = 0n;
        if (rawQuoteValue) {
          minOut = (rawQuoteValue as bigint) - ((rawQuoteValue as bigint) * BigInt(slippageBps) / 10000n);
        }
        writeContract({
          address: PCS_ROUTER,
          abi: PCS_ROUTER_ABI,
          functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
          args: [minOut, [WBNB, poolAddress as `0x${string}`], userAddress!, deadline],
          value: amountInParsed,
        }, {
          onError: (err) => toast.error('Buy failed: ' + err.message)
        });
      } else {
        let minOut = 0n;
        if (rawQuoteValue) {
          minOut = (rawQuoteValue as bigint) - ((rawQuoteValue as bigint) * BigInt(slippageBps) / 10000n);
        }
        writeContract({
          address: PCS_ROUTER,
          abi: PCS_ROUTER_ABI,
          functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
          args: [amountInParsed, minOut, [poolAddress as `0x${string}`, WBNB], userAddress!, deadline],
        }, {
          onError: (err) => toast.error('Sell failed: ' + err.message)
        });
      }
    } else {
      // ── Bonding Curve Mode ──
      if (mode === 'buy') {
        let minOut = 0n;
        if (estimatedReceiveRaw) {
          const estimated = parseUnits(String(estimatedReceiveRaw), 18);
          minOut = estimated - (estimated * BigInt(slippageBps) / 10000n);
        }
        writeContract({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'buyToken',
          args: [poolAddress as `0x${string}`, referrer, minOut],
          value: amountInParsed,
        }, {
          onError: (err) => toast.error('Buy failed: ' + err.message)
        });
      } else {
        let minOut = 0n;
        if (estimatedReceiveRaw) {
          const estimated = parseEther(String(estimatedReceiveRaw));
          minOut = estimated - (estimated * BigInt(slippageBps) / 10000n);
        }
        writeContract({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'sellToken',
          args: [poolAddress as `0x${string}`, amountInParsed, referrer, minOut],
        }, {
          onError: (err) => toast.error('Sell failed: ' + err.message)
        });
      }
    }
  };

  const isButtonDisabled = isWritePending || isTxConfirming || amountInParsed === 0n;

  return (
    <div className="w-full">
      {/* Buy/Sell Toggle */}
      <div className="flex gap-2 mb-4 p-1 rounded-[16px] bg-black/40 border border-white/5">
        <button
          onClick={() => { setMode('buy'); setAmountIn(''); }}
          className={`flex-1 py-2.5 rounded-[12px] font-bold text-sm transition-all ${
            mode === 'buy'
              ? 'bg-gradient-to-r from-[#39AEC4] to-[#4EABC8] text-white shadow-lg shadow-[#39AEC4]/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setMode('sell'); setAmountIn(''); }}
          className={`flex-1 py-2.5 rounded-[12px] font-bold text-sm transition-all ${
            mode === 'sell'
              ? 'bg-gradient-to-r from-[#756BBA] to-[#8B7BC8] text-white shadow-lg shadow-[#756BBA]/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Sell
        </button>
      </div>

      {/* From Input */}
      <div className="mb-3">
        <label className="text-xs text-gray-400 mb-1.5 block">You {mode === 'buy' ? 'Pay' : 'Sell'}</label>
        <div className="rounded-[16px] bg-black/40 border border-[#39AEC4]/30 p-3 hover:border-[#39AEC4]/50 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="bg-transparent text-xl font-bold text-white outline-none flex-1 w-0 placeholder:text-gray-600"
            />
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${mode === 'buy' ? 'bg-[#39AEC4]/10 text-[#39AEC4]' : 'bg-[#756BBA]/10 text-[#756BBA]'}`}>
              <span className="font-bold text-sm">{mode === 'buy' ? 'BNB' : 'TOKEN'}</span>
            </div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <button 
              className="text-xs text-gray-500 hover:text-[#39AEC4] transition-colors"
              onClick={() => {
                if (mode === 'buy' && bnbBalance) setAmountIn(formatEther(bnbBalance.value));
                if (mode === 'sell' && tokenBalanceRaw) setAmountIn(formatUnits(tokenBalanceRaw as bigint, tokenDecimals));
              }}
            >
              Balance: {mode === 'buy' ? Number(bnbBalance ? formatEther(bnbBalance.value) : 0).toFixed(4) : Number(tokenBalanceRaw ? formatUnits(tokenBalanceRaw as bigint, tokenDecimals) : 0).toLocaleString()}
            </button>
            
            {/* Quick Amount Buttons */}
            {mode === 'buy' && (
              <div className="flex gap-1.5">
                {['0.1', '0.5', '1'].map(val => (
                  <button 
                    key={val}
                    onClick={() => setAmountIn(val)}
                    className="px-2 py-0.5 text-[10px] font-medium bg-white/5 hover:bg-[#39AEC4]/20 hover:text-[#39AEC4] text-gray-400 rounded transition-colors border border-white/5"
                  >
                    {val}
                  </button>
                ))}
              </div>
            )}
            {mode === 'sell' && (
              <div className="flex gap-1.5">
                 <button 
                    onClick={() => {
                        if (tokenBalanceRaw) {
                           const half = (tokenBalanceRaw as bigint) / 2n;
                           setAmountIn(formatUnits(half, tokenDecimals));
                        }
                    }}
                    className="px-2 py-0.5 text-[10px] font-medium bg-white/5 hover:bg-[#756BBA]/20 hover:text-[#756BBA] text-gray-400 rounded transition-colors border border-white/5"
                  >
                    50%
                  </button>
                  <button 
                    onClick={() => {
                        if (tokenBalanceRaw) {
                           setAmountIn(formatUnits(tokenBalanceRaw as bigint, tokenDecimals));
                        }
                    }}
                    className="px-2 py-0.5 text-[10px] font-medium bg-white/5 hover:bg-[#756BBA]/20 hover:text-[#756BBA] text-gray-400 rounded transition-colors border border-white/5"
                  >
                    Max
                  </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vertical divider with arrow */}
      <div className="flex justify-center -my-3 relative z-10">
        <div className="bg-[#030614] border border-[#39AEC4]/30 rounded-full p-1.5 text-gray-400">
          <ArrowDown className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* To Input */}
      <div className="mb-4">
        <label className="text-xs text-gray-400 mb-1.5 block mt-2">You {mode === 'buy' ? 'Receive' : 'Get'}</label>
        <div className="rounded-[16px] bg-black/40 border border-[#39AEC4]/30 p-3">
          <div className="flex items-center justify-between">
            <div className="bg-transparent text-xl font-bold text-gray-400 flex-1 w-0 flex items-center h-[32px]">
               {isQuoteLoading ? <Loader2 className="w-5 h-5 animate-spin text-[#39AEC4]" /> : (estimatedReceive || '0.0')}
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${mode === 'buy' ? 'bg-[#756BBA]/10 text-[#756BBA]' : 'bg-[#39AEC4]/10 text-[#39AEC4]'}`}>
              <span className="font-bold text-sm">{mode === 'buy' ? 'TOKEN' : 'BNB'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Slippage Settings */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400">Slippage Tolerance</label>
        </div>
        <div className="flex gap-2">
          {['0.5', '1.0', '2.0'].map(val => (
            <button
              key={val}
              onClick={() => setSlippage(val)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                slippage === val
                  ? 'bg-[#39AEC4]/20 text-[#39AEC4] border border-[#39AEC4]/50'
                  : 'bg-black/40 text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              {val}%
            </button>
          ))}
        </div>
      </div>

      {/* Action Button */}
      {!userAddress ? (
        <button disabled className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#39AEC4]/10 text-[#39AEC4]/50 border border-[#39AEC4]/20 cursor-not-allowed">
          Connect Wallet to Trade
        </button>
      ) : (
        <button
          disabled={isButtonDisabled}
          onClick={handleAction}
          className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
            isButtonDisabled 
              ? 'opacity-50 cursor-not-allowed bg-black/40 text-gray-500 border border-white/10' 
              : needsApproval 
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white shadow-blue-500/20'
              : mode === 'buy'
                ? 'bg-gradient-to-r from-[#39AEC4] to-[#4EABC8] hover:from-[#39AEC4]/90 hover:to-[#4EABC8]/90 text-white shadow-[#39AEC4]/20'
                : 'bg-gradient-to-r from-[#756BBA] to-[#8B7BC8] hover:from-[#756BBA]/90 hover:to-[#8B7BC8]/90 text-white shadow-[#756BBA]/20'
          }`}
        >
          {isWritePending || isTxConfirming ? (
             <><Loader2 className="w-4 h-4 animate-spin"/> Processing...</>
          ) : needsApproval ? (
             'Approve TOKEN'
          ) : (
             mode === 'buy' ? 'Buy TOKEN' : 'Sell TOKEN'
          )}
        </button>
      )}

      {/* Info */}
      <div className={`mt-4 p-3 ${isMigrated ? 'bg-green-500/10 border-green-500/20' : 'bg-amber-500/10 border-amber-500/20'} border rounded-xl`}>
        <p className={`text-xs ${isMigrated ? 'text-green-200/80' : 'text-amber-200/80'} flex items-start gap-2 leading-relaxed`}>
          <Info className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isMigrated ? 'text-green-400' : 'text-amber-400'}`} />
          <span>{isMigrated 
            ? 'This token has graduated! Trading on PancakeSwap V2 LP. Liquidity is permanently locked.' 
            : 'Bonding curve pricing increases with every buy. Early buyers get more tokens per BNB.'
          }</span>
        </p>
      </div>
    </div>
  );
}
