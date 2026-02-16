import { createClient } from '@/lib/supabase/server';
import { Award, Users, Shield, Star, ArrowLeft } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import Link from 'next/link';

async function getUserBadgeStats() {
  const supabase = createClient();

  const { data: definitions } = await supabase
    .from('badge_definitions')
    .select('id')
    .eq('scope', 'USER');

  const { data: instances } = await supabase
    .from('badge_instances')
    .select('id, status, awarded_by');

  const activeInstances = instances?.filter((i) => i.status === 'ACTIVE') || [];
  const autoAwarded = activeInstances.filter((i) => i.awarded_by === null);
  const manualAwarded = activeInstances.filter((i) => i.awarded_by !== null);

  return {
    totalDefinitions: definitions?.length || 0,
    totalInstances: instances?.length || 0,
    activeInstances: activeInstances.length,
    autoAwarded: autoAwarded.length,
    manualAwarded: manualAwarded.length,
  };
}

async function getUserBadges() {
  const supabase = createClient();

  const { data: badges, error } = await supabase
    .from('badge_definitions')
    .select('*')
    .eq('scope', 'USER')
    .order('badge_type', { ascending: true });

  if (error) {
    console.error('Failed to fetch user badges:', error);
    return [];
  }

  return badges || [];
}

function getBadgeTypeIcon(type: string) {
  switch (type) {
    case 'MILESTONE':
      return Star;
    case 'SPECIAL':
      return Award;
    default:
      return Award;
  }
}

function getBadgeTypeColor(type: string) {
  switch (type) {
    case 'MILESTONE':
      return 'text-green-400 bg-green-600/20';
    case 'SPECIAL':
      return 'text-yellow-400 bg-yellow-600/20';
    default:
      return 'text-gray-400 bg-gray-600/20';
  }
}

export default async function UserBadgesPage() {
  const badges = await getUserBadges();
  const stats = await getUserBadgeStats();

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
          <Users className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">User Badge Management</h1>
            <p className="text-gray-400">Manage badges that attach to user profiles</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard
          title="Badge Types"
          value={stats.totalDefinitions}
          icon={Award}
          description="User badge definitions"
        />
        <StatCard
          title="Total Granted"
          value={stats.totalInstances}
          icon={Users}
          description="All badge instances"
        />
        <StatCard
          title="Active"
          value={stats.activeInstances}
          icon={Star}
          description="Currently active"
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
          icon={Award}
          description="Manually granted"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/admin/badges/user/grant"
          className="flex items-center gap-4 p-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl transition-colors"
        >
          <Award className="w-8 h-8 text-white" />
          <div>
            <h3 className="text-lg font-semibold text-white">Grant User Badge</h3>
            <p className="text-blue-200 text-sm">Award badge to user profile</p>
          </div>
        </Link>

        <Link
          href="/admin/badges/user/instances"
          className="flex items-center gap-4 p-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 rounded-xl transition-colors"
        >
          <Users className="w-8 h-8 text-white" />
          <div>
            <h3 className="text-lg font-semibold text-white">View User Badges</h3>
            <p className="text-green-200 text-sm">See all awarded user badges</p>
          </div>
        </Link>
      </div>

      {/* Badge Definitions */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">User Badge Definitions</h2>

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
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-600/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gray-800 rounded-lg">
                        <Icon className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1">{badge.name}</h3>
                        <p className="text-gray-400 text-sm mb-2">{badge.description}</p>
                        <code className="text-xs bg-gray-800 px-2 py-1 rounded text-blue-400 font-mono">
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
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No user badge definitions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
