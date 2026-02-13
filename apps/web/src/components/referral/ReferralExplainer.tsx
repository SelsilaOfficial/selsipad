'use client';

import { TrendingUp, Shield, Info, CheckCircle2 } from 'lucide-react';

export function ReferralExplainer() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* How It Works */}
      <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-5 sm:p-6 shadow-xl shadow-[#756BBA]/10">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-[#39AEC4]" />
          <h3 className="font-bold text-sm sm:text-base">How It Works</h3>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#39AEC4] to-[#756BBA] flex items-center justify-center text-xs font-bold">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-300">Share your referral code or link with friends</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#39AEC4] to-[#756BBA] flex items-center justify-center text-xs font-bold">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                They sign up and make their first contribution
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#39AEC4] to-[#756BBA] flex items-center justify-center text-xs font-bold">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                You earn rewards from their contribution fees!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reward Breakdown */}
      <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-5 sm:p-6 shadow-xl shadow-[#756BBA]/10">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[#39AEC4]" />
          <h3 className="font-bold text-sm sm:text-base">Reward Breakdown</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-[#39AEC4]/10">
            <span className="text-sm text-gray-300">Presale/Fairlaunch</span>
            <span className="text-sm font-bold text-[#39AEC4]">30% of 5% fee</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-[#39AEC4]/10">
            <span className="text-sm text-gray-300">Bonding Curve</span>
            <span className="text-sm font-bold text-[#39AEC4]">50% of 1.5% fee</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-[#39AEC4]/10">
            <span className="text-sm text-gray-300">Blue Check Badge</span>
            <span className="text-sm font-bold text-[#39AEC4]">30% of $10</span>
          </div>
        </div>

        <div className="mt-4 p-3 bg-[#39AEC4]/10 border border-[#39AEC4]/30 rounded-lg">
          <p className="text-xs text-gray-300">
            <span className="font-bold text-[#39AEC4]">💡 Example:</span> Your referral contributes
            $100 to a Fairlaunch. You earn $100 × 5% × 30% ={' '}
            <span className="font-bold text-white">$1.50</span>
          </p>
        </div>
      </div>

      {/* Claiming Requirements */}
      <div className="rounded-[20px] bg-gradient-to-br from-[#756BBA]/10 to-[#756BBA]/5 backdrop-blur-xl border border-[#756BBA]/30 p-5 sm:p-6 shadow-xl shadow-[#756BBA]/20">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-[#756BBA]" />
          <h3 className="font-bold text-sm sm:text-base">Claiming Requirements</h3>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#756BBA] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">Active Blue Check badge required</p>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#756BBA] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">Minimum 1 active referral</p>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#756BBA] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">Rewards auto-processed every 24h</p>
          </div>
        </div>

        <button className="w-full px-6 py-3 rounded-full bg-[#756BBA]/20 border border-[#756BBA]/40 hover:bg-[#756BBA]/30 transition-all font-semibold text-sm text-gray-300 cursor-not-allowed">
          🔒 Get Blue Check badge to unlock reward claiming
        </button>
      </div>
    </div>
  );
}
