'use client';

import { useState } from 'react';
import { Cpu, Hexagon } from 'lucide-react';

export type RewardChain = 'evm' | 'solana';

interface ChainRewardToggleProps {
  selected: RewardChain;
  onChange: (chain: RewardChain) => void;
  evmUsdTotal?: string;
  solanaUsdTotal?: string;
}

export function ChainRewardToggle({
  selected,
  onChange,
  evmUsdTotal = '0.00',
  solanaUsdTotal = '0.00',
}: ChainRewardToggleProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Toggle Container */}
        <div className="inline-flex items-center bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/10">
          {/* EVM Tab */}
          <button
            type="button"
            onClick={() => onChange('evm')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
              selected === 'evm'
                ? 'bg-[#39AEC4]/20 text-[#39AEC4] border border-[#39AEC4]/40 shadow-[0_0_12px_-4px_#39AEC4]'
                : 'text-gray-400 hover:text-gray-300 border border-transparent'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            EVM Networks
            {selected === 'evm' && (
              <span className="bg-[#39AEC4]/30 text-[#39AEC4] px-2 py-0.5 rounded-full text-[10px] font-bold">
                ${evmUsdTotal}
              </span>
            )}
          </button>

          {/* Solana Tab */}
          <button
            type="button"
            onClick={() => onChange('solana')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
              selected === 'solana'
                ? 'bg-[#9945FF]/20 text-[#9945FF] border border-[#9945FF]/40 shadow-[0_0_12px_-4px_#9945FF]'
                : 'text-gray-400 hover:text-gray-300 border border-transparent'
            }`}
          >
            <Hexagon className="w-3.5 h-3.5" />
            Solana
            {selected === 'solana' && (
              <span className="bg-[#9945FF]/30 text-[#9945FF] px-2 py-0.5 rounded-full text-[10px] font-bold">
                ${solanaUsdTotal}
              </span>
            )}
          </button>
        </div>

        {/* Chain Indicator */}
        <div className="flex items-center gap-1.5 ml-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              selected === 'evm' ? 'bg-[#39AEC4]' : 'bg-[#9945FF]'
            } animate-pulse`}
          />
          <span className="text-xs text-gray-500">
            Viewing {selected === 'evm' ? 'EVM' : 'Solana'} network rewards
          </span>
        </div>
      </div>
    </div>
  );
}
