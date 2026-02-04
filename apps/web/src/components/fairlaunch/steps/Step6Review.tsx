import { Rocket, Check, AlertTriangle, ShieldCheck, Lock } from 'lucide-react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { erc20Abi, parseUnits, formatUnits } from 'viem';
import { CONTRACT_ADDRESSES, getChainId } from '@/lib/contracts/addresses';
import { useState, useEffect } from 'react';

interface Step6Props {
  data: any;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function Step6Review({ data, onSubmit, onBack, isSubmitting }: Step6Props) {
  const { address } = useAccount();
  const [isApproving, setIsApproving] = useState(false);
  
  // Calculate Totals
  const decimals = parseInt(data.step1?.token_decimals || '18');
  const chainId = getChainId(data.step1?.network || 'bnb');
  const factoryAddress = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]?.fairlaunchFactory;
  
  // Parse Amounts
  const tokensForSaleStr = (data.params?.tokens_for_sale || '0').replace(/,/g, '');
  const totalSupplyStr = (data.step1?.token_supply || '0').replace(/,/g, '');
  
  let totalRequired = BigInt(0);
  let totalVested = BigInt(0);
  
  try {
      const tokensForSale = parseUnits(tokensForSaleStr, decimals);
      const totalSupply = parseUnits(totalSupplyStr, decimals);
      const liquidityPercent = BigInt(Math.floor((data.liquidity?.liquidity_percent || 0) * 100)); // BPS if needed, but here usually just integer percent
      // Note: In hook we use percent * 100 for BPS. Here let's assume raw percent for calculation if hook does logic.
      // Hook logic: `liquidityTokens = (tokensForSale * BigInt(params.liquidity_percent)) / BigInt(100)`
      const liquidityTokens = (tokensForSale * BigInt(data.liquidity?.liquidity_percent || 0)) / BigInt(100);
      
      // Hook logic for remaining:
      const totalUsed = tokensForSale + liquidityTokens;
      let remainingTokens = BigInt(0);
      if (totalSupply > totalUsed) {
          remainingTokens = totalSupply - totalUsed;
      }
      
      // Calculate Vesting
      if (data.team_vesting?.schedule) {
          data.team_vesting.schedule.forEach((item: any) => {
              // Hooks uses: percentage * 100 (BPS equiv in math) / 10000
              const amount = (remainingTokens * BigInt(Math.floor(item.percentage * 100))) / BigInt(10000);
              totalVested += amount;
          });
      }
      
      totalRequired = tokensForSale + totalVested;
      
  } catch (e) {
      console.error("Error calculating token amounts", e);
  }

  // Allowance Check
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: data.step1?.token_address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address as `0x${string}`, factoryAddress as `0x${string}`],
    query: {
        enabled: !!address && !!factoryAddress && !!data.step1?.token_address,
        refetchInterval: 2000 
    }
  });
  
  // Approve Write
  const { writeContract: approve, data: approveHash, isPending: isApprovePending } = useWriteContract();
  
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  useEffect(() => {
     if (isApproveSuccess) {
         refetchAllowance();
         setIsApproving(false);
     }
  }, [isApproveSuccess, refetchAllowance]);

  const handleApprove = () => {
     if (!factoryAddress) return;
     setIsApproving(true);
     approve({
        address: data.step1?.token_address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [factoryAddress as `0x${string}`, totalRequired],
     });
  };

  const isApproved = allowance ? allowance >= totalRequired : false;
  const isApprovingState = isApprovePending || isApproveConfirming;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center space-y-4">
         <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
            <Rocket className="w-10 h-10 text-green-400" />
         </div>
         <h2 className="text-2xl font-bold text-white">Ready to Launch!</h2>
         <p className="text-gray-400 max-w-lg mx-auto">
            Review your fairlaunch details below. Once deployed, your sale will be <strong className="text-white">live immediately</strong> (Instant Deploy).
         </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Token Summary */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4 border-b border-gray-800 pb-2">Token Details</h3>
            <div className="space-y-3 text-sm">
               <div className="flex justify-between">
                  <span className="text-gray-400">Name</span>
                  <span className="text-white">{data.step1?.token_name}</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-gray-400">Symbol</span>
                  <span className="text-white">{data.step1?.token_symbol}</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-gray-400">Decimals</span>
                  <span className="text-white">{data.step1?.token_decimals}</span>
               </div>
               <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-gray-400">Status</span>
                  {data.step1?.is_platform_token ? (
                     <span className="flex items-center gap-1 text-green-400 font-bold text-xs">
                        <ShieldCheck className="w-3 h-3" /> SAFU Verified
                     </span>
                  ) : (
                     <span className="flex items-center gap-1 text-blue-400 font-bold text-xs">
                        <Check className="w-3 h-3" /> Scanned
                     </span>
                  )}
               </div>
            </div>
         </div>

         {/* Sale Summary */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4 border-b border-gray-800 pb-2">Sale Details</h3>
            <div className="space-y-3 text-sm">
               <div className="flex justify-between">
                  <span className="text-gray-400">Sale Amount</span>
                  <span className="text-white bg-gray-800 px-2 rounded">{Number(formatUnits(totalRequired - totalVested, decimals)).toLocaleString()} {data.step1?.token_symbol}</span>
               </div>
               {totalVested > 0 && (
                   <div className="flex justify-between">
                      <span className="text-gray-400">Team Vesting</span>
                      <span className="text-purple-400 bg-purple-900/20 px-2 rounded">{Number(formatUnits(totalVested, decimals)).toLocaleString()} {data.step1?.token_symbol}</span>
                   </div>
               )}
               <div className="flex justify-between">
                  <span className="text-gray-400">Total Required</span>
                  <span className="text-orange-400 font-bold">{Number(formatUnits(totalRequired, decimals)).toLocaleString()} {data.step1?.token_symbol}</span>
               </div>
               <div className="flex justify-between border-t border-gray-800 pt-2 mt-2">
                  <span className="text-gray-400">Softcap</span>
                  <span className="text-yellow-400">{data.params?.softcap} {data.step1?.network === 'bnb' ? 'BNB' : 'ETH'}</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-gray-400">Liquidity</span>
                  <span className="text-cyan-400">{data.liquidity?.liquidity_percent}%</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-gray-400">Lock Time</span>
                  <span className="text-white">{data.liquidity?.lp_lock_months} Months</span>
               </div>
            </div>
         </div>
      </div>

      {/* Warning */}
      <div className="bg-yellow-900/10 border border-yellow-800/30 p-4 rounded-xl flex gap-3">
         <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
         <p className="text-sm text-yellow-200/80">
            <strong>Disclaimer:</strong> Selsipad provides the platform technology. You are responsible for the project legality and marketing.
            Once deployed, parameters cannot be changed.
         </p>
      </div>

      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-gray-800 text-gray-300 font-bold rounded-lg hover:bg-gray-700 transition"
        >
          ← Back
        </button>
        
        <div className="flex gap-4">
            {!isApproved ? (
                <button
                  onClick={handleApprove}
                  disabled={isApprovingState}
                  className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApprovingState ? (
                      <>Processing...</>
                  ) : (
                      <><Lock className="w-4 h-4" /> Approve Tokens</>
                  )}
                </button>
            ) : (
                <button
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-green-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Deploying...' : 'Deploy Fairlaunch 🚀'}
                </button>
            )}
        </div>
      </div>
    </div>
  );
}
