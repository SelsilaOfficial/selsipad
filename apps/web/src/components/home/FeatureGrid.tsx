'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Globe, PlusCircle, MessageSquare, Gift, Timer, Lock, ShieldCheck, Mic2, Cpu, Coins 
} from 'lucide-react';
import clsx from 'clsx';

const FEATURES = [
  { 
    label: 'Explore Project', 
    description: 'Discover the next gem across all supported networks.',
    href: '/explore', 
    icon: Globe, 
    accent: 'from-blue-500 to-cyan-500',
    delay: 0
  },
  { 
    label: 'Create Project', 
    description: 'Launch your token with Fairlaunch, Presale, or Bonding Curve.',
    href: '/create', 
    icon: PlusCircle, 
    accent: 'from-green-500 to-emerald-500',
    delay: 0.1
  },
  { 
    label: 'SelsiFeed', 
    description: 'Connect with investors and developers in real-time.',
    href: '/feed', 
    icon: MessageSquare, 
    accent: 'from-pink-500 to-rose-500',
    delay: 0.2
  },
  { 
    label: 'Reward Referral', 
    description: 'Invite friends and earn persistent rewards.',
    href: '/rewards', 
    icon: Gift, 
    accent: 'from-yellow-400 to-amber-500',
    delay: 0.3
  },
  { 
    label: 'Vesting', 
    description: 'Manage and claim your vested tokens securely.',
    href: '/vesting', 
    icon: Timer, 
    accent: 'from-orange-500 to-red-500',
    delay: 0.4
  },
  { 
    label: 'LP Lock', 
    description: 'Secure liquidity locking for project longevity.',
    href: '/explore?filter=locked', 
    icon: Lock, 
    accent: 'from-cyan-500 to-blue-500',
    delay: 0.5
  },
  { 
    label: 'SBT Staking', 
    description: 'Stake Soulbound Tokens for exclusive tier benefits.',
    href: '/staking/sbt', 
    icon: ShieldCheck, 
    accent: 'from-purple-500 to-indigo-500',
    delay: 0.6
  },
  { 
    label: 'AMA Developer', 
    description: 'Direct access to developer Q&A sessions.',
    href: '/ama', 
    icon: Mic2, 
    accent: 'from-indigo-500 to-violet-500',
    delay: 0.7
  },
  { 
    label: 'Selsi Tech', 
    description: 'Advanced developer tools coming soon.',
    href: '#', 
    icon: Cpu, 
    accent: 'from-gray-500 to-gray-700',
    disabled: true,
    badge: 'SOON',
    delay: 0.8
  },
  { 
    label: 'Selsi Token A', 
    description: 'Series A funding round coming soon.',
    href: '#', 
    icon: Coins, 
    accent: 'from-gray-500 to-gray-700',
    disabled: true,
    badge: 'SOON',
    delay: 0.9
  },
];

export function FeatureGrid() {
  return (
    <section className="py-20 relative z-10">
      {/* Background handled by PageBackground */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Ecosystem</h2>
            <p className="text-gray-400">Everything you need to build and grow.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature, idx) => (
            <FeatureCard key={idx} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: any }) {
  const Icon = feature.icon;
  
  return (
    <Link href={feature.disabled ? '#' : feature.href} className={clsx(feature.disabled && 'pointer-events-none')}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: feature.delay, duration: 0.5 }}
        whileHover={!feature.disabled ? { y: -8, scale: 1.02 } : {}}
        className={clsx(
          "relative group h-full rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] backdrop-blur-xl transition-all duration-300",
          !feature.disabled && "hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_0_30px_-10px_rgba(255,255,255,0.1)]"
        )}
      >
        {/* Glow Effect */}
        <div className={clsx(
          "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br",
          feature.accent
        )} />
        
        {/* Top Gradient Line */}
        <div className={clsx(
            "absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/50 to-transparent",
            feature.accent
        )} />

        <div className="relative p-6 h-full flex flex-col z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="relative group-hover:scale-110 transition-transform duration-300">
               {/* Icon Container with Gradient Background */}
               <div className={clsx(
                 "w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-xl border border-white/10",
                 feature.accent,
                 feature.disabled ? "opacity-20 grayscale" : "text-white"
               )}>
                 <Icon className="w-7 h-7" strokeWidth={2} />
               </div>
               
               {/* Behind Glow */}
               <div className={clsx(
                 "absolute inset-0 rounded-2xl blur-xl opacity-40 -z-10 bg-gradient-to-br",
                 feature.accent
               )} />
            </div>
            
            {feature.badge && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">
                {feature.badge}
              </span>
            )}
          </div>

          <div className="mt-auto">
            <h3 className={clsx(
              "text-xl font-bold mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 transition-all",
              feature.disabled ? "text-gray-600" : "text-gray-200"
            )}>
              {feature.label}
            </h3>
            <p className={clsx(
              "text-sm leading-relaxed",
              feature.disabled ? "text-gray-700" : "text-gray-400 group-hover:text-gray-300"
            )}>
              {feature.description}
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
