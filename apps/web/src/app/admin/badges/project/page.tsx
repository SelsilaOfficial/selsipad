import { createClient } from '@/lib/supabase/server';
import { Award, FolderKanban, Shield, Trophy, ArrowLeft } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import Link from 'next/link';

async function getProjectBadgeStats() {
  const supabase = createClient();

  const { data: definitions } = await supabase
    .from('badge_definitions')
    .select('id')
    .eq('scope', 'PROJECT');

  const { data: instances } = await supabase.from('project_badges').select('id, awarded_by');

  const autoAwarded = instances?.filter((i) => i.awarded_by === null) || [];
  const manualAwarded = instances?.filter((i) => i.awarded_by !== null) || [];

  return {
    totalDefinitions: definitions?.length || 0,
    totalInstances: instances?.length || 0,
    autoAwarded: autoAwarded.length,
    manualAwarded: manualAwarded.length,
  };
}

async function getProjectBadges() {
  const supabase = createClient();

  const { data: badges, error } = await supabase
    .from('badge_definitions')
    .select('*')
    .eq('scope', 'PROJECT')
    .order('badge_type', { ascending: true });

  if (error) {
    console.error('Failed to fetch project badges:', error);
    return [];
  }

  return badges || [];
}

function getBadgeTypeIcon(type: string) {
  switch (type) {
    case 'KYC':
      return Shield;
    case 'SECURITY':
      return Trophy;
    case 'MILESTONE':
      return Award;
    default:
      return Award;
  }
}

function getBadgeTypeColor(type: string) {
  switch (type) {
    case 'KYC':
      return 'text-blue-400 bg-blue-600/20';
    case 'SECURITY':
      return 'text-purple-400 bg-purple-600/20';
    case 'MILESTONE':
      return 'text-green-400 bg-green-600/20';
    case 'SPECIAL':
      return 'text-yellow-400 bg-yellow-600/20';
    default:
      return 'text-gray-400 bg-gray-600/20';
  }
}

export default async function ProjectBadgesPage() {
  const badges = await getProjectBadges();
  const stats = await getProjectBadgeStats();

  const badgesByType = badges.reduce(
    (acc, badge) => {
      if (!acc[badge.badge_type]) {
        acc[badge.badge_type] = [];
      }
      acc[badge.badge_type].push(badge);
      return acc;
    },
    {} as Record<string, any[]>
  );

  return (
    <div>
      {/* Back Button */}
      <Link
        href="/admin/badges"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Badge Management
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FolderKanban className="w-8 h-8 text-purple-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">Project Badge Management</h1>
            <p className="text-gray-400">Manage badges that attach to projects</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Badge Types"
          value={stats.totalDefinitions}
          icon={Award}
          description="Project badge definitions"
        />
        <StatCard
          title="Total Granted"
          value={stats.totalInstances}
          icon={FolderKanban}
          description="All badge instances"
        />
        <StatCard
          title="Auto Awarded"
          value={stats.autoAwarded}
          icon={Shield}
          description="Automatically granted"
        />
        <StatCard
          title="Manual"
          value={stats.manualAwarded}
          icon={Trophy}
          description="Manually granted"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/admin/badges/project/grant"
          className="flex items-center gap-4 p-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl transition-colors"
        >
          <Award className="w-8 h-8 text-white" />
          <div>
            <h3 className="text-lg font-semibold text-white">Grant Project Badge</h3>
            <p className="text-purple-200 text-sm">Award badge to project</p>
          </div>
        </Link>

        <Link
          href="/admin/badges/project/instances"
          className="flex items-center gap-4 p-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 rounded-xl transition-colors"
        >
          <FolderKanban className="w-8 h-8 text-white" />
          <div>
            <h3 className="text-lg font-semibold text-white">View Project Badges</h3>
            <p className="text-green-200 text-sm">See all awarded project badges</p>
          </div>
        </Link>
      </div>

      {/* Badge Definitions */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Project Badge Definitions</h2>

        {(Object.entries(badgesByType) as [string, any[]][]).map(([type, typeBadges]) => {
          const Icon = getBadgeTypeIcon(type);
          const colorClass = getBadgeTypeColor(type);

          return (
            <div key={type} className="mb-6">
              <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg ${colorClass}`}>
                <Icon className="w-5 h-5" />
                <span className="font-semibold">{type}</span>
                <span className="text-sm opacity-75">({typeBadges.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {typeBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-purple-600/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gray-800 rounded-lg">
                        <Icon className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1">{badge.name}</h3>
                        <p className="text-gray-400 text-sm mb-2">{badge.description}</p>
                        <code className="text-xs bg-gray-800 px-2 py-1 rounded text-purple-400 font-mono">
                          {badge.badge_key}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {badges.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <FolderKanban className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No project badge definitions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
