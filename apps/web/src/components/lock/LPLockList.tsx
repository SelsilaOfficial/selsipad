'use client';

import { useState } from 'react';
import {
  Lock,
  Shield,
  ExternalLink,
  Clock,
  Droplets,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { LPLockItem } from '@/actions/lock/get-lp-locks';

interface LPLockListProps {
  locks: LPLockItem[];
}

const chainNames: Record<string, string> = {
  '97': 'BSC Testnet',
  '56': 'BNB Chain',
  '1': 'Ethereum',
  '11155111': 'Sepolia',
  '8453': 'Base',
  '84532': 'Base Sepolia',
};

const chainExplorers: Record<string, string> = {
  '97': 'https://testnet.bscscan.com',
  '56': 'https://bscscan.com',
  '1': 'https://etherscan.io',
  '11155111': 'https://sepolia.etherscan.io',
  '8453': 'https://basescan.org',
  '84532': 'https://sepolia.basescan.org',
};

const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  FAIRLAUNCH: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  PRESALE: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  BONDING: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
};

const lockStatusStyles: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  LOCKED: { bg: 'bg-green-500/10', text: 'text-green-400', icon: CheckCircle2 },
  PENDING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: Clock },
  NONE: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: AlertCircle },
  UNLOCKED: { bg: 'bg-red-500/10', text: 'text-red-400', icon: AlertCircle },
};

function getUnlockDate(lockedAt: string | null, months: number): string | null {
  if (!lockedAt || months <= 0) return null;
  const date = new Date(lockedAt);
  date.setMonth(date.getMonth() + months);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getDaysRemaining(lockedAt: string | null, months: number): number | null {
  if (!lockedAt || months <= 0) return null;
  const unlockDate = new Date(lockedAt);
  unlockDate.setMonth(unlockDate.getMonth() + months);
  const now = new Date();
  const diff = unlockDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function LPLockList({ locks }: LPLockListProps) {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filtered = filterType === 'ALL' ? locks : locks.filter((l) => l.type === filterType);

  if (locks.length === 0) {
    return (
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
        <Lock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No Locked Liquidity Yet</h3>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          When projects launch via Selsipad, their liquidity will be automatically locked and
          displayed here for investor transparency.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['ALL', 'FAIRLAUNCH', 'PRESALE', 'BONDING'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              filterType === type
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                : 'bg-white/[0.03] text-gray-400 border border-white/5 hover:bg-white/[0.06]'
            }`}
          >
            {type === 'ALL' ? 'All Projects' : type.charAt(0) + type.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Lock Cards */}
      <div className="space-y-4">
        {filtered.map((lock) => (
          <LPLockCard key={lock.id} lock={lock} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No {filterType.toLowerCase()} projects found.
        </div>
      )}
    </div>
  );
}

function LPLockCard({ lock }: { lock: LPLockItem }) {
  const [expanded, setExpanded] = useState(false);
  const typeStyle = typeColors[lock.type] || typeColors.FAIRLAUNCH;
  const lockStyle = lockStatusStyles[lock.lockStatus] || lockStatusStyles.NONE;
  const LockIcon = lockStyle.icon;

  const explorer = chainExplorers[lock.chain] || chainExplorers['97'];
  const chainName = chainNames[lock.chain] || `Chain ${lock.chain}`;
  const unlockDate = getUnlockDate(lock.lockedAt, lock.lockDurationMonths);
  const daysRemaining = getDaysRemaining(lock.lockedAt, lock.lockDurationMonths);

  return (
    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all">
      {/* Main Row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center gap-4 text-left"
      >
        {/* Logo */}
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
          {lock.logoUrl ? (
            <img src={lock.logoUrl} alt={lock.symbol} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-gray-400">{lock.symbol?.charAt(0) || '?'}</span>
          )}
        </div>

        {/* Project Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-semibold truncate">{lock.projectName}</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeStyle.bg} ${typeStyle.text} border ${typeStyle.border}`}
            >
              {lock.type}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{chainName}</span>
            <span>•</span>
            <span>{lock.dexPlatform}</span>
          </div>
        </div>

        {/* LP Lock Info */}
        <div className="hidden sm:flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-0.5">Liquidity</div>
            <div className="text-sm font-semibold text-white">{lock.liquidityPercent}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-0.5">Lock Duration</div>
            <div className="text-sm font-semibold text-white">{lock.lockDurationMonths} months</div>
          </div>
        </div>

        {/* Lock Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${lockStyle.bg} ${lockStyle.text}`}
        >
          <LockIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {lock.lockStatus === 'NONE' ? 'Pending' : lock.lockStatus}
          </span>
        </div>

        {/* Expand Arrow */}
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <DetailItem
              icon={<Droplets className="w-4 h-4 text-blue-400" />}
              label="Liquidity %"
              value={`${lock.liquidityPercent}%`}
            />
            <DetailItem
              icon={<Clock className="w-4 h-4 text-orange-400" />}
              label="Lock Duration"
              value={`${lock.lockDurationMonths} months`}
            />
            <DetailItem
              icon={<Shield className="w-4 h-4 text-green-400" />}
              label="DEX Platform"
              value={lock.dexPlatform}
            />
            <DetailItem
              icon={<Lock className="w-4 h-4 text-indigo-400" />}
              label="Unlocks"
              value={unlockDate || 'After finalization'}
            />
          </div>

          {/* Days remaining indicator */}
          {daysRemaining !== null && daysRemaining > 0 && (
            <div className="mt-4 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-medium">
                  {daysRemaining} days remaining until unlock
                </span>
              </div>
            </div>
          )}

          {/* Contract Links */}
          <div className="mt-4 flex flex-wrap gap-2">
            {lock.tokenAddress && (
              <a
                href={`${explorer}/token/${lock.tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                Token Contract
              </a>
            )}
            {lock.contractAddress && (
              <a
                href={`${explorer}/address/${lock.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                Launch Contract
              </a>
            )}
            {lock.poolAddress && (
              <a
                href={`${explorer}/address/${lock.poolAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                LP Pool
              </a>
            )}
            {lock.lockTxHash && (
              <a
                href={`${explorer}/tx/${lock.lockTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/5 border border-green-500/20 rounded-lg text-xs text-green-400 hover:text-green-300 transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                Lock Transaction
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
        <div className="text-sm font-medium text-white">{value}</div>
      </div>
    </div>
  );
}
