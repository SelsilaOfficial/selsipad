'use client';

import { Users, UserCheck, DollarSign, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import type { ReferralStats } from '@/actions/referral/get-stats';

interface Props {
  stats: ReferralStats;
}

export function ReferralStatsCards({ stats }: Props) {
  // Convert wei to USDT (assuming 18 decimals for most tokens)
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
      gradient: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Active Referrals',
      value: stats.activeReferrals.toString(),
      subtitle: 'Users who contributed',
      icon: UserCheck,
      gradient: 'from-green-500/20 to-emerald-500/20',
      iconColor: 'text-green-400',
    },
    {
      title: 'Total Earnings',
      value: `$${formatUSDT(stats.totalEarnings)}`,
      subtitle: 'USDT equivalent',
      icon: DollarSign,
      gradient: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-400',
    },
    {
      title: 'Pending Rewards',
      value: `$${formatUSDT(stats.pendingEarnings)}`,
      subtitle: 'Being processed',
      icon: Clock,
      gradient: 'from-orange-500/20 to-yellow-500/20',
      iconColor: 'text-orange-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="border-gray-800">
            <CardContent className={`bg-gradient-to-br ${stat.gradient} p-6`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-gray-900/50`}>
                  <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
              <p className="text-xs text-gray-500">{stat.subtitle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
