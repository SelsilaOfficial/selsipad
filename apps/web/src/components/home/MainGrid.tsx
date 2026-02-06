'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Rocket, Flame, Lock, Gift, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming cn exists, referencing BottomNav usage

const GRID_ITEMS = [
  {
    label: 'Launchpad',
    href: '/explore',
    icon: Rocket,
    color: 'text-cyan-400',
    gradient: 'from-cyan-500/20 to-blue-600/20',
    border: 'border-cyan-500/30'
  },
  {
    label: 'FairLaunch',
    href: '/fairlaunch',
    icon: Flame,
    color: 'text-orange-400',
    gradient: 'from-orange-500/20 to-red-600/20',
    border: 'border-orange-500/30'
  },
  {
    label: 'Staking',
    href: '/staking',
    icon: Lock,
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-green-600/20',
    border: 'border-emerald-500/30'
  },
  {
    label: 'Rewards',
    href: '/rewards',
    icon: Gift,
    color: 'text-purple-400',
    gradient: 'from-purple-500/20 to-pink-600/20',
    border: 'border-purple-500/30'
  },
  {
    label: 'Social Feed',
    href: '/feed',
    icon: MessageSquare,
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-indigo-600/20',
    border: 'border-blue-500/30'
  }
];

export function MainGrid() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4 px-4">
      {GRID_ITEMS.map((item, idx) => (
        <Link 
          key={item.label} 
          href={item.href}
          className="group relative"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={cn(
              "aspect-square flex flex-col items-center justify-center rounded-2xl",
              "bg-[#0F172A]/40 backdrop-blur-md", // Deep dark blue glass
              "border border-white/5 group-hover:border-white/20 transition-all duration-300",
              "holographic-rim shadow-lg",
              item.border
            )}
          >
            {/* Inner Gradient Glow */}
            <div className={cn(
              "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br",
              item.gradient
            )} />

            {/* Icon */}
            <div className={cn(
              "relative z-10 p-3 rounded-full bg-black/20 mb-2 transition-transform group-hover:scale-110",
            )}>
              <item.icon className={cn("w-6 h-6 sm:w-8 sm:h-8 stroke-[1.5]", item.color)} />
            </div>

            {/* Label */}
            <span className="relative z-10 text-[10px] sm:text-xs font-medium text-gray-300 group-hover:text-white tracking-wide">
              {item.label}
            </span>
          </motion.div>
        </Link>
      ))}
    </div>
  );
}
