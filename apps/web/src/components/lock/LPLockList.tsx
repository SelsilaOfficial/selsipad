'use client';

import { useState, useCallback } from 'react';
import {
  Lock,
  Shield,
  ExternalLink,
  Clock,
  Droplets,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Unlock,
  Timer,
  ShieldCheck,
  Loader2,
  Coins,
} from 'lucide-react';
import type { LPLockItem } from '@/actions/lock/get-lp-locks';

// ─── Wagmi / Viem imports for on-chain interactions ───
// These will be used for unlock/extend when wallet is connected
// import { useAccount, useWriteContract } from 'wagmi';

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
  UNLOCKED: { bg: 'bg-red-500/10', text: 'text-red-400', icon: Unlock },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getDaysRemaining(lockedUntil: string | null): number | null {
  if (!lockedUntil) return null;
  const unlockDate = new Date(lockedUntil);
  const now = new Date();
  const diff = unlockDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getProgressPercent(lockedAt: string | null, lockedUntil: string | null): number {
  if (!lockedAt || !lockedUntil) return 0;
  const start = new Date(lockedAt).getTime();
  const end = new Date(lockedUntil).getTime();
  const now = Date.now();
  const total = end - start;
  if (total <= 0) return 100;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

function shortenAddress(addr: string | null): string {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function LPLockList({ locks }: LPLockListProps) {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filtered = filterType === 'ALL' ? locks : locks.filter((l) => l.type === filterType);
  const lockedCount = locks.filter((l) => l.lockStatus === 'LOCKED').length;
  const totalValue = locks.reduce((sum, l) => sum + parseFloat(l.totalRaised || '0'), 0);

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
                ? 'bg-[#39AEC4]/20 text-[#39AEC4] border border-[#39AEC4]/40'
                : 'bg-white/[0.03] text-gray-400 border border-white/5 hover:bg-white/[0.06]'
            }`}
          >
            {type === 'ALL'
              ? `All (${locks.length})`
              : type.charAt(0) + type.slice(1).toLowerCase()}
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
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  const typeStyle = typeColors[lock.type] ?? {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  };
  const lockStyle = lockStatusStyles[lock.lockStatus] ?? {
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    icon: AlertCircle,
  };
  const LockStatusIcon = lockStyle.icon;

  const explorer = chainExplorers[lock.chain] || chainExplorers['97'];
  const chainName = chainNames[lock.chain] || `Chain ${lock.chain}`;
  const daysRemaining = getDaysRemaining(lock.lockedUntil);
  const progress = getProgressPercent(lock.lockedAt, lock.lockedUntil);
  const isUnlockable =
    daysRemaining !== null && daysRemaining === 0 && lock.lockStatus === 'LOCKED';

  // On-chain verification via RPC call
  const handleVerify = useCallback(async () => {
    if (!lock.lockerAddress || lock.lockId === null) return;
    setVerifying(true);
    setVerified(null);

    try {
      const rpcUrls: Record<string, string> = {
        '97': 'https://bsc-testnet-rpc.publicnode.com',
        '56': 'https://bsc-dataseed.binance.org',
      };
      const rpcUrl = rpcUrls[lock.chain];
      if (!rpcUrl) throw new Error('Unsupported chain');

      // Call getLock(lockId) on the LPLocker contract via eth_call
      // Function selector for getLock(uint256): 0x21e44379
      const lockIdHex = lock.lockId.toString(16).padStart(64, '0');
      const data = `0x21e44379${lockIdHex}`;

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: lock.lockerAddress, data }, 'latest'],
          id: 1,
        }),
      });

      const result = await response.json();
      if (result.result && result.result !== '0x') {
        // Decode the response — if we get data back, the lock exists on-chain
        // Check if amount > 0 (offset 128, 32 bytes)
        const amountHex = result.result.substring(2 + 128 * 2, 2 + 128 * 2 + 64);
        const amount = BigInt('0x' + amountHex);
        setVerified(amount > 0n);
      } else {
        setVerified(false);
      }
    } catch (err) {
      console.error('Verification failed:', err);
      setVerified(false);
    } finally {
      setVerifying(false);
    }
  }, [lock.lockerAddress, lock.lockId, lock.chain]);

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
            {/* On-chain verification badge */}
            {verified === true && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{chainName}</span>
            <span>•</span>
            <span>{lock.dexPlatform}</span>
            {lock.lockAmount && (
              <>
                <span>•</span>
                <span className="text-gray-400">{parseFloat(lock.lockAmount).toFixed(4)} LP</span>
              </>
            )}
          </div>
        </div>

        {/* LP Lock Info — Desktop */}
        <div className="hidden sm:flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-0.5">Liquidity</div>
            <div className="text-sm font-semibold text-white">{lock.liquidityPercent}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-0.5">
              {lock.lockedUntil ? 'Unlocks' : 'Lock Plan'}
            </div>
            <div className="text-sm font-semibold text-white">
              {lock.lockedUntil
                ? formatDate(lock.lockedUntil)
                : `${lock.lockDurationMonths} months`}
            </div>
          </div>
        </div>

        {/* Lock Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${lockStyle.bg} ${lockStyle.text}`}
        >
          <LockStatusIcon className="w-3.5 h-3.5" />
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
          {/* Lock Progress Bar */}
          {lock.lockStatus === 'LOCKED' && lock.lockedUntil && (
            <div className="pt-4 mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Locked: {formatDate(lock.lockedAt)}</span>
                <span>Unlocks: {formatDate(lock.lockedUntil)}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background:
                      progress >= 100
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  }}
                />
              </div>
              {daysRemaining !== null && daysRemaining > 0 && (
                <div className="text-xs text-gray-400 mt-1.5 text-center">
                  {daysRemaining} days remaining
                </div>
              )}
            </div>
          )}

          {/* Detail Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
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
            {lock.lockId !== null ? (
              <DetailItem
                icon={<Coins className="w-4 h-4 text-yellow-400" />}
                label="On-Chain Lock ID"
                value={`#${lock.lockId}`}
              />
            ) : (
              <DetailItem
                icon={<Lock className="w-4 h-4 text-indigo-400" />}
                label="Unlock Date"
                value={lock.lockedUntil ? formatDate(lock.lockedUntil) : 'After finalization'}
              />
            )}
          </div>

          {/* Beneficiary & Locker Address */}
          {(lock.beneficiary || lock.lockerAddress) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {lock.beneficiary && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Beneficiary
                  </span>
                  <a
                    href={`${explorer}/address/${lock.beneficiary}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-mono"
                  >
                    {shortenAddress(lock.beneficiary)}
                  </a>
                </div>
              )}
              {lock.lockerAddress && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] rounded-xl border border-white/5">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                    Locker Contract
                  </span>
                  <a
                    href={`${explorer}/address/${lock.lockerAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-mono"
                  >
                    {shortenAddress(lock.lockerAddress)}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            {/* On-Chain Verify Button */}
            {lock.lockerAddress && lock.lockId !== null && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  verified === true
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : verified === false
                      ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                      : 'bg-white/[0.03] border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Verifying...
                  </>
                ) : verified === true ? (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    On-Chain Verified ✓
                  </>
                ) : verified === false ? (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    Not Found On-Chain
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    Verify On-Chain
                  </>
                )}
              </button>
            )}

            {/* Unlock LP Button (shown when lock expired) */}
            {isUnlockable && lock.lockerAddress && (
              <a
                href={`${explorer}/address/${lock.lockerAddress}#writeContract`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                <Unlock className="w-3 h-3" />
                Unlock LP
              </a>
            )}

            {/* Extend Lock Button */}
            {lock.lockStatus === 'LOCKED' &&
              lock.lockerAddress &&
              daysRemaining !== null &&
              daysRemaining > 0 && (
                <a
                  href={`${explorer}/address/${lock.lockerAddress}#writeContract`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-xs font-medium text-indigo-400 hover:bg-indigo-500/20 transition-all"
                >
                  <Timer className="w-3 h-3" />
                  Extend Lock
                </a>
              )}

            {/* Explorer Links */}
            {lock.tokenAddress && (
              <a
                href={`${explorer}/token/${lock.tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                Token
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
                Lock TX
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
