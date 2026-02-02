'use client';

import { CheckCircle2, Clock, Rocket, Pause, XCircle, Flag } from 'lucide-react';

interface ProjectStatusBadgeProps {
  status: string;
}

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'DRAFT':
        return {
          label: 'Draft',
          icon: Clock,
          className: 'bg-gray-600/20 text-gray-400 border-gray-600',
        };
      case 'PENDING_DEPLOY':
        return {
          label: 'Pending Deploy',
          icon: Clock,
          className: 'bg-yellow-600/20 text-yellow-400 border-yellow-600 animate-pulse',
        };
      case 'LIVE':
        return {
          label: 'Live',
          icon: Rocket,
          className: 'bg-green-600/20 text-green-400 border-green-600',
        };
      case 'PAUSED':
        return {
          label: 'Paused',
          icon: Pause,
          className: 'bg-red-600/20 text-red-400 border-red-600',
        };
      case 'ENDED':
        return {
          label: 'Ended',
          icon: Flag,
          className: 'bg-blue-600/20 text-blue-400 border-blue-600',
        };
      case 'FINALIZED':
        return {
          label: 'Finalized',
          icon: CheckCircle2,
          className: 'bg-purple-600/20 text-purple-400 border-purple-600',
        };
      case 'REJECTED':
        return {
          label: 'Rejected',
          icon: XCircle,
          className: 'bg-red-600/20 text-red-400 border-red-600',
        };
      default:
        return {
          label: status,
          icon: Clock,
          className: 'bg-gray-600/20 text-gray-400 border-gray-600',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${config.className}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </div>
  );
}
