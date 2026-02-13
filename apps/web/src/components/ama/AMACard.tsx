'use client';

/**
 * AMACard Component
 *
 * Display card for upcoming/pinned AMAs
 * Premium glassmorphism design with #39AEC4/#756BBA theme
 */

import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import { Calendar, Radio, Clock, Eye, Bell, Mic, Video, MessageSquare } from 'lucide-react';

interface AMACardProps {
  id: string;
  projectName: string;
  description: string;
  scheduledAt: string;
  developerName: string;
  developerAvatar?: string;
  status: 'PINNED' | 'LIVE' | 'ENDED';
  isLive?: boolean;
  type?: 'TEXT' | 'VOICE' | 'VIDEO';
  messageCount?: number;
}

export function AMACard({
  id,
  projectName,
  description,
  scheduledAt,
  developerName,
  developerAvatar,
  status,
  isLive = false,
  type = 'VOICE',
  messageCount,
}: AMACardProps) {
  const scheduledDate = new Date(scheduledAt);
  const isUpcoming = scheduledDate > new Date();
  const timeUntil = isUpcoming ? formatDistanceToNow(scheduledDate, { addSuffix: false }) : null;

  const borderColor =
    status === 'LIVE'
      ? 'border-red-500/30 hover:border-red-500/50'
      : 'border-[#39AEC4]/20 hover:border-[#39AEC4]/40';

  const glowShadow =
    status === 'LIVE'
      ? 'shadow-red-500/10 hover:shadow-red-500/20'
      : 'shadow-[#756BBA]/10 hover:shadow-[#756BBA]/20';

  return (
    <div
      className={`group relative rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border ${borderColor} overflow-hidden transition-all duration-300 shadow-xl ${glowShadow}`}
    >
      {/* Badges Row */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {/* Type Badge */}
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-sm text-[10px] font-bold ${
            type === 'VIDEO'
              ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
              : type === 'VOICE'
                ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                : 'bg-gray-500/20 border border-gray-500/30 text-gray-300'
          }`}
        >
          {type === 'VIDEO' ? (
            <Video className="w-3 h-3" />
          ) : type === 'VOICE' ? (
            <Mic className="w-3 h-3" />
          ) : (
            <MessageSquare className="w-3 h-3" />
          )}
          {type}
        </div>

        {/* Status Badge */}
        {status === 'LIVE' ? (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full backdrop-blur-sm">
            <Radio className="w-3 h-3 text-red-400 animate-pulse" />
            <span className="text-red-400 text-xs font-bold tracking-wide">LIVE</span>
          </div>
        ) : status === 'ENDED' ? (
          <div className="px-3 py-1 bg-white/10 border border-white/20 rounded-full backdrop-blur-sm">
            <span className="text-gray-400 text-xs font-medium">ENDED</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#39AEC4]/20 border border-[#39AEC4]/30 rounded-full backdrop-blur-sm">
            <Clock className="w-3 h-3 text-[#39AEC4]" />
            <span className="text-[#39AEC4] text-xs font-bold tracking-wide">UPCOMING</span>
          </div>
        )}
      </div>

      {/* Live Glow Effect */}
      {status === 'LIVE' && (
        <div className="absolute inset-0 bg-gradient-to-t from-red-500/5 to-transparent pointer-events-none" />
      )}

      {/* Content */}
      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          {/* Developer Avatar */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-[#39AEC4] to-[#756BBA] rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#756BBA]/20">
            {developerAvatar ? (
              <img
                src={developerAvatar}
                alt={developerName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-bold text-lg">
                {developerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-lg sm:text-xl font-bold text-white truncate group-hover:text-[#39AEC4] transition-colors">
              {projectName} AMA
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-gray-400 text-sm">@{developerName}</span>
              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded border border-green-500/30">
                ✓ Verified
              </span>
            </div>
            <p className="text-[10px] text-[#39AEC4]/70 mt-0.5">Hosted by SELSIPAD Team</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-300 text-sm line-clamp-2 mb-4">{description}</p>

        {/* Schedule */}
        <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-[14px] mb-4">
          <div className="p-2 rounded-full bg-[#39AEC4]/20">
            <Calendar className="w-4 h-4 text-[#39AEC4]" />
          </div>
          <div>
            <p className="text-white font-medium text-sm" suppressHydrationWarning>
              {format(scheduledDate, 'MMMM d, yyyy')} at {format(scheduledDate, 'HH:mm')} UTC
            </p>
            {isUpcoming && timeUntil && (
              <p className="text-[#39AEC4] text-xs" suppressHydrationWarning>
                Starts in {timeUntil}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {status === 'LIVE' ? (
            <Link
              href={`/ama/${id}`}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold rounded-full text-center hover:from-red-500 hover:to-red-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              Join Live
            </Link>
          ) : status === 'ENDED' ? (
            <Link
              href={`/ama/${id}`}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/10 text-white font-semibold rounded-full text-center hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              View Archive {messageCount ? `(${messageCount})` : ''}
            </Link>
          ) : (
            <>
              <button className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-full hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                <Bell className="w-4 h-4 text-[#39AEC4]" />
                Remind Me
              </button>
              <Link
                href={`/ama/${id}`}
                className="px-4 py-3 bg-[#39AEC4]/10 border border-[#39AEC4]/30 text-[#39AEC4] font-semibold rounded-full hover:bg-[#39AEC4]/20 transition-all flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Bottom Gradient Line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#39AEC4]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

/**
 * AMACardSkeleton
 * Loading placeholder for AMA cards
 */
export function AMACardSkeleton() {
  return (
    <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-5 sm:p-6 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 bg-white/10 rounded-full" />
        <div className="flex-1">
          <div className="h-5 bg-white/10 rounded w-3/4 mb-2" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-white/10 rounded w-full mb-2" />
      <div className="h-3 bg-white/10 rounded w-2/3 mb-4" />
      <div className="h-12 bg-white/10 rounded-[14px] mb-4" />
      <div className="h-11 bg-white/10 rounded-full" />
    </div>
  );
}

export default AMACard;
