'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { getAvailableDexForNetwork } from '@/lib/web3/dex-config';
import { estimatePriceAtSoftcap, calculateDuration, formatNumber } from '@/lib/fairlaunch/helpers';

interface SaleParamsStepProps {
  data: {
    tokensForSale: string;
    softcap: string;
    startTime: string;
    endTime: string;
    minContribution: string;
    maxContribution: string;
    dexPlatform: string;
    listingPremiumBps: number;
  };
  network: string;
  paymentSymbol: string;
  onChange: (data: Partial<SaleParamsStepProps['data']>) => void;
  errors?: Record<string, string>;
}

export function SaleParamsStep({ data, network, paymentSymbol, onChange, errors }: SaleParamsStepProps) {
  const [estimatedPrice, setEstimatedPrice] = useState<string>('0');
  const [duration, setDuration] = useState<number>(0);

  const dexOptions = getAvailableDexForNetwork(network);

  // Calculate estimated price
  useEffect(() => {
    if (data.softcap && data.tokensForSale) {
      const price = estimatePriceAtSoftcap({
        softcap: data.softcap,
        tokensForSale: data.tokensForSale,
      });
      setEstimatedPrice(price);
    }
  }, [data.softcap, data.tokensForSale]);

  // Calculate duration
  useEffect(() => {
    if (data.startTime && data.endTime) {
      const days = calculateDuration(data.startTime, data.endTime);
      setDuration(days);
    }
  }, [data.startTime, data.endTime]);

  // Set default DEX if not selected
  useEffect(() => {
    if (!data.dexPlatform && dexOptions.length > 0) {
      const firstDex = dexOptions[0];
      if (firstDex) {
        onChange({ dexPlatform: firstDex.id });
      }
    }
  }, [network, dexOptions]);

  return (
    <div className="space-y-6">
      {/* Tokens for Sale */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Tokens for Sale <span className="text-red-400">*</span>
        </label>
        <input
          type="number"
          value={data.tokensForSale}
          onChange={(e) => onChange({ tokensForSale: e.target.value })}
          placeholder="1000000"
          min="0"
          step="any"
          className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 transition
            ${
              errors?.tokensForSale
                ? 'border-red-500 focus:border-red-400'
                : 'border-gray-700 focus:border-purple-500'
            }
            focus:outline-none focus:ring-2 focus:ring-purple-500/20
          `}
        />
        {errors?.tokensForSale && (
          <p className="text-red-400 text-sm mt-2">{errors.tokensForSale}</p>
        )}
        {data.tokensForSale && (
          <p className="text-gray-400 text-xs mt-1">
            {formatNumber(parseFloat(data.tokensForSale))} tokens
          </p>
        )}
      </div>

      {/* Softcap */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Softcap (Minimum to Raise) <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type="number"
            value={data.softcap}
            onChange={(e) => onChange({ softcap: e.target.value })}
            placeholder="10"
            min="0"
            step="any"
            className={`w-full px-4 py-3 pr-16 bg-gray-800 border rounded-lg text-white placeholder-gray-500 transition
              ${
                errors?.softcap
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-gray-700 focus:border-purple-500'
              }
              focus:outline-none focus:ring-2 focus:ring-purple-500/20
            `}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            {paymentSymbol}
          </span>
        </div>
        {errors?.softcap && <p className="text-red-400 text-sm mt-2">{errors.softcap}</p>}
      </div>

      {/* Price Preview */}
      {data.softcap && data.tokensForSale && (
        <div className="bg-gradient-to-br from-purple-950/30 to-blue-950/30 border border-purple-800/40 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <p className="text-purple-200 font-medium text-sm">Estimated Price at Softcap</p>
          </div>
          <div className="text-2xl font-bold text-purple-300">
            {parseFloat(estimatedPrice).toFixed(10)} {paymentSymbol}
          </div>
          <p className="text-xs text-purple-300/70 mt-1">per token</p>
        </div>
      )}

      {/* Start Time */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Start Time <span className="text-red-400">*</span>
        </label>
        <input
          type="datetime-local"
          value={data.startTime}
          onChange={(e) => onChange({ startTime: e.target.value })}
          min={new Date().toISOString().slice(0, 16)}
          className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white transition
            ${
              errors?.startTime
                ? 'border-red-500 focus:border-red-400'
                : 'border-gray-700 focus:border-purple-500'
            }
            focus:outline-none focus:ring-2 focus:ring-purple-500/20
          `}
        />
        {errors?.startTime && <p className="text-red-400 text-sm mt-2">{errors.startTime}</p>}
        <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
      </div>

      {/* End Time */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          End Time <span className="text-red-400">*</span>
        </label>
        <input
          type="datetime-local"
          value={data.endTime}
          onChange={(e) => onChange({ endTime: e.target.value })}
          min={data.startTime || new Date().toISOString().slice(0, 16)}
          className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white transition
            ${
              errors?.endTime
                ? 'border-red-500 focus:border-red-400'
                : 'border-gray-700 focus:border-purple-500'
            }
            focus:outline-none focus:ring-2 focus:ring-purple-500/20
          `}
        />
        {errors?.endTime && <p className="text-red-400 text-sm mt-2">{errors.endTime}</p>}
        <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
        {duration > 0 && (
          <p className="text-purple-400 text-xs mt-1 font-medium">
            Duration: {duration} day{duration !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Min/Max Contribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium textgray-300 mb-2">
            Min Contribution <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              value={data.minContribution}
              onChange={(e) => onChange({ minContribution: e.target.value })}
              placeholder="0.1"
              min="0"
              step="any"
              className={`w-full px-4 py-3 pr-16 bg-gray-800 border rounded-lg text-white placeholder-gray-500 transition
                ${
                  errors?.minContribution
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-700 focus:border-purple-500'
                }
                focus:outline-none focus:ring-2 focus:ring-purple-500/20
              `}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              {paymentSymbol}
            </span>
          </div>
          {errors?.minContribution && (
            <p className="text-red-400 text-sm mt-2">{errors.minContribution}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Max Contribution <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              value={data.maxContribution}
              onChange={(e) => onChange({ maxContribution: e.target.value })}
              placeholder="10"
              min="0"
              step="any"
              className={`w-full px-4 py-3 pr-16 bg-gray-800 border rounded-lg text-white placeholder-gray-500 transition
                ${
                  errors?.maxContribution
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-700 focus:border-purple-500'
                }
                focus:outline-none focus:ring-2 focus:ring-purple-500/20
              `}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              {paymentSymbol}
            </span>
          </div>
          {errors?.maxContribution && (
            <p className="text-red-400 text-sm mt-2">{errors.maxContribution}</p>
          )}
        </div>
      </div>

      {/* DEX Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          DEX for Listing <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dexOptions.map((dex) => (
            <button
              key={dex.id}
              type="button"
              onClick={() => onChange({ dexPlatform: dex.id })}
              className={`p-4 rounded-lg border-2 transition text-left ${
                data.dexPlatform === dex.id
                  ? 'border-purple-500 bg-purple-900/30'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="font-medium text-white">{dex.name}</div>
            </button>
          ))}
        </div>
        {errors?.dexPlatform && <p className="text-red-400 text-sm mt-2">{errors.dexPlatform}</p>}
      </div>

      {/* Listing Premium */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Listing Premium: {(data.listingPremiumBps / 100).toFixed(1)}%
        </label>
        <input
          type="range"
          min="0"
          max="1000"
          step="10"
          value={data.listingPremiumBps}
          onChange={(e) => onChange({ listingPremiumBps: parseInt(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0%</span>
          <span>10%</span>
        </div>
        <p className="text-gray-400 text-xs mt-2">
          Premium adds extra funds above softcap price when listing on DEX
        </p>
      </div>
    </div>
  );
}
