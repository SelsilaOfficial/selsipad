'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, StatusBadge, Avatar } from '@/components/ui';
import { PageHeader, PageContainer } from '@/components/layout';
import { Wallet, Shield, CheckCircle } from 'lucide-react';
import type { UserProfile } from '@/lib/data/profile';
import type { UserStatsMultiChain } from '@/types/multi-chain';
import { formatChainName } from '@/lib/utils/chain';
import { formatDistance } from 'date-fns';
import { Rocket, ArrowRight } from 'lucide-react';

interface ProfileClientContentProps {
  initialProfile: UserProfile;
  multiChainStats: UserStatsMultiChain | null;
}

export function ProfileClientContent({
  initialProfile,
  multiChainStats,
}: ProfileClientContentProps) {
  const [profile] = useState<UserProfile>(initialProfile);

  const primaryWallet = profile.wallets.find((w) => w.is_primary);

  return (
    <div className="min-h-screen bg-bg-page pb-20">
      <PageHeader
        title="Profile"
        actions={
          <Link
            href="/profile/edit"
            className="px-4 py-2 bg-primary-main text-white rounded-lg hover:bg-primary-hover transition-colors text-body-sm font-medium"
          >
            Edit Profile
          </Link>
        }
      />

      <PageContainer className="py-4 space-y-6">
        {/* Profile Card */}
        {/* Profile Card */}
        <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary-main to-purple-600 opacity-20 blur-sm" />
              <Avatar
                src={profile.avatar_url}
                alt={profile.username || 'User'}
                size="xl"
                fallback={profile.username?.slice(0, 2).toUpperCase() || 'U'}
                className="relative border-4 border-gray-900"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">{profile.username || 'Anonymous User'}</h2>
              {profile.bio && (
                <p className="text-sm text-gray-400 max-w-lg">{profile.bio}</p>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-800 pt-6">
            <div className="rounded-lg bg-gray-800/50 p-3 text-center transition-colors hover:bg-gray-800">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Followers</p>
              <p className="text-xl font-bold text-white">{profile.follower_count || 0}</p>
            </div>
            <div className="rounded-lg bg-gray-800/50 p-3 text-center transition-colors hover:bg-gray-800">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Following</p>
              <p className="text-xl font-bold text-white">{profile.following_count || 0}</p>
            </div>
          </div>
        </div>

        {/* Multi-Chain Contributions */}
        {multiChainStats && multiChainStats.contributions.length > 0 && (
          <Card>
            <CardContent className="space-y-3">
              <h3 className="text-heading-md">Contributions</h3>
              {multiChainStats.contributions.map((chainStat) => (
                <div key={chainStat.chain} className="flex justify-between items-center py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-bg-elevated rounded-full flex items-center justify-center text-caption font-semibold">
                      {chainStat.nativeToken.slice(0, 1)}
                    </div>
                    <span className="text-text-secondary text-body-sm">
                      {formatChainName(chainStat.chain)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-heading-sm font-semibold">
                      {chainStat.totalContributed.toFixed(4)} {chainStat.nativeToken}
                    </p>
                    {chainStat.usdEstimate && (
                      <p className="text-caption text-text-tertiary">
                        ~${chainStat.usdEstimate.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {multiChainStats.totalContributedUSD > 0 && (
                <div className="pt-3 border-t border-border-subtle flex justify-between">
                  <span className="text-text-secondary">Total (All Chains)</span>
                  <span className="text-heading-md font-bold">
                    ~${multiChainStats.totalContributedUSD.toFixed(2)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Multi-Chain Rewards */}
        {multiChainStats && multiChainStats.rewards.length > 0 && (
          <Card>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-heading-md">Claimable Rewards</h3>
                <Link
                  href="/rewards"
                  className="text-primary-main text-body-sm font-medium hover:underline"
                >
                  View All
                </Link>
              </div>
              {multiChainStats.rewards.map((rewardStat, idx) => (
                <div
                  key={`${rewardStat.chain}-${rewardStat.token}-${idx}`}
                  className="flex justify-between items-center py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-success-subtle rounded-full flex items-center justify-center text-caption font-semibold text-success-main">
                      {rewardStat.token.slice(0, 1)}
                    </div>
                    <span className="text-text-secondary text-body-sm">
                      {formatChainName(rewardStat.chain)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-heading-sm font-semibold text-success-main">
                      {rewardStat.amount.toFixed(2)} {rewardStat.token}
                    </p>
                    {rewardStat.usdEstimate && (
                      <p className="text-caption text-text-tertiary">
                        ~${rewardStat.usdEstimate.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Legacy Stats Card - Show if no multi-chain data */}
        {(!multiChainStats ||
          (multiChainStats.contributions.length === 0 && multiChainStats.rewards.length === 0)) && (
          <Card>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-caption text-text-secondary">Total Contributed</p>
                  <p className="text-heading-md">
                    {profile.total_contributions}{' '}
                    {profile.wallets.find((w) => w.is_primary)?.network === 'EVM' ? 'BNB' : 'SOL'}
                  </p>
                </div>
                <div>
                  <p className="text-caption text-text-secondary">Tokens Claimed</p>
                  <p className="text-heading-md">{profile.total_claimed.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Badge Collection */}
        <div className="space-y-3">
          <div>
            <h3 className="text-heading-md text-text-primary">Badge Collection</h3>
            <p className="text-caption text-text-secondary mt-1">
              Your earned badges and achievements
            </p>
          </div>

          {/* Blue Check Status */}
          <Link href="/profile/blue-check">
            <div className="group relative overflow-hidden rounded-xl border border-blue-900/30 bg-gray-900/50 p-1 transition-all hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]">
              <div className="relative flex items-center justify-between rounded-lg bg-gray-900 p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 transition-colors group-hover:bg-blue-500/20">
                      <Image
                        src="/bluecheck-badge.png"
                        alt="Blue Check"
                        width={32}
                        height={32}
                        className={`object-contain transition-all duration-300 ${
                          profile.bluecheck_status === 'active'
                            ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                            : 'opacity-40 grayscale'
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">Blue Check</h4>
                      <p className="text-sm text-gray-500">
                        {profile.bluecheck_status === 'active' && profile.bluecheck_expires_at
                          ? `Expires ${formatDistance(new Date(profile.bluecheck_expires_at), new Date(), { addSuffix: true })}`
                          : 'Premium verification badge'}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide border ${
                    profile.bluecheck_status === 'active' 
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                      : 'bg-gray-800 text-gray-500 border-gray-700'
                  }`}>
                    {profile.bluecheck_status === 'active' ? 'Verified' : 'Inactive'}
                  </div>
              </div>
            </div>
          </Link>

          {/* KYC Status */}
          <Link href="/profile/kyc">
            <div className="group relative overflow-hidden rounded-xl border border-yellow-900/30 bg-gray-900/50 p-1 transition-all hover:border-yellow-500/30 hover:shadow-[0_0_20px_rgba(234,179,8,0.1)]">
              <div className="relative flex items-center justify-between rounded-lg bg-gray-900 p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/10 transition-colors group-hover:bg-yellow-500/20">
                      <Image
                        src="/developer-kyc-badge.png"
                        alt="Developer KYC"
                        width={32}
                        height={32}
                        className={`object-contain transition-all duration-300 ${
                          profile.kyc_status === 'verified' ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'opacity-40 grayscale'
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-white group-hover:text-yellow-400 transition-colors">Developer KYC</h4>
                      <p className="text-sm text-gray-500">
                        {profile.kyc_status === 'verified'
                          ? 'Identity verified'
                          : 'Required for creators'}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide border ${
                    profile.kyc_status === 'verified'
                      ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                      : 'bg-gray-800 text-gray-500 border-gray-700'
                  }`}>
                    {profile.kyc_status === 'verified' ? 'Verified' : 'Unverified'}
                  </div>
              </div>
            </div>
          </Link>
        </div>

        {/* My Projects Shortcut */}
        <Link href="/profile/projects">
          <div className="group relative overflow-hidden rounded-xl border border-primary-main/30 bg-gradient-to-br from-gray-900 to-gray-900 shadow-lg transition-all hover:scale-[1.01] hover:border-primary-main/50 hover:shadow-primary-main/10">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-primary-main/10 blur-3xl transition-all group-hover:bg-primary-main/20" />
            
            <div className="relative p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-main/10 border border-primary-main/20 shadow-inner group-hover:bg-primary-main/20 transition-all">
                  <Rocket className="h-6 w-6 text-primary-main" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white group-hover:text-primary-main transition-colors">
                    My Projects
                  </h4>
                  <p className="text-sm text-gray-400">
                    Track your Fairlaunch & Presale campaigns
                  </p>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-gray-400 opacity-50 transition-all group-hover:bg-primary-main group-hover:text-white group-hover:opacity-100">
                <ArrowRight size={16} />
              </div>
            </div>
          </div>
        </Link>

        {/* Wallet Management */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-heading-md text-text-primary">Wallets</h3>
            <Link
              href="/profile/wallets"
              className="text-body-sm text-primary-main hover:underline"
            >
              Manage
            </Link>
          </div>

          {primaryWallet ? (
            <div className="relative overflow-hidden rounded-xl border border-primary-main/30 bg-gradient-to-br from-gray-900 via-gray-900 to-primary-main/10 p-5 shadow-[0_0_30px_rgba(var(--primary-rgb),0.05)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary-main/10 rounded-lg text-primary-main">
                    <Wallet size={16} />
                  </div>
                  <span className="text-sm font-medium text-primary-main">Primary Wallet</span>
                </div>
                <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary-main text-white">
                  {primaryWallet.network}
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="font-mono text-lg text-white font-medium tracking-tight break-all">
                  {primaryWallet.address}
                </h4>
                <p className="text-sm text-gray-500">
                  {primaryWallet.label || 'No label set'}
                </p>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-6">
                <p className="text-body-sm text-text-secondary mb-3">No primary wallet set</p>
                <Link href="/profile/wallets">
                  <button className="px-4 py-2 bg-primary-main text-primary-text rounded-md text-body-sm font-medium hover:bg-primary-hover transition-colors">
                    Add Wallet
                  </button>
                </Link>
              </CardContent>
            </Card>
          )}

          {profile.wallets.length > 1 && (
            <p className="text-caption text-text-secondary">
              +{profile.wallets.length - 1} more wallet{profile.wallets.length > 2 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/profile/wallets">
            <Card hover className="h-full">
              <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                <svg
                  className="w-8 h-8 text-primary-main mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <h4 className="text-heading-sm">Add Wallet</h4>
              </CardContent>
            </Card>
          </Link>

          <Link href="/profile/security">
            <Card hover className="h-full">
              <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                <svg
                  className="w-8 h-8 text-primary-main mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <h4 className="text-heading-sm">Security</h4>
              </CardContent>
            </Card>
          </Link>
        </div>
      </PageContainer>
    </div>
  );
}
