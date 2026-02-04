'use client';

import { DollarSign, TrendingUp, User } from 'lucide-react';
import { calculateDistribution, formatNumber } from '@/lib/fairlaunch/helpers';

interface DistributionPreviewProps {
  totalRaised: string;
  tokensForSale: string;
  liquidityPercent: number;
  paymentSymbol?: string;
}

export function DistributionPreview({
  totalRaised,
  tokensForSale,
  liquidityPercent,
  paymentSymbol = 'ETH',
}: DistributionPreviewProps) {
  if (!totalRaised || !tokensForSale || parseFloat(totalRaised) === 0) {
    return (
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 text-center">
        <p className="text-gray-400 text-sm">
          Enter softcap and tokens for sale to see distribution preview
        </p>
      </div>
    );
  }

  const distribution = calculateDistribution({
    totalRaised,
    tokensForSale,
    liquidityPercent,
  });

  return (
    <div className="bg-gradient-to-br from-purple-950/30 to-blue-950/30 border border-purple-800/40 rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-purple-400" />
        <h3 className="font-semibold text-purple-200">Distribution Breakdown</h3>
        <span className="text-sm text-gray-400">(at softcap: {totalRaised} {paymentSymbol})</span>
      </div>

      {/* Platform Fee */}
      <div className="pb-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Platform Fee (5%)</span>
          <span className="font-medium text-red-300">
            -{distribution.platformFee.total.toFixed(4)} {paymentSymbol}
          </span>
        </div>
        <div className="pl-4 space-y-1 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>→ Treasury (2.5%)</span>
            <span>{distribution.platformFee.treasury.toFixed(4)} {paymentSymbol}</span>
          </div>
          <div className="flex justify-between">
            <span>→ Referral Pool (2.0%)</span>
            <span>{distribution.platformFee.referralPool.toFixed(4)} {paymentSymbol}</span>
          </div>
          <div className="flex justify-between">
            <span>→ SBT Staking (0.5%)</span>
            <span>{distribution.platformFee.sbtStaking.toFixed(4)} {paymentSymbol}</span>
          </div>
        </div>
      </div>

      {/* Net Raised */}
      <div className="pb-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300 font-medium">Net Raised (95%)</span>
          <span className="font-semibold text-green-300">
            {distribution.netRaised.toFixed(4)} {paymentSymbol}
          </span>
        </div>
      </div>

      {/* Liquidity Allocation */}
      <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-200">
                To Liquidity ({liquidityPercent}%)
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-blue-300">
                <span>{paymentSymbol}:</span>
                <span className="font-medium">
                  {distribution.liquidity.funds.toFixed(4)} {paymentSymbol}
                </span>
              </div>
              <div className="flex justify-between text-blue-300">
                <span>Tokens:</span>
                <span className="font-medium">{formatNumber(distribution.liquidity.tokens)}</span>
              </div>
            </div>
            <p className="text-xs text-blue-400/70 mt-2">
              These will be added to the DEX to create the trading pair
            </p>
          </div>
        </div>
      </div>

      {/* Project Owner Allocation */}
      <div className="bg-purple-950/30 border border-purple-800/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-200">
                To Project Owner ({distribution.projectOwner.percent}%)
              </span>
            </div>
            <div className="flex justify-between text-purple-300">
              <span className="text-sm">{paymentSymbol}:</span>
              <span className="font-medium text-sm">
                {distribution.projectOwner.funds.toFixed(4)} {paymentSymbol}
              </span>
            </div>
            <p className="text-xs text-purple-400/70 mt-2">
              Remaining funds after liquidity provision
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
