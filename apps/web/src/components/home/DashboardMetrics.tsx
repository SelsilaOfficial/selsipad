'use client';

import { ArrowUpRight, Wallet, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export function DashboardMetrics() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Trending Chart Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[300px]"
      >
        <div className="relative z-10">
          <h3 className="text-gray-400 font-medium mb-1">Trending</h3>

          {/* Chart Placeholder SVG */}
          <div className="h-32 mt-8 w-full relative">
            <svg
              className="w-full h-full text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]"
              preserveAspectRatio="none"
              viewBox="0 0 100 50"
            >
              <path
                d="M0 40 C 20 40, 30 50, 40 30 S 60 10, 70 25 S 90 0, 100 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M0 40 C 20 40, 30 50, 40 30 S 60 10, 70 25 S 90 0, 100 5 V 50 H 0 Z"
                fill="url(#gradient)"
                opacity="0.1"
                stroke="none"
              />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
            {/* Arrow Icon */}
            <div className="absolute top-0 right-0 p-2 bg-emerald-500/10 rounded-lg">
              <ArrowUpRight className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between relative z-10 mt-4">
          <div>
            <div className="text-gray-500 text-sm mb-1">Top Gainer</div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-white">$SELSI</span>
              <span className="text-emerald-400 font-bold text-lg">+15.4%</span>
            </div>
          </div>

          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-sm font-medium text-white rounded-lg border border-white/5 transition-colors">
            View Analytics
          </button>
        </div>

        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </motion.div>

      {/* Portfolio Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[300px]"
      >
        <div>
          <h3 className="text-gray-400 font-medium mb-6">Portfolio Summary</h3>

          <div className="flex items-center gap-8">
            {/* Donut Chart visual */}
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-white/5"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-indigo-500 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  strokeDasharray="251.2"
                  strokeDashoffset="60"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <Wallet className="h-6 w-6" />
              </div>
            </div>

            <div>
              <div className="text-gray-500 text-sm mb-1">Total Value</div>
              <div className="text-4xl font-bold text-white tracking-tight">$12,450.00</div>
              <div className="flex items-center gap-1.5 mt-2 text-sm text-emerald-400 font-medium">
                <ArrowUpRight className="h-4 w-4" />
                2.4% vs last week
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <button className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-[0_4px_20px_rgba(79,70,229,0.3)] transition-all hover:shadow-[0_4px_25px_rgba(79,70,229,0.5)] hover:-translate-y-0.5">
            Deposit
          </button>
          <button className="py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/5 transition-all hover:border-white/10">
            Withdraw
          </button>
        </div>
      </motion.div>
    </div>
  );
}
