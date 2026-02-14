'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SplineBackground } from '@/components/home/SplineBackground';

type Chain = 'evm' | 'solana';

function ChainToggle({
  selected,
  onChange,
}: {
  selected: Chain;
  onChange: (chain: Chain) => void;
}) {
  return (
    <div className="inline-flex items-center bg-[#1a1a2e] rounded-full p-1 border border-white/10">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onChange('evm');
        }}
        className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
          selected === 'evm'
            ? 'bg-[#39AEC4] text-white shadow-lg shadow-[#39AEC4]/25'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        EVM
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onChange('solana');
        }}
        className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
          selected === 'solana'
            ? 'bg-[#756BBA] text-white shadow-lg shadow-[#756BBA]/25'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        Solana
      </button>
    </div>
  );
}

export default function CreateHubPage() {
  const router = useRouter();
  const [presaleChain, setPresaleChain] = useState<Chain>('evm');
  const [fairlaunchChain, setFairlaunchChain] = useState<Chain>('evm');

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 relative overflow-hidden">
      {/* Animated Background */}
      <SplineBackground />
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">Create New Project</h1>
                <p className="text-xs text-gray-500">Choose your launch type</p>
              </div>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-[#39AEC4] to-[#756BBA] bg-clip-text text-transparent font-audiowide hidden sm:block">
              SELSIPAD
            </span>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {/* Hero Section */}
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 italic">
              Choose Your Launch Type
            </h2>
            <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto">
              Select the type of project you want to create. Each option offers unique features
              tailored to your launch strategy.
            </p>
          </div>

          {/* Launch Type Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {/* Create Presale */}
            <div
              onClick={() => {
                if (presaleChain === 'evm') router.push('/create/presale');
              }}
              className={`group cursor-pointer h-full bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-[#39AEC4]/40 transition-all duration-300 hover:bg-white/[0.06] relative overflow-hidden ${
                presaleChain === 'solana' ? 'cursor-default' : ''
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#39AEC4]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#39AEC4]/10 border border-[#39AEC4]/20 flex items-center justify-center mb-5">
                  <svg
                    className="w-6 h-6 sm:w-7 sm:h-7 text-[#39AEC4]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Create Presale</h3>

                {presaleChain === 'solana' ? (
                  <div className="mb-5">
                    <p className="text-sm text-[#756BBA] font-bold mb-1">🚀 Coming Soon</p>
                    <p className="text-xs text-gray-500">
                      Solana presale support is under development.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">
                    Launch a token presale with customizable parameters, whitelist, and vesting
                    schedules.
                  </p>
                )}

                <ChainToggle selected={presaleChain} onChange={setPresaleChain} />
              </div>
            </div>

            {/* Create Fairlaunch */}
            <div
              onClick={() => {
                if (fairlaunchChain === 'evm') router.push('/create/fairlaunch');
              }}
              className={`group cursor-pointer h-full bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-[#756BBA]/40 transition-all duration-300 hover:bg-white/[0.06] relative overflow-hidden ${
                fairlaunchChain === 'solana' ? 'cursor-default' : ''
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#756BBA]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#756BBA]/10 border border-[#756BBA]/20 flex items-center justify-center mb-5">
                  <svg
                    className="w-6 h-6 sm:w-7 sm:h-7 text-[#756BBA]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Create Fairlaunch</h3>

                {fairlaunchChain === 'solana' ? (
                  <div className="mb-5">
                    <p className="text-sm text-[#756BBA] font-bold mb-1">🚀 Coming Soon</p>
                    <p className="text-xs text-gray-500">
                      Solana fairlaunch support is under development.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">
                    Fair distribution mechanism with equal opportunity for all participants.
                  </p>
                )}

                <ChainToggle selected={fairlaunchChain} onChange={setFairlaunchChain} />
              </div>
            </div>

            {/* Create Bonding Curve */}
            <Link href="/create/bonding-curve" className="group sm:col-span-2 lg:col-span-1">
              <div className="h-full bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 hover:border-[#39AEC4]/40 transition-all duration-300 group-hover:bg-white/[0.06] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#39AEC4]/5 to-[#756BBA]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[#39AEC4]/10 to-[#756BBA]/10 border border-white/10 flex items-center justify-center mb-5">
                    <svg
                      className="w-6 h-6 sm:w-7 sm:h-7 text-[#39AEC4]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                    Create Bonding Curve
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">
                    Automated market maker with dynamic pricing based on supply and demand.
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm text-[#39AEC4] font-bold group-hover:text-[#756BBA] transition-colors">
                    Get Started
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Chain Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* EVM Card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-[#39AEC4]/20 transition-all">
              <div className="flex items-start gap-4">
                <span className="px-2.5 py-1 text-xs font-bold bg-[#39AEC4]/20 text-[#39AEC4] rounded border border-[#39AEC4]/30 shrink-0">
                  EVM
                </span>
                <div>
                  <h4 className="text-base font-bold text-white mb-2">Ethereum Virtual Machine</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Deploy on EVM-compatible chains like Ethereum, BSC, Polygon, and more. Wide
                    ecosystem support and battle-tested infrastructure.
                  </p>
                </div>
              </div>
            </div>

            {/* Solana Card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-[#756BBA]/20 transition-all">
              <div className="flex items-start gap-4">
                <span className="px-2.5 py-1 text-xs font-bold bg-[#756BBA]/20 text-[#756BBA] rounded border border-[#756BBA]/30 shrink-0">
                  SOL
                </span>
                <div>
                  <h4 className="text-base font-bold text-white mb-2">Solana Network</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Launch on Solana for high-speed transactions and low fees. Perfect for
                    high-frequency trading and DeFi applications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
