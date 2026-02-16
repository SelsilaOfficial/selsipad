/**
 * DEX Selection Component
 * Allows users to choose between Raydium and Orca for bonding curve graduation
 */

import React from 'react';
import { DEXType } from '@selsipad/shared';

interface DEXSelectProps {
  value: DEXType | null;
  onChange: (dex: DEXType) => void;
  disabled?: boolean;
  compact?: boolean;
}

interface DEXInfo {
  id: DEXType;
  name: string;
  description: string;
  logo: string;
  features: string[];
}

const dexOptions: Record<DEXType, DEXInfo> = {
  RAYDIUM: {
    id: 'RAYDIUM',
    name: 'Raydium',
    description: 'Popular concentrated liquidity DEX with high capital efficiency',
    logo: '📊',
    features: ['Concentrated Liquidity', 'AcceleRaytor Program', 'High Fees Option'],
  },
  ORCA: {
    id: 'ORCA',
    name: 'Orca',
    description: 'User-friendly DEX designed for all trader types',
    logo: '🐋',
    features: ['Fair Price Indicator', 'Education-First', 'Whirlpools (Conc. Liq.)'],
  },
};

export function DEXSelect({ value, onChange, disabled = false, compact = false }: DEXSelectProps) {
  if (compact) {
    return (
      <div className="flex gap-2">
        {Object.values(dexOptions).map((dex) => (
          <button
            key={dex.id}
            onClick={() => onChange(dex.id)}
            disabled={disabled}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              value === dex.id
                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50'
            }`}
          >
            {dex.logo} {dex.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {Object.values(dexOptions).map((dex) => (
        <button
          key={dex.id}
          onClick={() => onChange(dex.id)}
          disabled={disabled}
          className={`p-4 rounded-lg border-2 transition-all ${
            value === dex.id
              ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-400'
              : 'border-gray-200 bg-white hover:border-gray-300 disabled:opacity-50'
          }`}
        >
          <div className="text-3xl mb-2">{dex.logo}</div>
          <h3 className="font-bold text-lg">{dex.name}</h3>
          <p className="text-sm text-gray-600 mt-2">{dex.description}</p>
          <ul className="text-xs text-gray-500 mt-3 space-y-1">
            {dex.features.map((feature, idx) => (
              <li key={idx}>• {feature}</li>
            ))}
          </ul>
        </button>
      ))}
    </div>
  );
}

/**
 * Fee Split Display Component
 * Shows how swap fees are distributed
 */
interface FeeSplitDisplayProps {
  swapFeeBps: number;
  totalVolume?: string;
}

export function FeeSplitDisplay({ swapFeeBps, totalVolume }: FeeSplitDisplayProps) {
  const feeBasis = (swapFeeBps / 100).toFixed(2);
  const treasuryPortion = 50;
  const referralPortion = 50;

  let volumeDisplay = '';
  if (totalVolume) {
    const vol = BigInt(totalVolume);
    const fee = (vol / 10000n) * BigInt(swapFeeBps);
    const treasury = fee / 2n;
    const referral = fee - treasury;
    volumeDisplay = ` (${(Number(fee) / 1e9).toFixed(4)} SOL collected)`;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
      <h4 className="font-bold text-sm mb-3">Fee Split Model {volumeDisplay}</h4>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold text-blue-600">{feeBasis}%</div>
          <div className="text-xs text-gray-600">Swap Fee (on all trades)</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div className="bg-white p-2 rounded border border-blue-100">
            <div className="font-bold text-blue-700">{treasuryPortion}%</div>
            <div className="text-gray-600">Treasury</div>
          </div>
          <div className="bg-white p-2 rounded border border-purple-100">
            <div className="font-bold text-purple-700">{referralPortion}%</div>
            <div className="text-gray-600">Referral Pool</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Graduation Progress Component
 * Shows progress towards graduation threshold
 */
interface GraduationProgressProps {
  actualSol: string;
  thresholdSol: string;
  status: string;
}

export function GraduationProgress({ actualSol, thresholdSol, status }: GraduationProgressProps) {
  const actual = Number(BigInt(actualSol) / 10000000n) / 100;
  const threshold = Number(BigInt(thresholdSol) / 10000000n) / 100;
  const progress = Math.min((actual / threshold) * 100, 100);

  const statusColor =
    {
      DRAFT: 'bg-gray-500',
      DEPLOYING: 'bg-yellow-500',
      LIVE: 'bg-green-500',
      GRADUATING: 'bg-blue-500',
      GRADUATED: 'bg-purple-500',
      FAILED: 'bg-red-500',
    }[status] || 'bg-gray-500';

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="font-semibold">Graduation Progress</span>
        <span className={`px-2 py-1 rounded text-white text-xs font-bold ${statusColor}`}>
          {status}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-600 h-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-xs text-gray-600 text-center">
        {actual.toFixed(2)} SOL / {threshold.toFixed(2)} SOL ({progress.toFixed(1)}%)
      </div>
    </div>
  );
}

/**
 * DEX Migration Details Component
 * Shows DEX choice and migration info
 */
interface DEXMigrationDetailsProps {
  targetDex: string | null;
  status: string;
}

export function DEXMigrationDetails({ targetDex, status }: DEXMigrationDetailsProps) {
  const isGraduating = status === 'GRADUATING' || status === 'GRADUATED';

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-lg border border-indigo-200">
      <h4 className="font-bold text-sm mb-2">DEX Migration</h4>
      {targetDex ? (
        <div className="flex items-center gap-2">
          <span className="text-2xl">{dexOptions[targetDex as DEXType]?.logo || '📊'}</span>
          <div>
            <p className="font-semibold">{dexOptions[targetDex as DEXType]?.name || targetDex}</p>
            {isGraduating && (
              <p className="text-xs text-green-700 font-medium mt-1">✅ Ready for migration</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600">No DEX selected yet</p>
      )}
    </div>
  );
}
