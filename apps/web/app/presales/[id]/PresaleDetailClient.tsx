'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Twitter,
  Send,
  MessageCircle,
  Shield,
  CheckCircle,
  Copy,
  Clock,
  TrendingUp,
  Lock,
  Users,
  AlertCircle,
  Loader2,
  DollarSign,
  Target,
  Coins,
  Calendar,
  Percent,
} from 'lucide-react';
import { NetworkBadge } from '@/components/presale/NetworkBadge';
import { StatusPill } from '@/components/presale/StatusPill';
import { ContributionForm } from '@/components/presale/ContributionForm';
import VestingClaimer from '@/components/presale/VestingClaimer';
import RefundCard from '@/components/presale/RefundCard';
import { Countdown } from '@/components/ui/Countdown';
import { parseEther } from 'viem';

interface PresaleDetailClientProps {
  round: any;
  userContribution: any;
  allContributions: any[];
  isOwner: boolean;
}

const PRESALE_STATUS = {
  UPCOMING: 0,
  ACTIVE: 1,
  ENDED: 2,
  FINALIZING: 3, // V2.4: snapshot taken, phases in progress
  FINALIZED_SUCCESS: 4, // was 3 in V2.3
  FINALIZED_FAILED: 5, // was 4 in V2.3
  CANCELLED: 6, // was 5 in V2.3
} as const;

// ─── Helpers ──────────────────────────────────

function getTimeStatus(startAt: string, endAt: string): 'upcoming' | 'live' | 'ended' {
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (now < start) return 'upcoming';
  if (now >= start && now < end) return 'live';
  return 'ended';
}

function calculateTimeProgress(startAt: string, endAt: string): number {
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return ((now - start) / (end - start)) * 100;
}

function getNetworkDisplay(chain?: string, chainId?: string | number): string {
  const keyMap: Record<string, string> = {
    '97': 'BSC Testnet',
    '56': 'BNB Chain',
    '11155111': 'Sepolia',
    '1': 'Ethereum',
    '8453': 'Base',
    '84532': 'Base Sepolia',
    bsc_testnet: 'BSC Testnet',
    bnb: 'BNB Chain',
    ethereum: 'Ethereum',
    base: 'Base',
  };
  if (chain && keyMap[chain]) return keyMap[chain];
  if (chainId) {
    const key = chainId.toString();
    const val = keyMap[key];
    if (val) return val;
  }
  return chain || 'Unknown Network';
}

function getNativeCurrency(chain?: string, chainId?: string | number): string {
  const c = chain?.toLowerCase() || '';
  const cid = chainId?.toString() || '';
  const isChainNumeric = /^\d+$/.test(c);
  const effectiveChainId = isChainNumeric ? c : cid;
  if (effectiveChainId === '97' || effectiveChainId === '56') return 'BNB';
  if (c.includes('bsc') || c.includes('bnb')) return 'BNB';
  return 'ETH';
}

function getExplorerUrl(chain: string): string {
  if (chain === '97' || chain.includes('bsc_test')) return 'https://testnet.bscscan.com';
  if (chain === '56' || chain.includes('bsc') || chain.includes('bnb'))
    return 'https://bscscan.com';
  if (chain === '8453' || chain.includes('base')) return 'https://basescan.org';
  if (chain === '84532') return 'https://sepolia.basescan.org';
  if (chain === '11155111') return 'https://sepolia.etherscan.io';
  if (chain === '1') return 'https://etherscan.io';
  return 'https://testnet.bscscan.com';
}

// ─── Main Component ──────────────────────────────────

