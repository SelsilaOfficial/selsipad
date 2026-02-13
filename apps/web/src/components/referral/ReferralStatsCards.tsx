'use client';

import { Users, UserCheck, DollarSign, Clock } from 'lucide-react';
import type { ReferralStats } from '@/actions/referral/get-stats';

interface Props {
  stats: ReferralStats;
}

export function ReferralStatsCards({ stats }: Props) {
  const formatUSDT = (weiAmount: string): string => {
    try {
      const amount = BigInt(weiAmount);
      const usdt = Number(amount) / 1e18;
      return usdt.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return '0.00';
    }
  };

  const statsCards = [
    {
      title: 'Total Referrals',
      value: stats.totalReferrals.toString(),
      subtitle: `${stats.activeReferrals} active, ${stats.pendingReferrals} pending`,
      icon: Users,
      gradientFrom: 'from-[#39AEC4]/20',
      gradientTo: 'to-[#39AEC4]/5',
      borderColor: 'border-[#39AEC4]/30',
      shadowColor: 'shadow-[#39AEC4]/10',
      shadowHover: 'hover:shadow-[#39AEC4]/20',
      iconBg: 'bg-[#39AEC4]/20',
      iconColor: 'text-[#39AEC4]',
    },
    {
      title: 'Active Referrals',
      value: stats.activeReferrals.toString(),
      subtitle: 'Users who contributed',
      icon: UserCheck,
      gradientFrom: 'from-green-500/20',
      gradientTo: 'to-green-500/5',
      borderColor: 'border-green-500/30',
      shadowColor: 'shadow-green-500/10',
      shadowHover: 'hover:shadow-green-500/20',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-400',
    },
    {
      title: 'Total Earnings',
      value: `$${formatUSDT(stats.totalEarnings)}`,
      subtitle: 'USDT equivalent',
      icon: DollarSign,
      gradientFrom: 'from-[#756BBA]/20',
      gradientTo: 'to-[#756BBA]/5',
      borderColor: 'border-[#756BBA]/30',
      shadowColor: 'shadow-[#756BBA]/10',
      shadowHover: 'hover:shadow-[#756BBA]/20',
      iconBg: 'bg-[#756BBA]/20',
      iconColor: 'text-[#756BBA]',
    },
    {
      title: 'Pending Rewards',
      value: `$${formatUSDT(stats.pendingEarnings)}`,
      subtitle: 'Being processed',
      icon: Clock,
      gradientFrom: 'from-amber-500/20',
      gradientTo: 'to-amber-500/5',
      borderColor: 'border-amber-500/30',
      shadowColor: 'shadow-amber-500/10',
      shadowHover: 'hover:shadow-amber-500/20',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {statsCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.title}
            className={`rounded-[16px] sm:rounded-[20px] bg-gradient-to-br ${stat.gradientFrom} ${stat.gradientTo} backdrop-blur-xl border ${stat.borderColor} p-4 sm:p-5 shadow-lg ${stat.shadowColor} ${stat.shadowHover} transition-all`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">{stat.title}</p>
                <h3 className="text-2xl sm:text-3xl font-bold">{stat.value}</h3>
              </div>
              <div className={`p-2 sm:p-2.5 rounded-full ${stat.iconBg}`}>
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.iconColor}`} />
              </div>
            </div>
            <p className="text-xs text-gray-500">{stat.subtitle}</p>
          </div>
        );
      })}
    </div>
  );
}
