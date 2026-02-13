'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Project } from '@/lib/data/projects';
import { ProgressBar } from '@/components/ui';
import { Clock, Users, Zap, ShieldCheck } from 'lucide-react';

interface ExploreProjectCardProps {
  project: Project;
  index: number;
}

export function ExploreProjectCard({ project, index }: ExploreProjectCardProps) {
  // Define Theme Colors based on Status/Network
  const isLive = project.status === 'live';
  const isUpcoming = project.status === 'upcoming';
  const isEnded = project.status === 'ended';
  const isSuccessful = isEnded && project.raised >= (project.target || 0);

  // Active or Successful projects get color
  const showColor = isLive || isSuccessful;

  // Cyberpunk Palette
  const CYAN = '#39AEC4';
  const PURPLE = '#756BBA';
  const DARK_BG = 'rgba(10, 10, 12, 0.8)'; // Darker card bg

  // Dynamic Styles
  const borderColor = isLive
    ? 'border-[#39AEC4]/50'
    : isUpcoming
      ? 'border-[#756BBA]/50'
      : 'border-white/10';
  const glowColor = isLive
    ? 'shadow-[0_0_20px_-5px_rgba(57,174,196,0.3)]'
    : isUpcoming
      ? 'shadow-[0_0_20px_-5px_rgba(117,107,186,0.3)]'
      : '';
  const statusBg = isLive
    ? 'bg-[#39AEC4]/20 text-[#39AEC4] border-[#39AEC4]/30'
    : isUpcoming
      ? 'bg-[#756BBA]/20 text-[#756BBA] border-[#756BBA]/30'
      : 'bg-white/10 text-gray-400 border-white/5';

  // Format numbers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Progress
  const percentage = Math.round((project.raised / (project.target || 1)) * 100);
  const displayPercentage =
    (project as any).type === 'fairlaunch' ? percentage : Math.min(100, percentage);

  return (
    <Link href={`/project/${project.id}`} className="block h-full group">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`
          relative h-full rounded-[24px] overflow-hidden transition-all duration-300
          border ${borderColor} bg-[#0A0A0C]/80 backdrop-blur-xl
          hover:-translate-y-1 hover:border-opacity-100 ${glowColor}
          flex flex-col
        `}
      >
        {/* Top Image Area */}
        <div className="relative h-48 w-full overflow-hidden">
          {/* Banner Image */}
          <img
            src={project.banner || '/placeholder-banner.jpg'}
            alt={project.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder-banner.jpg';
            }}
          />

          {/* Dark Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-transparent to-black/60" />

          {/* Status Badge (Left) */}
          <div className="absolute top-4 left-4 z-10">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md ${statusBg}`}
            >
              {isLive && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#39AEC4] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#39AEC4]"></span>
                </span>
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {project.status === 'live' ? 'Live Now' : project.status}
              </span>
            </div>
          </div>

          {/* Network Badge (Right) */}
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
            <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs font-bold text-white flex items-center gap-1.5">
              {project.network === 'EVM' ? (
                <Zap size={12} className="text-[#39AEC4]" fill="currentColor" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500" />
              )}
              {/* Display specific network name if available, otherwise generic */}
              {project.chain === '56' || project.chain === '97'
                ? 'BNB Chain'
                : project.chain === '1' || project.chain === '11155111'
                  ? 'Ethereum'
                  : project.chain === '8453' || project.chain === '84532'
                    ? 'Base'
                    : project.network === 'SOL'
                      ? 'Solana'
                      : project.network}
            </div>
            {/* Type Badge */}
            <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-medium text-gray-300 uppercase tracking-wide">
              {(project as any).type === 'fairlaunch'
                ? 'Fairlaunch'
                : (project as any).type === 'presale'
                  ? 'Presale'
                  : 'Bonding Curve'}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-5 flex flex-col flex-grow gap-4 relative">
          {/* Avatar - Floating overlap */}
          <div className="absolute -top-10 left-5 p-1 rounded-xl bg-[#0A0A0C] border border-white/10">
            <img
              src={project.logo || '/placeholder-icon.png'}
              alt="icon"
              className="w-14 h-14 rounded-lg object-cover"
              onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder-icon.png')}
            />
          </div>

          {/* Spacer for Avatar */}
          <div className="h-4" />

          {/* Header */}
          <div>
            <h3 className="text-xl font-bold text-white group-hover:text-[#39AEC4] transition-colors truncate">
              {project.name}
            </h3>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm font-medium text-gray-400">${project.symbol}</span>

              {/* Verification Badges */}
              <div className="flex items-center gap-1.5 opacity-90">
                {project.kyc_verified && (
                  <div
                    title="KYC Verified (SAFU)"
                    className="flex items-center gap-1 text-[10px] uppercase font-bold text-[#39AEC4] bg-[#39AEC4]/10 px-2 py-0.5 rounded border border-[#39AEC4]/20 shadow-[0_0_10px_-4px_#39AEC4]"
                  >
                    <ShieldCheck size={10} fill="currentColor" className="opacity-50" />
                    SAFU
                  </div>
                )}
                {project.audit_status === 'pass' && (
                  <div
                    title="Audit Passed"
                    className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shadow-[0_0_10px_-4px_rgba(52,211,153,0.5)]"
                  >
                    <ShieldCheck size={10} />{' '}
                    {/* Using ShieldCheck for Audit too, or distinct icon if available */}
                    AUDIT
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <p
            className="text-xs text-gray-400 line-clamp-2 min-h-[32px] leading-relaxed"
            style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif' }}
          >
            {project.description || 'No description available for this project.'}
          </p>
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-gray-400">Progress</span>
              <span className={showColor ? 'text-[#39AEC4]' : 'text-gray-300'}>
                {displayPercentage}%
              </span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${showColor ? 'bg-gradient-to-r from-[#39AEC4] to-[#756BBA]' : 'bg-gray-600'}`}
                style={{ width: `${Math.min(100, percentage)}%` }}
              />
            </div>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                Raised
              </span>
              <span className="text-sm font-bold text-white">
                {project.raised.toLocaleString()} {project.currency}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                Target
              </span>
              <span className="text-sm font-bold text-white">
                {project.target.toLocaleString()} {project.currency}
                {(project as any).type === 'fairlaunch' && '*'}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Users size={12} />
              <span>{(project as any).participants || 0} Contributors</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              <span>{isEnded ? 'Ended' : isLive ? 'Ends in 2d 5h' : 'Starts in 3d'}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
