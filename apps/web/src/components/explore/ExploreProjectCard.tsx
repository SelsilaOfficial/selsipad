'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Project } from '@/lib/data/projects';
import { StatusBadge, ProgressBar } from '@/components/ui';
import { ArrowUpRight, ShieldCheck, Lock, Users } from 'lucide-react';

interface ExploreProjectCardProps {
  project: Project;
  index: number;
}

export function ExploreProjectCard({ project, index }: ExploreProjectCardProps) {
  // Determine status color for glowing effects
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'emerald';
      case 'upcoming':
        return 'indigo';
      case 'ended':
        return 'gray';
      default:
        return 'indigo';
    }
  };

  const statusColor = getStatusColor(project.status);
  const isLive = project.status === 'live';

  return (
    <Link href={`/project/${project.id}`} className="block h-full group">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`
          relative h-full bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl p-5
          hover:bg-white/[0.04] hover:border-${statusColor}-500/30 hover:-translate-y-1
          transition-all duration-300 overflow-hidden
          group-hover:shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)]
        `}
      >
        {/* Glow Effect on Hover */}
        <div
          className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
            bg-gradient-to-tr from-${statusColor}-500/5 via-transparent to-transparent
          `}
        />

        {/* Header: Logo, Name, Badges */}
        <div className="relative z-10 flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Logo */}
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 p-0.5 flex-shrink-0 relative overflow-hidden group-hover:scale-105 transition-transform">
              {/* Using standard img tag for simplicity within this component, matching existing pattern if NextImage isn't strictly enforced or to handle external URLs easily */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={project.logo}
                alt={project.name}
                className="w-full h-full object-cover rounded-[10px]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo-placeholder.png'; // Fallback
                }}
              />
            </div>

            <div className="min-w-0">
              <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors truncate pr-2">
                {project.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  {project.symbol}
                </span>
                <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded uppercase">
                  {project.network}
                </span>
              </div>
            </div>
          </div>

          <StatusBadge status={project.status} />
        </div>

        {/* Content: Description */}
        <div className="relative z-10 mb-4 h-[40px]">
          <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        </div>

        {/* Progress Section */}
        <div className="relative z-10 bg-black/20 rounded-xl p-3 mb-4 border border-white/5">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-400">Total Raised</span>
            <span className="text-white font-medium">
              <span className="text-emerald-400">{project.raised}</span> / {project.target}{' '}
              {project.network}
            </span>
          </div>
          <ProgressBar
            value={project.raised}
            max={project.target}
            size="sm"
            showPercentage={false}
            className="bg-gray-800"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Progress</span>
            <span className="text-xs font-bold text-emerald-400">
              {Math.min(100, Math.round((project.raised / project.target) * 100))}%
            </span>
          </div>
        </div>

        {/* Footer: Tags & Action */}
        <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            {project.kyc_verified && (
              <div
                className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/5 px-2 py-1 rounded-full border border-emerald-500/10"
                title="KYC Verified"
              >
                <Users size={10} />
                <span>KYC</span>
              </div>
            )}
            {project.audit_status === 'pass' && (
              <div
                className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/5 px-2 py-1 rounded-full border border-blue-500/10"
                title="Audit Passed"
              >
                <ShieldCheck size={10} />
                <span>Audit</span>
              </div>
            )}
            {project.lp_lock && (
              <div
                className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/5 px-2 py-1 rounded-full border border-orange-500/10"
                title="Liquidity Locked"
              >
                <Lock size={10} />
                <span>SAFU</span>
              </div>
            )}
          </div>

          <div className="p-2 rounded-full bg-white/5 text-gray-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
            <ArrowUpRight size={16} />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
