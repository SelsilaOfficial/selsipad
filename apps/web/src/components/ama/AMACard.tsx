'use client';

import { type AMAType, type AMAStatus } from '@/app/ama/actions';

interface AMACardProps {
  ama: {
    id: string;
    title: string;
    description?: string;
    type: AMAType;
    status: AMAStatus;
    scheduled_at: string;
    started_at?: string;
    host: {
      username: string;
      avatar_url?: string;
      bluecheck_status?: string;
    };
    projects: {
      name: string;
      logo_url?: string;
    };
  };
}

export function AMACard({ ama }: AMACardProps) {
  const isLive = ama.status === 'LIVE';
  const isUpcoming = ama.status === 'APPROVED';

  const typeColors = {
    TEXT: 'bg-blue-100 text-blue-800',
    VOICE: 'bg-purple-100 text-purple-800',
    VIDEO: 'bg-pink-100 text-pink-800',
  };

  const statusColors = {
    SUBMITTED: 'bg-gray-100 text-gray-800',
    PAID: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    LIVE: 'bg-red-100 text-red-800',
    ENDED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {ama.projects.logo_url && (
            <img
              src={ama.projects.logo_url}
              alt={ama.projects.name}
              className="w-12 h-12 rounded-full"
            />
          )}
          <div>
            <h3 className="font-semibold text-gray-900">{ama.title}</h3>
            <p className="text-sm text-gray-600">{ama.projects.name}</p>
          </div>
        </div>

        {isLive && (
          <span className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Description */}
      {ama.description && (
        <p className="text-gray-700 text-sm mb-4 line-clamp-2">{ama.description}</p>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${typeColors[ama.type]}`}>
          {ama.type}
        </span>
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[ama.status]}`}>
          {ama.status}
        </span>
      </div>

      {/* Host & Time */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Host:</span>
          <span className="font-medium text-gray-900">{ama.host.username}</span>
          {(ama.host.bluecheck_status === 'VERIFIED' || ama.host.bluecheck_status === 'ACTIVE') && (
            <span className="text-blue-500">✓</span>
          )}
        </div>

        <div className="text-gray-600">
          {new Date(ama.scheduled_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-4">
        <a
          href={`/ama/${ama.id}`}
          className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {isLive ? 'Join Now' : isUpcoming ? 'View Details' : 'View'}
        </a>
      </div>
    </div>
  );
}
