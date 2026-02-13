'use client';

import { useState } from 'react';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';
import {
  ArrowLeft,
  Briefcase,
  Clock,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  Timer,
  CircleDot,
  Coins,
  TrendingUp,
  BarChart3,
  Rocket,
  Copy,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistance } from 'date-fns';
import type {
  PortfolioData,
  InvestedProject,
  ClaimScheduleItem,
  TransactionItem,
} from '@/actions/portfolio/get-portfolio-data';

interface PortfolioClientContentProps {
  data: PortfolioData;
}

type TabId = 'projects' | 'claims' | 'history';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'projects', label: 'My Projects', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'claims', label: 'Claim Schedule', icon: <Clock className="w-4 h-4" /> },
  { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
];

export function PortfolioClientContent({ data }: PortfolioClientContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>('projects');
  const { investedProjects, claimSchedule, transactions, stats } = data;

  return (
    <div className="min-h-screen bg-black text-white dark relative overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground />
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 max-w-4xl">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors">
                <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">Portfolio</h1>
                <p className="text-xs text-gray-400">Track your investments & claims</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 max-w-4xl space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Coins className="w-4 h-4 text-[#39AEC4]" />}
              label="Total Invested"
              value={stats.totalInvested > 0 ? `${stats.totalInvested.toFixed(4)}` : '0'}
              sub="BNB"
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4 text-green-400" />}
              label="Claimable"
              value={stats.totalClaimable > 0 ? stats.totalClaimable.toLocaleString() : '0'}
              sub="tokens"
              highlight
            />
            <StatCard
              icon={<Briefcase className="w-4 h-4 text-[#756BBA]" />}
              label="Projects"
              value={stats.projectCount.toString()}
              sub="invested"
            />
            <StatCard
              icon={<BarChart3 className="w-4 h-4 text-gray-400" />}
              label="Transactions"
              value={stats.transactionCount.toString()}
              sub="total"
            />
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 rounded-[16px] bg-white/5 backdrop-blur-sm border border-white/10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-[12px] text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white shadow-lg shadow-[#756BBA]/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'projects' && <ProjectsTab projects={investedProjects} />}
          {activeTab === 'claims' && <ClaimsTab claims={claimSchedule} />}
          {activeTab === 'history' && <HistoryTab transactions={transactions} />}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[16px] backdrop-blur-xl p-4 ${
        highlight
          ? 'bg-gradient-to-br from-[#39AEC4]/15 to-[#756BBA]/10 border border-[#39AEC4]/30'
          : 'bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl sm:text-2xl font-bold ${highlight ? 'text-[#39AEC4]' : 'text-white'}`}>
        {value}
      </p>
      <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Projects Tab                                                       */
/* ------------------------------------------------------------------ */

function ProjectsTab({ projects }: { projects: InvestedProject[] }) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="w-8 h-8 text-[#39AEC4]" />}
        title="No Investments Yet"
        description="Start investing in projects to track them here"
        actionLabel="Explore Projects"
        actionHref="/explore"
      />
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <Link
          key={project.projectId}
          href={`/project/${project.projectId}`}
          className="block rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 hover:border-[#39AEC4]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#39AEC4]/5 overflow-hidden group"
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              {/* Project Avatar */}
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#39AEC4]/20 to-[#756BBA]/20 border border-[#39AEC4]/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {project.logoUrl ? (
                  <img
                    src={project.logoUrl}
                    alt={project.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <Rocket className="w-5 h-5 text-[#39AEC4]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    {project.name}
                  </h3>
                  <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-[#39AEC4] transition-colors flex-shrink-0" />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#39AEC4]/15 text-[#39AEC4] border border-[#39AEC4]/30">
                    ${project.symbol}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-gray-300 border border-white/5">
                    {project.chain}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#756BBA]/15 text-[#756BBA] border border-[#756BBA]/30 capitalize">
                    {project.status}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Total Invested</p>
                    <p className="text-sm font-bold text-white">
                      {project.totalContributed.toFixed(4)}{' '}
                      <span className="text-gray-400 font-normal">{project.currency}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Contributions</p>
                    <p className="text-sm font-bold text-white">{project.contributionCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Claims Tab                                                         */
/* ------------------------------------------------------------------ */

function ClaimsTab({ claims }: { claims: ClaimScheduleItem[] }) {
  if (claims.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="w-8 h-8 text-[#39AEC4]" />}
        title="No Claim Schedule"
        description="Token allocations from your investments will appear here"
        actionLabel="Explore Projects"
        actionHref="/explore"
      />
    );
  }

  const ready = claims.filter((c) => c.status === 'ready');
  const upcoming = claims.filter((c) => c.status === 'upcoming');
  const completed = claims.filter((c) => c.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Ready to Claim */}
      {ready.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider">
              Ready to Claim ({ready.length})
            </h3>
          </div>
          <div className="space-y-3">
            {ready.map((claim) => (
              <ClaimCard key={claim.allocationId} claim={claim} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">
              Upcoming ({upcoming.length})
            </h3>
          </div>
          <div className="space-y-3">
            {upcoming.map((claim) => (
              <ClaimCard key={claim.allocationId} claim={claim} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Completed ({completed.length})
            </h3>
          </div>
          <div className="space-y-3">
            {completed.map((claim) => (
              <ClaimCard key={claim.allocationId} claim={claim} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ClaimCard({ claim }: { claim: ClaimScheduleItem }) {
  const progress = claim.vestingTotal > 0 ? (claim.tokensClaimed / claim.vestingTotal) * 100 : 0;

  const statusConfig = {
    ready: {
      border: 'border-green-500/30',
      glow: 'shadow-green-500/5',
      badgeBg: 'bg-green-500/15',
      badgeText: 'text-green-400',
      badgeBorder: 'border-green-500/30',
      label: '🟢 Ready',
    },
    upcoming: {
      border: 'border-yellow-500/20',
      glow: '',
      badgeBg: 'bg-yellow-500/15',
      badgeText: 'text-yellow-400',
      badgeBorder: 'border-yellow-500/30',
      label: '🟡 Upcoming',
    },
    completed: {
      border: 'border-white/5',
      glow: '',
      badgeBg: 'bg-gray-500/15',
      badgeText: 'text-gray-400',
      badgeBorder: 'border-gray-500/30',
      label: '✅ Completed',
    },
  };

  const config = statusConfig[claim.status];

  return (
    <div
      className={`rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border ${config.border} overflow-hidden ${config.glow ? `shadow-lg ${config.glow}` : ''}`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-white">{claim.projectName}</h4>
            <span className="text-xs text-gray-400">{claim.projectSymbol}</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.badgeBg} ${config.badgeText} border ${config.badgeBorder}`}
          >
            {config.label}
          </span>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Allocated</p>
            <p className="text-sm font-bold">{claim.tokensAllocated.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Claimed</p>
            <p className="text-sm font-bold text-gray-300">
              {claim.tokensClaimed.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Claimable</p>
            <p
              className={`text-sm font-bold ${claim.tokensClaimable > 0 ? 'text-[#39AEC4]' : 'text-gray-500'}`}
            >
              {claim.tokensClaimable.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Vesting Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500">Vesting Progress</span>
            <span className="text-[10px] text-gray-400">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] transition-all duration-500"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>

        {/* Claim Button */}
        {claim.status === 'ready' && claim.tokensClaimable > 0 && (
          <button className="w-full py-2.5 rounded-[12px] bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/30 font-semibold text-sm">
            Claim {claim.tokensClaimable.toLocaleString()} {claim.projectSymbol}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  History Tab                                                        */
/* ------------------------------------------------------------------ */

function HistoryTab({ transactions }: { transactions: TransactionItem[] }) {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyTxHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<History className="w-8 h-8 text-[#39AEC4]" />}
        title="No Transactions Yet"
        description="Your transaction history will appear here"
      />
    );
  }

  const typeConfig = {
    contribution: {
      icon: <ArrowUpRight className="w-4 h-4" />,
      color: 'text-[#39AEC4]',
      bg: 'bg-[#39AEC4]/10',
      label: 'Contribution',
    },
    claim: {
      icon: <ArrowDownLeft className="w-4 h-4" />,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      label: 'Claim',
    },
    refund: {
      icon: <RotateCcw className="w-4 h-4" />,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      label: 'Refund',
    },
  };

  const statusConfig = {
    pending: {
      bg: 'bg-yellow-500/15',
      text: 'text-yellow-400',
      border: 'border-yellow-500/30',
      label: 'Pending',
    },
    success: {
      bg: 'bg-green-500/15',
      text: 'text-green-400',
      border: 'border-green-500/30',
      label: 'Success',
    },
    failed: {
      bg: 'bg-red-500/15',
      text: 'text-red-400',
      border: 'border-red-500/30',
      label: 'Failed',
    },
    finalizing: {
      bg: 'bg-blue-500/15',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      label: 'Finalizing',
    },
  };

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const type = typeConfig[tx.type];
        const status = statusConfig[tx.status];

        return (
          <div
            key={tx.id}
            className="rounded-[16px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 p-4 hover:border-white/20 transition-all"
          >
            <div className="flex items-start gap-3">
              {/* Type Icon */}
              <div
                className={`w-9 h-9 rounded-full ${type.bg} ${type.color} flex items-center justify-center flex-shrink-0`}
              >
                {type.icon}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h4 className="text-sm font-semibold text-white truncate">{tx.projectName}</h4>
                    <p className="text-[10px] text-gray-500">{type.label}</p>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.bg} ${status.text} border ${status.border}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-bold text-white">
                    {tx.type === 'claim' ? '+' : tx.type === 'refund' ? '+' : '-'}
                    {tx.amount}{' '}
                    <span className="text-gray-400 font-normal text-xs">{tx.currency}</span>
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {formatDistance(new Date(tx.createdAt), new Date(), { addSuffix: true })}
                  </p>
                </div>

                {/* Tx Hash */}
                {tx.txHash && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <p className="text-[10px] text-gray-600 font-mono truncate max-w-[180px]">
                      {tx.txHash}
                    </p>
                    <button
                      onClick={() => copyTxHash(tx.txHash!)}
                      className="p-0.5 rounded hover:bg-white/10 transition-colors"
                    >
                      {copiedHash === tx.txHash ? (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-600" />
                      )}
                    </button>
                    <a
                      href={`https://testnet.bscscan.com/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-0.5 rounded hover:bg-white/10 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 text-gray-600 hover:text-[#39AEC4]" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#39AEC4]/20 to-[#756BBA]/20 border border-[#39AEC4]/30 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm mb-6">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/30 font-semibold text-sm"
        >
          <Rocket className="w-4 h-4" />
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
