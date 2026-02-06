'use client';

import { motion } from 'framer-motion';
import { Wallet, TrendingUp, PieChart, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export function PortfolioWidget() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 }}
      className="glass-card rounded-2xl p-5 relative overflow-hidden group"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-gray-400 text-sm font-medium mb-1">My Portfolio</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">$12,450.00</span>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +15%
            </span>
          </div>
        </div>
        
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
          <PieChart className="w-5 h-5 text-indigo-400" />
        </div>
      </div>

      {/* Mini Asset List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-gray-300">$SELSI</span>
          </div>
          <span className="text-white font-medium">$8,200</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-gray-300">$ETH</span>
          </div>
          <span className="text-white font-medium">$4,500</span>
        </div>
      </div>

      {/* Decorative Donut (Visual Only) */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full border-[6px] border-indigo-500/20" />
      <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full border-[6px] border-cyan-500/20 border-t-transparent border-l-transparent rotate-45" />

      <Link href="/portfolio" className="absolute inset-0 z-10" aria-label="View Portfolio" />
    </motion.div>
  );
}
