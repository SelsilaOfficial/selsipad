'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  Rocket,
  Zap,
  Database,
  Gift,
  MessageSquare,
  Lock,
  Shield,
  Mic,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';

const actions = [
  {
    id: 'launchpad',
    label: 'Launchpad',
    desc: 'Create Token & Presale',
    icon: Rocket,
    href: '/create',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    hoverBorder: 'group-hover:border-indigo-500/50',
    hoverShadow: 'group-hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]',
  },
  {
    id: 'vesting',
    label: 'Vesting',
    desc: 'Create Vesting Schedule',
    icon: Clock,
    href: '/vesting',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    hoverBorder: 'group-hover:border-orange-500/50',
    hoverShadow: 'group-hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]',
  },
  {
    id: 'lplock',
    label: 'LP Lock',
    desc: 'Lock Liquidity',
    icon: Shield,
    href: '/lock',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    hoverBorder: 'group-hover:border-emerald-500/50',
    hoverShadow: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]',
  },
  {
    id: 'ama',
    label: 'Host AMA',
    desc: 'Schedule AMA Session',
    icon: Mic,
    href: '/ama',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    hoverBorder: 'group-hover:border-purple-500/50',
    hoverShadow: 'group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]',
  },
  {
    id: 'staking',
    label: 'Staking',
    desc: 'Stake & Earn',
    icon: Database,
    href: '/staking',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    hoverBorder: 'group-hover:border-emerald-500/50',
    hoverShadow: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]',
  },
  {
    id: 'rewards',
    label: 'Rewards',
    desc: 'Loyalty Hub',
    icon: Gift,
    href: '/rewards',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    hoverBorder: 'group-hover:border-pink-500/50',
    hoverShadow: 'group-hover:shadow-[0_0_20px_rgba(236,72,153,0.3)]',
  },
  {
    id: 'social',
    label: 'Social Feed',
    desc: 'Community News',
    icon: MessageSquare,
    href: '/feed',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    hoverBorder: 'group-hover:border-cyan-500/50',
    hoverShadow: 'group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]',
  },
];

export function DashboardCombinedGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
      {/* Trending Chart Card - Takes up 1 column on large screens, maybe 1.5? 
          Actually, if we want it aligned with Quick Actions, maybe we can put them in the same row.
          Let's try: Trending takes 1/3 width, Actions take 2/3 width?
          Or Trending takes 1/2, Actions take 1/2?
          
          User said: "trending token di sejajarkan dengan laucnpad dan selsifeed"
          In the screenshot, Trending was on the left half. Portfolio was on the right half.
          Quick Actions were below.
          
          If I understand "sejajarkan" as "put in the same horizontal block".
          Maybe: [Trending Widget] [Action 1] [Action 2] [Action 3] ... ?
          But Actions are 5.
          
          Let's try a layout where the Quick Actions wrap around or sit next to the chart.
          
          Option A:
          Row 1: [ Trending Chart (Large) ] [ Grid of Actions (2x3 or similar) ]
      */}

      {/* Trending Widget - Width: lg:col-span-1 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[300px] lg:col-span-1"
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

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </motion.div>

      {/* Quick Actions Grid - Width: lg:col-span-2 */}
      {/* This places the actions to the right of the trending widget. matching "sejajar" */}
      <div className="lg:col-span-2">
        {/* We can reuse the title or just show the grid */}
        <div className="h-full grid grid-cols-2 sm:grid-cols-3 gap-4">
          {actions.map((action, index) => (
            <Link key={action.id} href={action.href} className="h-full">
              <motion.div
                whileHover={{ y: -5 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 + 0.1 }}
                className={`bg-white/[0.02] backdrop-blur-xl border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-white/[0.05] transition-all duration-300 group h-full ${action.hoverBorder} ${action.hoverShadow}`}
              >
                <div
                  className={`w-12 h-12 rounded-xl ${action.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-black/20`}
                >
                  <action.icon className={`h-6 w-6 ${action.color}`} />
                </div>
                <h3 className="text-white font-medium mb-1">{action.label}</h3>
                <p className="text-xs text-gray-500">{action.desc}</p>
              </motion.div>
            </Link>
          ))}

          {/* Optional filler if needed to fill grid? 5 items in 3 cols -> 2 rows, last one empty? 
                5 items in 3-col grid:
                [1][2][3]
                [4][5][ ]
                This is fine.
            */}
        </div>
      </div>
    </div>
  );
}
