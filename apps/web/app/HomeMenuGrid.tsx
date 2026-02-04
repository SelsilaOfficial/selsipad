'use client';

import Link from 'next/link';
import {
  Rocket,
  TrendingUp,
  Users,
  MessageSquare,
  DollarSign,
  Shield,
  Coins,
  FileText,
  Code,
  Clock,
  Globe,
  Gift,
  Lock,
  Zap,
} from 'lucide-react';

export function HomeMenuGrid() {
  const menuItems = [
    {
      title: 'Explore Project',
      desc: 'All networks, live & upcoming',
      icon: <Globe className="w-6 h-6 text-blue-500" />,
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      href: '/explore',
    },
    {
      title: 'Create Project',
      desc: 'Presale, Fairlaunch, Bonding',
      icon: <Rocket className="w-6 h-6 text-purple-500" />,
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      href: '/create/project',
    },
    {
      title: 'SelsiFeed',
      desc: 'Social feed & updates',
      icon: <MessageSquare className="w-6 h-6 text-pink-500" />,
      bg: 'bg-pink-500/10',
      border: 'border-pink-500/20',
      href: '/feed',
    },
    {
      title: 'Reward Referral',
      desc: 'Invite & earn rewards',
      icon: <Gift className="w-6 h-6 text-green-500" />,
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      href: '/rewards',
    },
    {
      title: 'Vesting',
      desc: 'Manage token vesting',
      icon: <Clock className="w-6 h-6 text-orange-500" />,
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      href: '/vesting',
    },
    {
      title: 'LP Lock',
      desc: 'Secure liquidity locking',
      icon: <Lock className="w-6 h-6 text-red-500" />,
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      href: '/lock',
    },
    {
      title: 'SBT Staking',
      desc: 'Stake for tier benefits',
      icon: <Coins className="w-6 h-6 text-cyan-500" />,
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      href: '/staking',
    },
    {
      title: 'AMA Developer',
      desc: 'Ask developers anything',
      icon: <Users className="w-6 h-6 text-emerald-500" />,
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      href: '/ama',
    },
    {
      title: 'Selsi Tech',
      desc: 'Coming Soon',
      icon: <Zap className="w-6 h-6 text-yellow-500" />,
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
      href: '#',
      disabled: true,
    },
    {
      title: 'Selsi Token Series A',
      desc: 'Coming Soon',
      icon: <TrendingUp className="w-6 h-6 text-indigo-500" />,
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      href: '#',
      disabled: true,
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
        <span className="w-1 h-6 bg-primary-main rounded-full block"></span>
        Explore SelsiPad
      </h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-6">
        {menuItems.map((item, index) => (
          <Link
            key={index}
            href={item.disabled ? '#' : item.href}
            className={`
              group relative flex flex-col p-3 sm:p-6 rounded-2xl border transition-all duration-300
              ${item.disabled 
                ? 'opacity-60 cursor-not-allowed bg-bg-elevated/30 border-dashed border-border-subtle' 
                : 'bg-bg-elevated/50 hover:bg-bg-elevated hover:shadow-xl hover:-translate-y-1 ' + item.border
              }
            `}
            onClick={e => item.disabled && e.preventDefault()}
          >
            <div className={`
              w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 transition-transform group-hover:scale-110
              ${item.bg}
            `}>
              {item.icon}
            </div>
            
            <h3 className="text-sm sm:text-lg font-bold text-text-primary mb-1 group-hover:text-primary-main transition-colors line-clamp-1">
              {item.title}
            </h3>
            <p className="text-xs sm:text-sm text-text-secondary line-clamp-2">
              {item.desc}
            </p>

            {item.disabled && (
              <span className="absolute top-2 right-2 sm:top-4 sm:right-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-text-tertiary bg-bg-surface px-1.5 py-0.5 sm:px-2 sm:py-1 rounded">
                Soon
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
