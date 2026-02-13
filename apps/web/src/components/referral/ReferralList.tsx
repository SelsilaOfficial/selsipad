'use client';

import { Calendar, TrendingUp } from 'lucide-react';
import type { ReferralStats } from '@/actions/referral/get-stats';

interface Props {
  referredUsers: ReferralStats['referredUsers'];
}

export function ReferralList({ referredUsers }: Props) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatAmount = (weiAmount: string): string => {
    try {
      const amount = BigInt(weiAmount);
      const usdt = Number(amount) / 1e18;
      if (usdt === 0) return '$0';
      return `$${usdt.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`;
    } catch {
      return '$0';
    }
  };

  // Empty state
  if (!referredUsers || referredUsers.length === 0) {
    return (
      <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-8 sm:p-12 shadow-xl shadow-[#756BBA]/10 text-center min-h-[300px] flex flex-col items-center justify-center">
        <div className="mb-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#39AEC4]/20 to-[#756BBA]/20 border border-[#39AEC4]/30 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-[#39AEC4]" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold mb-2">No Referrals Yet</h3>
          <p className="text-sm sm:text-base text-gray-400 max-w-md mx-auto">
            Start sharing your referral code to earn rewards when your friends contribute.
          </p>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Your referral code is displayed on your profile page
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-5 sm:p-6 shadow-xl shadow-[#756BBA]/10">
      <h3 className="text-lg font-bold mb-4">Your Referrals ({referredUsers.length})</h3>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">User</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Joined</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">
                Contributions
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Amount</th>
            </tr>
          </thead>
          <tbody>
            {referredUsers.map((user) => (
              <tr key={user.userId} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#39AEC4] to-[#756BBA] flex items-center justify-center text-sm font-bold">
                        {(user.username?.[0] ?? '?').toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium">{user.username}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {user.status === 'ACTIVE' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                      Pending
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-gray-400">{formatDate(user.joinedAt)}</td>
                <td className="py-3 px-4 text-right text-sm font-medium">
                  {user.totalContributions}
                </td>
                <td className="py-3 px-4 text-right text-sm font-bold text-[#39AEC4]">
                  {formatAmount(user.contributionAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {referredUsers.map((user) => (
          <div key={user.userId} className="p-4 bg-white/5 rounded-[14px] border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#39AEC4] to-[#756BBA] flex items-center justify-center font-bold">
                    {(user.username?.[0] ?? '?').toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm">{user.username}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(user.joinedAt)}
                  </p>
                </div>
              </div>
              {user.status === 'ACTIVE' ? (
                <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                  Active
                </span>
              ) : (
                <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs font-medium">
                  Pending
                </span>
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Contributions:</span>
              <span className="font-medium">{user.totalContributions}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">Total Amount:</span>
              <span className="font-bold text-[#39AEC4]">
                {formatAmount(user.contributionAmount)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
