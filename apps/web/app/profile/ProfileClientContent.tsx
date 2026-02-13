'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, Avatar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import {
  Wallet,
  Shield,
  CheckCircle,
  Copy,
  ExternalLink,
  Plus,
  History,
  Edit,
  Rocket,
  IdCard,
} from 'lucide-react';
import type { UserProfile } from '@/lib/data/profile';
import type { UserStatsMultiChain } from '@/types/multi-chain';
import { formatDistance } from 'date-fns';

interface ProfileClientContentProps {
  initialProfile: UserProfile;
  multiChainStats: UserStatsMultiChain | null;
  userBadges: any[];
}

export function ProfileClientContent({
  initialProfile,
  multiChainStats,
  userBadges,
}: ProfileClientContentProps) {
  const [profile] = useState<UserProfile>(initialProfile);
  const primaryWallet = profile.wallets.find((w) => w.is_primary);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You might want to add a toast/notification here
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans selection:bg-cyan-500/30">
      {/* Custom Header */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Profile</h1>
              <p className="text-xs text-gray-500 font-medium">Manage your account</p>
            </div>
          </div>

          <Link
            href="/profile/edit"
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 hover:bg-cyan-500/30 hover:border-cyan-500/50 transition-all group"
          >
            <Edit className="w-3.5 h-3.5 text-cyan-400 group-hover:text-white transition-colors" />
            <span className="text-sm font-medium text-cyan-400 group-hover:text-white transition-colors">
              Edit Profile
            </span>
          </Link>
        </div>
      </div>

      <PageContainer className="py-8 max-w-3xl space-y-8">
        {/* Profile Header Section */}
        <div className="bg-black border border-white/10 rounded-2xl p-6 relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="flex items-start gap-6 relative z-10">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-white/10 p-0.5 bg-black">
                <Avatar
                  src={profile.avatar_url}
                  alt={profile.username || 'User'}
                  size="xl"
                  fallback={profile.username?.slice(0, 2).toUpperCase() || 'U'}
                  className="w-full h-full rounded-full"
                />
              </div>
              {profile.bluecheck_status === 'active' && (
                <div className="absolute -bottom-1 -right-1 bg-black p-0.5 rounded-full">
                  <div className="bg-cyan-500 rounded-full p-1">
                    <CheckCircle className="w-3 h-3 text-black fill-current" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 pt-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-0.5 bg-cyan-500 rounded text-xs font-bold text-black uppercase">
                  User
                </span>
                <h2 className="text-xl font-bold text-white tracking-wide font-mono">
                  {profile.username || 'Anonymous'}
                </h2>
              </div>

              <div className="flex gap-8 mt-4">
                <div className="text-center md:text-left">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">
                    Followers
                  </p>
                  <p className="text-lg font-bold text-cyan-400 font-mono">
                    {profile.follower_count || 0}
                  </p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">
                    Following
                  </p>
                  <p className="text-lg font-bold text-cyan-400 font-mono">
                    {profile.following_count || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Badge Collection */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">Badge Collection</h3>
            <p className="text-sm text-gray-500">Your earned badges and achievements</p>
          </div>

          {/* Dynamic Badges from DB */}
          {userBadges.length > 0 ? (
            <div className="space-y-3">
              {userBadges.map((instance: any) => {
                const badge = Array.isArray(instance.badge) ? instance.badge[0] : instance.badge;
                if (!badge) return null;

                // Color scheme based on badge_type
                const colors =
                  badge.badge_type === 'SPECIAL'
                    ? {
                        bg: 'bg-cyan-500/10',
                        border: 'border-cyan-500/20',
                        text: 'text-cyan-400',
                        hoverText: 'group-hover:text-cyan-400',
                        pill: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
                      }
                    : badge.badge_type === 'MILESTONE'
                      ? {
                          bg: 'bg-purple-500/10',
                          border: 'border-purple-500/20',
                          text: 'text-purple-400',
                          hoverText: 'group-hover:text-purple-400',
                          pill: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
                        }
                      : {
                          bg: 'bg-yellow-500/10',
                          border: 'border-yellow-500/20',
                          text: 'text-yellow-400',
                          hoverText: 'group-hover:text-yellow-400',
                          pill: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
                        };

                return (
                  <div
                    key={instance.id}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:bg-white/[0.07] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center border ${colors.border} group-hover:border-opacity-80 transition-colors`}
                      >
                        {badge.name?.toLowerCase().includes('kyc verified') ? (
                          <IdCard className={`w-5 h-5 ${colors.text}`} />
                        ) : badge.icon_url ? (
                          <Image
                            src={badge.icon_url}
                            alt={badge.name}
                            width={20}
                            height={20}
                            className="w-5 h-5"
                          />
                        ) : (
                          <Shield className={`w-5 h-5 ${colors.text}`} />
                        )}
                      </div>
                      <div>
                        <h4
                          className={`font-bold text-white text-sm ${colors.hoverText} transition-colors`}
                        >
                          {badge.name}
                        </h4>
                        <p className="text-xs text-gray-500">{badge.description}</p>
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${colors.pill}`}
                    >
                      Earned
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <Shield className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No badges earned yet</p>
              <p className="text-xs text-gray-600 mt-1">
                Participate in the platform to earn badges!
              </p>
            </div>
          )}

          {/* Quick Access Links */}
          <div className="space-y-3 mt-2">
            {/* Blue Check */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:bg-white/[0.07] transition-colors relative overflow-hidden">
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:border-blue-500/50 transition-colors">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">
                    Blue Check
                  </h4>
                  <p className="text-xs text-gray-500">Premium verification badge</p>
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${
                  profile.bluecheck_status === 'active'
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                    : 'bg-white/5 border-white/10 text-gray-500'
                }`}
              >
                {profile.bluecheck_status === 'active' ? 'Active' : 'Get Blue Check'}
              </div>
              <Link href="/profile/blue-check" className="absolute inset-0 z-20" />
            </div>

            {/* Developer KYC */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:bg-white/[0.07] transition-colors relative overflow-hidden">
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 group-hover:border-yellow-500/50 transition-colors">
                  <Shield className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm group-hover:text-yellow-400 transition-colors">
                    Developer KYC
                  </h4>
                  <p className="text-xs text-gray-500">Required for creator</p>
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${
                  profile.kyc_status === 'verified'
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                    : 'bg-white/5 border-white/10 text-gray-500'
                }`}
              >
                {profile.kyc_status === 'verified' ? 'Verified' : 'Get Verified'}
              </div>
              <Link href="/profile/kyc" className="absolute inset-0 z-20" />
            </div>

            {/* My Projects */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:bg-white/[0.07] transition-colors relative overflow-hidden">
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:border-purple-500/50 transition-colors">
                  <Rocket className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm group-hover:text-purple-400 transition-colors">
                    My Projects
                  </h4>
                  <p className="text-xs text-gray-500">Track your projects</p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full border bg-cyan-500/10 border-cyan-500/30 text-cyan-400 text-[10px] font-bold uppercase tracking-wide">
                Unlocked
              </div>
              <Link href="/profile/projects" className="absolute inset-0 z-20" />
            </div>
          </div>
        </div>

        {/* Wallets Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Wallets</h3>
            <Link
              href="/profile/wallets"
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Manage
            </Link>
          </div>

          {primaryWallet ? (
            <div className="bg-black border border-cyan-500/30 rounded-xl p-5 relative overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.05)]">
              {/* Glowing border effect */}
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />

              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  Primary Wallet
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <code className="text-sm text-white font-mono bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 w-full overflow-hidden text-ellipsis">
                  {primaryWallet.address}
                </code>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(primaryWallet.address)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 border-dashed rounded-xl p-6 text-center">
              <p className="text-sm text-gray-400 mb-4">No primary wallet connected</p>
              <Link href="/profile/wallets">
                <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-bold transition-colors">
                  Connect Wallet
                </button>
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Link href="/profile/wallets">
              <button className="w-full py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-sm font-bold text-white flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Add Wallet
              </button>
            </Link>
            <button className="w-full py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-sm font-bold text-white flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              Connect
            </button>
          </div>
        </div>

        {/* Portfolio Button */}
        <div className="pt-4">
          <Link
            href="/portfolio"
            className="block w-full py-4 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 border border-white/10 hover:border-white/20 transition-all text-center group"
          >
            <span className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors flex items-center justify-center gap-2">
              Portfolio
            </span>
          </Link>
        </div>
      </PageContainer>
    </div>
  );
}