export function PresaleDetailClient({
  round,
  userContribution,
  allContributions,
  isOwner,
}: PresaleDetailClientProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const { address } = useAccount();
  const roundAddress = round.round_address || round.contract_address;

  const presaleStatus =
    round.result === 'SUCCESS'
      ? PRESALE_STATUS.FINALIZED_SUCCESS
      : round.result === 'FAILED'
        ? PRESALE_STATUS.FINALIZED_FAILED
        : round.result === 'CANCELED' || round.result === 'CANCELLED'
          ? PRESALE_STATUS.CANCELLED
          : PRESALE_STATUS.ENDED;

  // Data extraction
  const params = round.params || {};
  const project = round.projects || {};
  const chainKey = round.chain || '';
  const chainId = round.chain_id || params.chain_id;
  const networkName = getNetworkDisplay(chainKey, chainId);
  const nativeCurrency = getNativeCurrency(chainKey, chainId);
  const explorerBase = getExplorerUrl(chainKey || chainId?.toString() || '97');

  // Project info
  const projectName = project.name || params.name || params.project_name || 'Unnamed Presale';
  const projectSymbol = project.symbol || params.token_symbol || round.token_symbol || '';
  const projectDesc = project.description || params.description || 'No description provided';
  const projectLogo = project.logo_url || params.logo_url;

  // Sale params
  const softcap = parseFloat(params.softcap || '0');
  const hardcap = parseFloat(params.hardcap || '0');
  const minContrib = parseFloat(params.min_contribution || '0');
  const maxContrib = parseFloat(params.max_contribution || '0');
  const price = parseFloat(params.price || '0');
  const tokensForSale = parseFloat(params.token_for_sale || params.tokens_for_sale || '0');
  const raised = round.total_raised || 0;

  // Total supply
  const totalSupply =
    project.metadata?.token_total_supply ||
    project.token_total_supply ||
    params.token_total_supply ||
    params.total_supply ||
    0;

  // Progress
  const progress = hardcap > 0 ? (raised / hardcap) * 100 : 0;
  const softcapProgress = softcap > 0 ? (raised / softcap) * 100 : 0;

  // Time
  const timeStatus = getTimeStatus(round.start_at, round.end_at);
  const isLive = timeStatus === 'live';
  const isEnded = timeStatus === 'ended';

  // Result
  const result = round.result || 'NONE';
  const isSuccess = result === 'SUCCESS';
  const isFailed = result === 'FAILED';
  const isCancelled = result === 'CANCELLED' || result === 'CANCELED';

  // Vesting
  const investorVesting = params.investor_vesting;
  const teamVesting = params.team_vesting;
  const lpLock = params.lp_lock;

  // Social links
  const socialLinks = params.basics || {};

  // Tabs
  const tabs: { key: string; label: string; enabled: boolean; hasIndicator?: boolean }[] = [
    { key: 'overview', label: 'Overview', enabled: true },
    {
      key: 'contribute',
      label: 'Contribute',
      enabled:
        (round.status === 'DEPLOYED' || round.status === 'ACTIVE' || round.status === 'LIVE') &&
        !isEnded,
      hasIndicator: isLive,
    },
    {
      key: 'claim',
      label: 'Claim',
      enabled: isSuccess,
      hasIndicator: isSuccess,
    },
    {
      key: 'refund',
      label: 'Refund',
      enabled: isFailed || isCancelled,
      hasIndicator: isFailed || isCancelled,
    },
    { key: 'transactions', label: 'Transactions', enabled: true },
  ];

  const shortAddr = (addr?: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Link */}
      <Link
        href="/explore"
        className="inline-flex items-center text-gray-400 hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Explore
      </Link>

      {/* ═══════════════════ HEADER CARD ═══════════════════ */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            {projectLogo ? (
              <img
                src={projectLogo}
                alt={projectName}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-2xl font-bold">
                {projectName[0]}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{projectName}</h1>
              <p className="text-gray-400 mb-3">{projectDesc}</p>
              <div className="flex items-center gap-3 flex-wrap">
                {projectSymbol && (
                  <span className="text-sm text-gray-500">
                    Token: <span className="text-white font-semibold">{projectSymbol}</span>
                  </span>
                )}
                {round.status !== 'DEPLOYED' && <StatusPill status={round.status} />}
                <NetworkBadge network={chainKey} chainId={chainId?.toString()} />
                <span className="px-3 py-1 text-xs rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-semibold">
                  PRESALE
                </span>
                {/* Security Badges - same logic as fairlaunch */}
                {(() => {
                  const badges = project.metadata?.security_badges || [];
                  const hasFactoryAddress = project.factory_address != null;
                  const hasSafu = badges.includes('SAFU') || hasFactoryAddress;
                  const hasScPass = badges.includes('SC_PASS') || hasFactoryAddress;

                  if (!hasSafu && !hasScPass) return null;

                  return (
                    <>
                      {hasSafu && (
                        <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-xs font-medium text-yellow-400 flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          SAFU
                        </span>
                      )}
                      {hasScPass && (
                        <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-xs font-medium text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          SC Pass
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-2 mt-3">
                {(socialLinks.website || project.website_url) && (
                  <a
                    href={socialLinks.website || project.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    title="Website"
                  >
                    <Globe className="w-4 h-4 text-gray-400" />
                  </a>
                )}
                {(socialLinks.twitter || project.twitter_url) && (
                  <a
                    href={socialLinks.twitter || project.twitter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    title="Twitter"
                  >
                    <Twitter className="w-4 h-4 text-gray-400" />
                  </a>
                )}
                {(socialLinks.telegram || project.telegram_url) && (
                  <a
                    href={socialLinks.telegram || project.telegram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    title="Telegram"
                  >
                    <Send className="w-4 h-4 text-gray-400" />
                  </a>
                )}
                {(socialLinks.discord || project.discord_url) && (
                  <a
                    href={socialLinks.discord || project.discord_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    title="Discord"
                  >
                    <MessageCircle className="w-4 h-4 text-gray-400" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════ TIMELINE ═══════════════════ */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Status
            </span>
            {(() => {
              const colors = {
                upcoming: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                live: 'bg-green-500/10 border-green-500/30 text-green-400',
                ended: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
              };
              return (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border uppercase ${colors[timeStatus]}`}
                >
                  {timeStatus === 'live'
                    ? '🟢 Live'
                    : timeStatus === 'upcoming'
                      ? '⏰ Upcoming'
                      : '⏹️ Ended'}
                </span>
              );
            })()}
          </div>

          {/* Timeline Bar */}
          <div className="relative h-2 bg-gray-700 rounded-full mb-3">
            <div
              className="absolute h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${calculateTimeProgress(round.start_at, round.end_at)}%` }}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>
              <div className="text-gray-400">Start</div>
              <div className="text-white font-medium" suppressHydrationWarning>
                {new Date(round.start_at).toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-400">End</div>
              <div className="text-white font-medium" suppressHydrationWarning>
                {new Date(round.end_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Countdown */}
          {timeStatus === 'live' && (
            <div className="mt-3 text-center bg-green-500/5 border border-green-500/20 rounded-lg py-2">
              <div className="text-gray-400 text-xs mb-1">Time Remaining</div>
              <div className="text-xl font-bold text-green-400">
                <Countdown targetDate={round.end_at} />
              </div>
            </div>
          )}
          {timeStatus === 'upcoming' && (
            <div className="mt-3 text-center bg-blue-500/5 border border-blue-500/20 rounded-lg py-2">
              <div className="text-gray-400 text-xs mb-1">Starts In</div>
              <div className="text-xl font-bold text-blue-400">
                <Countdown targetDate={round.start_at} />
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════ PROGRESS BAR ═══════════════════ */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Progress</span>
            <span className="text-white font-semibold">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-2 relative">
            {/* Softcap marker */}
            {hardcap > 0 && softcap > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-yellow-500 z-10"
                style={{ left: `${(softcap / hardcap) * 100}%` }}
                title={`Softcap: ${softcap} ${nativeCurrency}`}
              />
            )}
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <div>
              <span className="text-gray-500">Raised: </span>
              <span className="text-white font-semibold">
                {raised} {nativeCurrency}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Softcap: </span>
              <span className="text-yellow-400 font-semibold">
                {softcap} {nativeCurrency}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Hardcap: </span>
              <span className="text-white font-semibold">
                {hardcap} {nativeCurrency}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Participants: </span>
              <span className="text-white font-semibold">{round.total_participants || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ TABS ═══════════════════ */}
      <div className="mb-6 border-b border-gray-800">
        <div className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => tab.enabled && setActiveTab(tab.key)}
              disabled={!tab.enabled}
              className={`pb-3 px-1 font-medium transition-colors whitespace-nowrap relative ${
                activeTab === tab.key
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : tab.enabled
                    ? 'text-gray-500 hover:text-gray-300'
                    : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              {tab.label}
              {tab.hasIndicator && activeTab !== tab.key && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════ TAB CONTENT ═══════════════════ */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Presale Mechanics */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">🎯 Presale Mechanics</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-purple-400 font-bold">•</span>
                  <div>
                    <p className="text-white font-medium">Fixed Price</p>
                    <p className="text-gray-400">
                      Tokens sold at a fixed rate of{' '}
                      <span className="text-purple-300 font-semibold">
                        {price} {nativeCurrency}
                      </span>{' '}
                      per token
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-purple-400 font-bold">•</span>
                  <div>
                    <p className="text-white font-medium">Hardcap Limit</p>
                    <p className="text-gray-400">
                      Sale ends when{' '}
                      <span className="text-white font-semibold">
                        {hardcap} {nativeCurrency}
                      </span>{' '}
                      is raised or time runs out
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-purple-400 font-bold">•</span>
                  <div>
                    <p className="text-white font-medium">Refund Condition</p>
                    <p className="text-gray-400">
                      If total raised {'<'} softcap ({softcap} {nativeCurrency}) → all participants
                      get refunds
                    </p>
                  </div>
                </div>
                {investorVesting && (
                  <div className="flex items-start gap-3">
                    <span className="text-purple-400 font-bold">•</span>
                    <div>
                      <p className="text-white font-medium">Vesting Enabled</p>
                      <p className="text-gray-400">
                        {investorVesting.tge_percentage || 0}% unlocked at TGE, rest vested over
                        time
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Token Information */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">🪙 Token Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Token Name</div>
                  <div className="text-white font-medium">{projectName}</div>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Symbol</div>
                  <div className="text-white font-medium">{projectSymbol || 'N/A'}</div>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg col-span-full">
                  <div className="text-sm text-gray-400 mb-1">Token Address</div>
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="text-white font-mono text-sm truncate min-w-0 flex-1">
                      {round.token_address || 'N/A'}
                    </code>
                    {round.token_address && (
                      <>
                        <button
                          onClick={() => navigator.clipboard.writeText(round.token_address)}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          title="Copy address"
                        >
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                        <a
                          href={`${explorerBase}/address/${round.token_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          title="View on explorer"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
                {roundAddress && (
                  <div className="p-4 bg-gray-800 rounded-lg col-span-full">
                    <div className="text-sm text-gray-400 mb-1">Presale Contract</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="text-white font-mono text-sm truncate min-w-0 flex-1">
                        {roundAddress}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(roundAddress)}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="Copy address"
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                      <a
                        href={`${explorerBase}/address/${roundAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="View on explorer"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    </div>
                  </div>
                )}
                {round.vesting_vault_address && (
                  <div className="p-4 bg-gray-800 rounded-lg col-span-full">
                    <div className="text-sm text-gray-400 mb-1">Vesting Vault</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="text-white font-mono text-sm truncate min-w-0 flex-1">
                        {round.vesting_vault_address}
                      </code>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(round.vesting_vault_address || '')
                        }
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="Copy address"
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                      <a
                        href={`${explorerBase}/address/${round.vesting_vault_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="View on explorer"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    </div>
                  </div>
                )}
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Network</div>
                  <div className="flex items-center gap-2">
                    <NetworkBadge network={chainKey} chainId={chainId?.toString()} />
                    <span className="text-white font-medium">{networkName}</span>
                  </div>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Total Supply</div>
                  <div className="text-white font-medium">
                    {totalSupply ? parseFloat(totalSupply).toLocaleString() : 'N/A'}
                  </div>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Tokens for Sale</div>
                  <div className="text-white font-medium">{tokensForSale.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Sale Parameters */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">💰 Sale Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Price per Token
                  </div>
                  <div className="text-white font-medium">
                    {price} {nativeCurrency}
                  </div>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Softcap
                  </div>
                  <div className="text-yellow-400 font-medium">
                    {softcap} {nativeCurrency}
                  </div>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Hardcap
                  </div>
                  <div className="text-white font-medium">
                    {hardcap} {nativeCurrency}
                  </div>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Contribution Range
                  </div>
                  <div className="text-white font-medium">
                    {minContrib} – {maxContrib} {nativeCurrency}
                  </div>
                </div>
              </div>
            </div>

            {/* Vesting Schedule */}
            {investorVesting && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">🔒 Investor Vesting</h3>
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <div className="text-sm text-gray-400">TGE Unlock</div>
                      <div className="text-2xl font-bold text-purple-400">
                        {investorVesting.tge_percentage || 0}%
                      </div>
                    </div>
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <div className="text-sm text-gray-400">Cliff</div>
                      <div className="text-2xl font-bold text-white">
                        {investorVesting.cliff_months || 0} months
                      </div>
                    </div>
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <div className="text-sm text-gray-400">Vesting Duration</div>
                      <div className="text-2xl font-bold text-purple-300">
                        {investorVesting.duration_months ||
                          investorVesting.vesting_months ||
                          (investorVesting.schedule?.length
                            ? investorVesting.schedule[investorVesting.schedule.length - 1].month
                            : 0)}{' '}
                        months
                      </div>
                    </div>
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <div className="text-sm text-gray-400">Schedule Steps</div>
                      <div className="text-2xl font-bold text-white">
                        {investorVesting.schedule?.length || 0}
                      </div>
                    </div>
                  </div>
                  {investorVesting.schedule && investorVesting.schedule.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-400 mb-2">Unlock Schedule:</div>
                      {investorVesting.schedule.map((entry: any, i: number) => (
                        <div
                          key={i}
                          className="flex justify-between bg-gray-800/50 rounded px-3 py-2 text-sm"
                        >
                          <span className="text-gray-300">Month {entry.month}</span>
                          <span className="text-purple-400 font-semibold">{entry.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Team Vesting */}
            {teamVesting && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">👥 Team Vesting</h3>
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <div className="text-sm text-gray-400">Team Allocation</div>
                      <div className="text-xl font-bold text-blue-400">
                        {parseFloat(
                          teamVesting.team_allocation || teamVesting.amount || '0'
                        ).toLocaleString()}{' '}
                        tokens
                      </div>
                    </div>
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <div className="text-sm text-gray-400">Vesting Duration</div>
                      <div className="text-xl font-bold text-white">
                        {teamVesting.duration_months ||
                          (teamVesting.schedule?.length
                            ? teamVesting.schedule[teamVesting.schedule.length - 1].month
                            : 0)}{' '}
                        months
                      </div>
                    </div>
                  </div>
                  {teamVesting.schedule && teamVesting.schedule.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-sm text-gray-400 mb-2">Unlock Schedule:</div>
                      {teamVesting.schedule.map((entry: any, i: number) => (
                        <div
                          key={i}
                          className="flex justify-between bg-gray-800/50 rounded px-3 py-2 text-sm"
                        >
                          <span className="text-gray-300">Month {entry.month}</span>
                          <span className="text-blue-400 font-semibold">{entry.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LP Lock */}
            {lpLock && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">🔐 Liquidity Lock</h3>
                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <div className="text-sm text-gray-400">LP Allocation</div>
                      <div className="text-xl font-bold text-green-400">
                        {lpLock.percentage || 0}%
                      </div>
                    </div>
                    <div className="p-3 bg-gray-800 rounded-lg text-center">
                      <div className="text-sm text-gray-400">Lock Duration</div>
                      <div className="text-xl font-bold text-white">
                        {lpLock.duration_months || 12} months
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ CONTRIBUTE TAB ═══════════════════ */}
        {activeTab === 'contribute' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Contribute to Presale</h3>

            {/* Check if presale is upcoming */}
            {timeStatus === 'upcoming' ? (
              <div className="text-center py-12 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-500/30">
                <Clock className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                <p className="text-xl font-semibold text-white mb-2">Presale Has Not Started Yet</p>
                <p className="text-gray-400 mb-4">
                  Contributions will open when the presale goes live
                </p>
                {round.start_at && (
                  <div className="inline-block bg-purple-500/10 border border-purple-500/30 rounded-lg px-6 py-3">
                    <p className="text-sm text-gray-400 mb-1">Starts in:</p>
                    <Countdown targetDate={round.start_at} />
                  </div>
                )}
              </div>
            ) : !roundAddress ? (
              <div className="text-center py-8 text-gray-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <p>Round contract not deployed yet.</p>
                <p className="text-sm">Contribution will be available after deployment.</p>
              </div>
            ) : (
              <ContributionForm
                roundId={round.id}
                roundAddress={roundAddress as `0x${string}`}
                paymentToken={round.raise_asset}
                min={
                  params.min_contribution
                    ? parseEther(params.min_contribution.toString())
                    : undefined
                }
                max={
                  params.max_contribution
                    ? parseEther(params.max_contribution.toString())
                    : undefined
                }
              />
            )}
          </div>
        )}

        {/* ═══════════════════ CLAIM TAB ═══════════════════ */}
        {activeTab === 'claim' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Claim Your Tokens</h3>
            {address && roundAddress ? (
              <VestingClaimer presaleId={round.id} userAddress={address} />
            ) : (
              <div className="text-center py-8 text-gray-400">
                Connect your wallet to claim your allocated tokens.
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ REFUND TAB ═══════════════════ */}
        {activeTab === 'refund' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Claim Refund</h3>
            {roundAddress ? (
              <RefundCard roundAddress={roundAddress} presaleStatus={presaleStatus} />
            ) : (
              <div className="text-center py-8 text-gray-400">
                Round contract not deployed; refunds not available.
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ TRANSACTIONS TAB ═══════════════════ */}
        {activeTab === 'transactions' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">All Transactions</h3>
            {allContributions && allContributions.length > 0 ? (
              <div className="space-y-3">
                {allContributions.map((contrib: any, idx: number) => (
                  <div key={contrib.id || idx} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-white flex items-center gap-2">
                          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                            #{allContributions.length - idx}
                          </span>
                          Contribution
                        </p>
                        <p className="text-xs text-gray-500 mt-1 font-mono">
                          {contrib.wallet_address
                            ? `${contrib.wallet_address.slice(0, 6)}...${contrib.wallet_address.slice(-4)}`
                            : 'Unknown wallet'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1" suppressHydrationWarning>
                          {new Date(contrib.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-white">
                          {contrib.amount} {round.raise_asset || nativeCurrency}
                        </p>
                        <StatusPill status={contrib.status} />
                      </div>
                    </div>
                    {contrib.tx_hash && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <a
                          href={`${explorerBase}/tx/${contrib.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View on Explorer
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No transactions yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
