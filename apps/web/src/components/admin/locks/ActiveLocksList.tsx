'use client';

import { Lock, ExternalLink, ShieldCheck, Coins, User } from 'lucide-react';

interface ActiveLock {
  id: string;
  chain: string;
  lock_id: number | null;
  lp_token: string | null;
  locker_address: string | null;
  amount: string | null;
  beneficiary: string | null;
  locked_at: string;
  locked_until: string;
  lock_tx_hash: string | null;
  status: string;
  round: {
    id: string;
    project: { id: string; name: string };
  };
}

interface ActiveLocksListProps {
  locks: ActiveLock[];
}

const chainExplorers: Record<string, string> = {
  '97': 'https://testnet.bscscan.com',
  '56': 'https://bscscan.com',
  bsc: 'https://bscscan.com',
  ethereum: 'https://etherscan.io',
};

const chainNames: Record<string, string> = {
  '97': 'BSC Testnet',
  '56': 'BNB Chain',
  bsc: 'BNB Chain',
  ethereum: 'Ethereum',
};

function shortenAddr(addr: string | null): string {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function ActiveLocksList({ locks }: ActiveLocksListProps) {
  const calculateDaysRemaining = (unlockDate: string) => {
    const now = new Date();
    const unlock = new Date(unlockDate);
    const diff = unlock.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getProgress = (lockedAt: string, lockedUntil: string) => {
    const start = new Date(lockedAt).getTime();
    const end = new Date(lockedUntil).getTime();
    const now = Date.now();
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  };

  if (locks.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <div className="text-center">
          <Lock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Active Locks</h3>
          <p className="text-sm text-gray-400">Successfully locked LP tokens will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-6 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white">Active Locks ({locks.length})</h2>
      </div>

      <div className="divide-y divide-gray-800">
        {locks.map((lock) => {
          const daysRemaining = calculateDaysRemaining(lock.locked_until);
          const lockDate = new Date(lock.locked_at);
          const unlockDate = new Date(lock.locked_until);
          const progress = getProgress(lock.locked_at, lock.locked_until);
          const explorer = chainExplorers[lock.chain] || chainExplorers['97'];
          const chainLabel = chainNames[lock.chain] || lock.chain;

          return (
            <div key={lock.id} className="p-6 hover:bg-gray-800/50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{lock.round.project.name}</h3>
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                      LOCKED 🟢
                    </span>
                    {lock.lock_id !== null && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-xs font-medium">
                        <ShieldCheck className="w-3 h-3" />
                        Lock #{lock.lock_id}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Locked On</div>
                      <div className="text-sm font-medium text-white">
                        {lockDate.toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Unlock Date</div>
                      <div className="text-sm font-medium text-white">
                        {unlockDate.toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Days Remaining</div>
                      <div
                        className={`text-sm font-medium ${daysRemaining === 0 ? 'text-emerald-400' : 'text-white'}`}
                      >
                        {daysRemaining === 0 ? 'Unlockable ✓' : `${daysRemaining} days`}
                      </div>
                    </div>
                    {lock.amount && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">LP Amount</div>
                        <div className="text-sm font-medium text-white flex items-center gap-1">
                          <Coins className="w-3 h-3 text-yellow-400" />
                          {parseFloat(lock.amount).toFixed(6)}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Chain</div>
                      <div className="text-sm font-medium text-white">{chainLabel}</div>
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                    {lock.beneficiary && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Beneficiary:{' '}
                        <a
                          href={`${explorer}/address/${lock.beneficiary}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 font-mono"
                        >
                          {shortenAddr(lock.beneficiary)}
                        </a>
                      </span>
                    )}
                    {lock.locker_address && (
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Locker:{' '}
                        <a
                          href={`${explorer}/address/${lock.locker_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 font-mono"
                        >
                          {shortenAddr(lock.locker_address)}
                        </a>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {lock.lock_tx_hash && (
                    <a
                      href={`${explorer}/tx/${lock.lock_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors inline-flex items-center justify-center gap-2"
                    >
                      View Lock
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {lock.locker_address && (
                    <a
                      href={`${explorer}/address/${lock.locker_address}#readContract`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors inline-flex items-center justify-center gap-2"
                    >
                      Contract
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <a
                    href={`/admin/projects/${lock.round.project.id}`}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors inline-flex items-center justify-center gap-2"
                  >
                    Project
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>Lock Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
