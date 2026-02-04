'use client';

interface BadgeDisplayProps {
  badge: {
    key: string;
    display_name: string;
    icon_url?: string;
    category?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const BADGE_EMOJI_MAP: Record<string, string> = {
  BLUE_CHECK: '✓',
  KYC_VERIFIED: '📋',
  DEV_KYC_VERIFIED: '🔐',
  REFERRAL_PRO: '👥',
  WHALE: '🐋',
  INFLUENCER: '⭐',
  TEAM_ADMIN: '👑',
  TEAM_MOD: '🛡️',
  TEAM_IT_PROGRAMMER: '💻',
  TEAM_CEO: '🎯',
  TEAM_MARKETING: '📢',
  EARLY_ADOPTER: '🌟',
  ACTIVE_CONTRIBUTOR: '🚀',
  DIAMOND_HANDS: '💎',
  EARLY_BIRD: '🐦',
  SC_AUDIT_PASSED: '✅',
  SC_AUDIT_PASS: '✅',
  FIRST_PROJECT: '🎉',
  TRENDING_PROJECT: '📈',
  VERIFIED_TEAM: '👥',
};

export function BadgeDisplay({ badge, size = 'md', showTooltip = true }: BadgeDisplayProps) {
  const emoji = BADGE_EMOJI_MAP[badge.key] || '🏅';

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // If icon_url is provided, show image instead of emoji
  if (badge.icon_url) {
    return (
      <img
        src={badge.icon_url}
        alt={badge.display_name}
        className={`inline-flex ${sizeClasses[size]}`}
        title={showTooltip ? badge.display_name : undefined}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center text-${size === 'sm' ? 'sm' : size === 'md' ? 'base' : 'lg'}`}
      title={showTooltip ? badge.display_name : undefined}
      aria-label={badge.display_name}
    >
      {emoji}
    </span>
  );
}
