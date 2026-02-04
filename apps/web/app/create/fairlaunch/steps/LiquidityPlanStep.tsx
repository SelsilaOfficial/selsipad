'use client';

import { DistributionPreview } from '@/components/fairlaunch/DistributionPreview';
import { calculateUnlockDate } from '@/lib/fairlaunch/helpers';
import { Lock, Droplet } from 'lucide-react';

interface LiquidityPlanStepProps {
  data: {
    liquidityPercent: number;
    lpLockMonths: number;
  };
  saleData: {
    tokensForSale: string;
    softcap: string;
    endTime: string;
  };
  paymentSymbol: string;
  onChange: (data: Partial<LiquidityPlanStepProps['data']>) => void;
  errors?: Record<string, string>;
}

const LP_LOCK_OPTIONS = [
  { value: 12, label: '12 months' },
  { value: 18, label: '18 months' },
  { value: 24, label: '24 months (2 years)' },
  { value: 36, label: '36 months (3 years)' },
  { value: 48, label: '48 months (4 years)' },
  { value: 60, label: '60 months (5 years)' },
];

export function LiquidityPlanStep({
  data,
  saleData,
  paymentSymbol,
  onChange,
  errors,
}: LiquidityPlanStepProps) {
  const unlockDate = saleData.endTime
    ? calculateUnlockDate(saleData.endTime, data.lpLockMonths)
    : null;

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Droplet className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-200 font-medium text-sm">Liquidity Plan</p>
            <p className="text-blue-300/70 text-xs mt-1">
              Fairlaunch requires minimum 70% of net raised funds to be added to liquidity. The
              percentage you choose determines how much goes to the DEX vs. project owner.
            </p>
          </div>
        </div>
      </div>

      {/* Liquidity Percentage Slider */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Liquidity Percentage: {data.liquidityPercent}% <span className="text-red-400">*</span>
        </label>
        <div className="space-y-4">
          <input
            type="range"
            min="70"
            max="100"
            step="1"
            value={data.liquidityPercent}
            onChange={(e) => onChange({ liquidityPercent: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>70% (Minimum)</span>
            <span>100% (All to Liquidity)</span>
          </div>
        </div>
        {errors?.liquidityPercent && (
          <p className="text-red-400 text-sm mt-2">{errors.liquidityPercent}</p>
        )}

        {/* Visual Indicator */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-3">
            <p className="text-xs text-blue-400 mb-1">To Liquidity</p>
            <p className="text-2xl font-bold text-blue-300">{data.liquidityPercent}%</p>
          </div>
          <div className="bg-purple-950/30 border border-purple-800/30 rounded-lg p-3">
            <p className="text-xs text-purple-400 mb-1">To Project Owner</p>
            <p className="text-2xl font-bold text-purple-300">{100 - data.liquidityPercent}%</p>
          </div>
        </div>
      </div>

      {/* LP Lock Duration */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          LP Lock Duration <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {LP_LOCK_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ lpLockMonths: option.value })}
              className={`p-3 rounded-lg border-2 transition ${
                data.lpLockMonths === option.value
                  ? 'border-purple-500 bg-purple-900/30'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="font-medium text-white text-sm">{option.label}</div>
            </button>
          ))}
        </div>
        {errors?.lpLockMonths && (
          <p className="text-red-400 text-sm mt-2">{errors.lpLockMonths}</p>
        )}
      </div>

      {/* Unlock Date */}
      {unlockDate && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-amber-200 font-medium text-sm">LP Token Unlock Date</p>
              <p className="text-amber-300/90 text-sm mt-1">{unlockDate}</p>
            </div>
          </div>
        </div>
      )}

      {/* Distribution Preview */}
      {saleData.softcap && saleData.tokensForSale && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Distribution Preview</h3>
          <DistributionPreview
            totalRaised={saleData.softcap}
            tokensForSale={saleData.tokensForSale}
            liquidityPercent={data.liquidityPercent}
            paymentSymbol={paymentSymbol}
          />
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-green-950/20 border border-green-800/30 rounded-lg p-4">
        <p className="text-green-200 font-medium text-sm mb-2">💡 Recommendations</p>
        <ul className="text-green-300/80 text-xs space-y-1">
          <li>• Higher liquidity % = Less price volatility and better trading experience</li>
          <li>• Longer LP lock = More trust from investors</li>
          <li>
            • Minimum 12 months recommended, but 24+ months shows long-term commitment
          </li>
        </ul>
      </div>
    </div>
  );
}
