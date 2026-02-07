'use client';

import Link from 'next/link';
import { Rocket, Zap, Database, Gift, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

const actions = [
  {
    id: 'launchpad',
    label: 'Launchpad',
    desc: 'Upcoming IDOs',
    icon: Rocket,
    href: '/launchpad',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
  {
    id: 'fairlaunch',
    label: 'FairLaunch',
    desc: 'Direct Sales',
    icon: Zap,
    href: '/fairlaunch',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    id: 'staking',
    label: 'Staking',
    desc: 'Stake & Earn',
    icon: Database,
    href: '/staking',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    id: 'rewards',
    label: 'Rewards',
    desc: 'Loyalty Hub',
    icon: Gift,
    href: '/rewards',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
  },
  {
    id: 'social',
    label: 'Social Feed',
    desc: 'Community News',
    icon: MessageSquare,
    href: '/feed',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
];

export function QuickActions() {
  return (
    <div className="mb-12">
      <h2 className="text-xl font-semibold text-white mb-6">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {actions.map((action, index) => (
          <Link key={action.id} href={action.href}>
            <motion.div
              whileHover={{ y: -5 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 + 0.2 }}
              className="glass-card p-6 rounded-2xl flex flex-col items-center text-center hover:bg-white/5 transition-colors group h-full border border-white/5 hover:border-indigo-500/30"
            >
              <div
                className={`w-12 h-12 rounded-xl ${action.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-black/20`}
              >
                <action.icon className={`h-6 w-6 ${action.color}`} />
              </div>
              <h3 className="text-white font-medium mb-1">{action.label}</h3>
              <p className="text-xs text-gray-500">{action.desc}</p>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
