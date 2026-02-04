'use client';

import { DollarSign, AlertCircle } from 'lucide-react';
import { calculateTotalUpfrontCost, calculateSuccessFeeSplit } from '@/lib/fairlaunch/helpers';

interface FeeBreakdownProps {
  network: string;
  tokenSource: 'factory' | 'existing';
  softcap?: string;
  showExample?: boolean;
}

export function FeeBreakdown({ network, tokenSource, softcap, showExample = true }: FeeBreakdownProps) {
  const upfrontCost = calculateTotalUpfrontCost(network, tokenSource);
  const tokenCreationFee = tokenSource === 'factory'
    ? (network.includes('bsc')
        ? '0.2'
        : network === 'base'
        ? '0.05'
        : '0.01')
    : '0';
  const deploymentFee = network.includes('bsc') ? '0.2' : '0.1';

  const exampleSplit = softcap
    ? calculateSuccessFeeSplit(softcap)
    : null;

  return (
    <div className="space-y-6">
      {/* Upfront Costs */}
      <div className="bg-gradient-to-br from-blue-950/30 to-purple-950/30 border border-blue-800/40 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-blue-200">Upfront Costs (Pay Now)</h3>
        </div>

        <div className="space-y-3">
          {tokenSource === 'factory' && (
            <div className="flex items-center justify-between pb-2">
              <span className="text-gray-300">Token Creation Fee</span>
              <span className="font-medium text-blue-300">
                {tokenCreationFee} {upfrontCost.symbol}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pb-2 border-b border-gray-700">
            <span className="text-gray-300">Deployment Fee</span>
            <span className="font-medium text-blue-300">
              {deploymentFee} {upfrontCost.symbol}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="font-semibold text-white">Total Now</span>
            <span className="font-bold text-xl text-blue-300">
              {upfrontCost.amount} {upfrontCost.symbol}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            These fees go 100% to Treasury Wallet to cover deployment costs and platform operations.
          </p>
        </div>
      </div>

      {/* Success Fee */}
      <div className="bg-gradient-to-br from-green-950/30 to-emerald-950/30 border border-green-800/40 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-green-400" />
          <h3 className="font-semibold text-green-200">Success Fee (If Softcap Met)</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Platform Success Fee</span>
            <span className="font-medium text-green-300">5% of raised funds</span>
          </div>

          <div className="bg-green-950/40 border border-green-800/30 rounded-lg p-4 space-y-2 text-sm">
            <p className="text-green-200 font-medium mb-2">Fee Distribution via FeeSplitter:</p>
            <div className="flex justify-between text-green-300/90">
              <span>→ Treasury</span>
              <span>2.5% (50% of fee)</span>
            </div>
            <div className="flex justify-between text-green-300/90">
              <span>→ Referral Pool</span>
              <span>2.0% (40% of fee)</span>
            </div>
            <div className="flex justify-between text-green-300/90">
              <span>→ SBT Staking</span>
              <span>0.5% (10% of fee)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Example Calculation */}
      {showExample && exampleSplit && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h4 className="font-semibold text-gray-200 mb-4">
            Example at Softcap ({softcap} {upfrontCost.symbol})
          </h4>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Raised</span>
              <span className="text-gray-200 font-medium">
                {softcap} {upfrontCost.symbol}
              </span>
            </div>

            <div className="flex justify-between text-red-300">
              <span>Platform Fee (5%)</span>
              <span className="font-medium">
                -{exampleSplit.total.toFixed(4)} {upfrontCost.symbol}
              </span>
            </div>

            <div className="pl-4 space-y-1 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>• Treasury</span>
                <span>{exampleSplit.treasury.toFixed(4)} {upfrontCost.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span>• Referral Pool</span>
                <span>{exampleSplit.referralPool.toFixed(4)} {upfrontCost.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span>• SBT Staking</span>
                <span>{exampleSplit.sbtStaking.toFixed(4)} {upfrontCost.symbol}</span>
              </div>
            </div>

            <div className="flex justify-between pt-2 border-t border-gray-700">
              <span className="text-gray-200 font-medium">Net for Project</span>
              <span className="text-green-300 font-semibold">
                {exampleSplit.netRaised.toFixed(4)} {upfrontCost.symbol}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
