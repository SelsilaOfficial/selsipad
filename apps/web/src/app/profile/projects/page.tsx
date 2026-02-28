'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Rocket,
  Loader2,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  TrendingUp,
  Package,
  Plus,
  FolderOpen,
  Flame,
  GraduationCap,
} from 'lucide-react';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface Project {
  id: string;
  name: string;
  symbol?: string;
  description?: string;
  logo_url?: string;
  type: 'FAIRLAUNCH' | 'PRESALE' | 'BONDING_CURVE';
  status: string;
  chain_id: number;
  token_address?: string | null;
  contract_address?: string;
  created_at: string;
  launch_rounds?: {
    id: string;
    softcap: string;
    status?: string;
    result?: string;
    start_time: string;
    end_time: string;
    escrow_tx_hash?: string;
    creation_fee_paid?: string;
    deployed_at?: string;
    paused_at?: string;
    pause_reason?: string;
    total_raised?: string;
    contributor_count?: number;
    finalized_at?: string;
  }[];
  bonding_data?: {
    actual_native_reserves?: string;
    graduation_threshold_native?: string;
    target_dex?: string;
    dex_pool_address?: string;
    deployed_at?: string;
    graduated_at?: string;
    failed_at?: string;
  };
}

type FilterType = 'ALL' | 'FAIRLAUNCH' | 'PRESALE' | 'BONDING_CURVE';

/* ------------------------------------------------------------------ */
/* Status helpers                                                      */
/* ------------------------------------------------------------------ */
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  SUBMITTED: {
    label: 'Pending',
    bg: 'bg-amber-500/10 border-amber-500/20',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  IN_REVIEW: {
    label: 'In Review',
    bg: 'bg-sky-500/10 border-sky-500/20',
    text: 'text-sky-400',
    dot: 'bg-sky-400',
  },
  APPROVED: {
    label: 'Approved',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },

  DEPLOYED: {
    label: 'Deployed',
    bg: 'bg-[#39AEC4]/10 border-[#39AEC4]/20',
    text: 'text-[#39AEC4]',
    dot: 'bg-[#39AEC4]',
  },
  UPCOMING: {
    label: 'Upcoming',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
  LIVE: {
    label: 'Live',
    bg: 'bg-purple-500/10 border-purple-500/20',
    text: 'text-purple-400',
    dot: 'bg-purple-400 animate-pulse',
  },
  ACTIVE: {
    label: 'Active',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400 animate-pulse',
  },
  PAUSED: {
    label: 'Paused',
    bg: 'bg-orange-500/10 border-orange-500/20',
    text: 'text-orange-400',
    dot: 'bg-orange-400',
  },
  ENDED: {
    label: 'Ended',
    bg: 'bg-gray-500/10 border-gray-500/20',
    text: 'text-gray-400',
    dot: 'bg-gray-400',
  },
  FINALIZED: {
    label: 'Finalized',
    bg: 'bg-[#39AEC4]/10 border-[#39AEC4]/20',
    text: 'text-[#39AEC4]',
    dot: 'bg-[#39AEC4]',
  },
  SUCCESS: {
    label: 'Success',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  FAILED: {
    label: 'Refund',
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
  GRADUATED: {
    label: 'Graduated',
    bg: 'bg-[#756BBA]/10 border-[#756BBA]/20',
    text: 'text-[#756BBA]',
    dot: 'bg-[#756BBA]',
  },
  BONDING_ACTIVE: {
    label: 'Active',
    bg: 'bg-orange-500/10 border-orange-500/20',
    text: 'text-orange-400',
    dot: 'bg-orange-400 animate-pulse',
  },
};

const DEFAULT_STATUS = {
  label: 'Unknown',
  bg: 'bg-gray-500/10 border-gray-500/20',
  text: 'text-gray-400',
  dot: 'bg-gray-400',
};

function getDynamicStatus(project: Project): string {
  const round = project.launch_rounds?.[0];

  // Check finalization result first (from launch_round status & result)
  if (round?.result === 'SUCCESS' || round?.status === 'SUCCESS') return 'SUCCESS';
  if (round?.result === 'FAILED' || round?.status === 'FAILED') return 'FAILED';
  if (round?.status === 'FINALIZED') {
    if (round.result === 'SUCCESS') return 'SUCCESS';
    if (round.result === 'FAILED') return 'FAILED';
    return 'FINALIZED';
  }

  const isDeployedOrApproved = project.status === 'DEPLOYED' || project.status === 'APPROVED';
  if (!isDeployedOrApproved || !round?.start_time || !round?.end_time) return project.status;

  const now = new Date();
  const start = new Date(round.start_time);
  const end = new Date(round.end_time);

  if (now < start) return 'UPCOMING';
  if (now >= start && now <= end) return project.status === 'ACTIVE' ? 'ACTIVE' : 'LIVE';
  return 'ENDED';
}

/* ------------------------------------------------------------------ */
/* StatusPill                                                          */
/* ------------------------------------------------------------------ */
function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? DEFAULT_STATUS;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* ProjectCard (premium glassmorphism)                                */
/* ------------------------------------------------------------------ */
function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const round = project.launch_rounds?.[0];

  const [dynamicStatus, setDynamicStatus] = useState(getDynamicStatus(project));

  useEffect(() => {
    const interval = setInterval(() => setDynamicStatus(getDynamicStatus(project)), 1000);
    return () => clearInterval(interval);
  }, [project]);

  const isLive = dynamicStatus === 'LIVE' || dynamicStatus === 'ACTIVE';
  const isSuccess = dynamicStatus === 'SUCCESS';
  const isFailed = dynamicStatus === 'FAILED';

  return (
    <div
      onClick={() => router.push(project.type === 'BONDING_CURVE' ? `/bonding/${project.id}` : `/fairlaunch/${project.id}`)}
      className={`group relative rounded-[20px] border backdrop-blur-xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-[#756BBA]/10 ${
        isLive
          ? 'border-purple-500/30 bg-purple-500/5'
          : isSuccess
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : isFailed
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-white/10 bg-white/5 hover:border-[#39AEC4]/30'
      }`}
    >
      {/* Live glow effect */}
      {isLive && (
        <div className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
      )}

      {/* Top: Logo + Name + Status */}
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {project.logo_url ? (
            <img
              src={project.logo_url}
              alt={project.name}
              className="w-11 h-11 rounded-[12px] object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-[12px] bg-gradient-to-br from-[#39AEC4]/20 to-[#756BBA]/20 border border-white/10 flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5 text-[#39AEC4]" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{project.name}</h3>
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">
              {project.type}
            </span>
          </div>
        </div>
        <StatusPill status={dynamicStatus as any} />
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed">
          {project.description}
        </p>
      )}

      {/* Info Grid */}
      <div className="space-y-2">
        {/* Token */}
        {project.token_address && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Token</span>
          <span className="text-[#39AEC4] font-mono text-[11px]">
            {project.token_address.slice(0, 6)}...{project.token_address.slice(-4)}
          </span>
        </div>
        )}

        {/* Chain */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Chain</span>
          <span className="text-gray-300">
            BSC {project.chain_id === 97 ? 'Testnet' : 'Mainnet'}
          </span>
        </div>

        {/* Round-specific data */}
        {round && (
          <>
            {round.total_raised && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Raised</span>
                <span className="text-emerald-400 font-bold">{round.total_raised} BNB</span>
              </div>
            )}
            {round.contributor_count !== undefined && round.contributor_count > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Contributors</span>
                <span className="text-gray-300">{round.contributor_count}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Finalization Result Badge */}
      {(isSuccess || isFailed) && round?.finalized_at && (
        <div className={`flex items-center gap-2 mt-3 pt-3 border-t ${
          isSuccess ? 'border-emerald-500/10' : 'border-red-500/10'
        }`}>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold ${
            isSuccess
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            {isSuccess ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> Softcap Reached — Finalized</>
            ) : (
              <><XCircle className="w-3.5 h-3.5" /> Softcap Not Met — Refund</>
            )}
          </div>
        </div>
      )}

      {/* Checklist row */}
      {round && (round.escrow_tx_hash || round.creation_fee_paid) && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
          {round.escrow_tx_hash && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Escrowed
            </span>
          )}
          {round.creation_fee_paid && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Fee Paid
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <span className="text-[10px] text-gray-600">
          {new Date(project.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#39AEC4] transition-colors" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BondingCurveCard                                                    */
/* ------------------------------------------------------------------ */
function BondingCurveCard({ project }: { project: Project }) {
  const router = useRouter();
  const bd = project.bonding_data;
  const isGraduated = project.status === 'GRADUATED';
  const isBondingActive = !isGraduated && project.status !== 'FAILED';

  // Calculate progress toward graduation
  const reserves = Number(bd?.actual_native_reserves || 0);
  const threshold = Number(bd?.graduation_threshold_native || 1);
  const progressPct = Math.min((reserves / threshold) * 100, 100);

  const displayStatus = isGraduated ? 'GRADUATED' : isBondingActive ? 'BONDING_ACTIVE' : project.status;

  return (
    <div
      onClick={() => router.push(`/bonding/${project.id}`)}
      className={`group relative rounded-[20px] border backdrop-blur-xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-[#756BBA]/10 ${
        isGraduated
          ? 'border-[#756BBA]/30 bg-[#756BBA]/5'
          : isBondingActive
          ? 'border-orange-500/30 bg-orange-500/5'
          : 'border-white/10 bg-white/5 hover:border-[#39AEC4]/30'
      }`}
    >
      {/* Top: Logo + Name + Status */}
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {project.logo_url ? (
            <img
              src={project.logo_url}
              alt={project.name}
              className="w-11 h-11 rounded-[12px] object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-[12px] bg-gradient-to-br from-orange-500/20 to-[#756BBA]/20 border border-white/10 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{project.name}</h3>
            <span className="text-[11px] text-gray-500 uppercase tracking-wider">
              Bonding Curve {project.symbol && `· $${project.symbol}`}
            </span>
          </div>
        </div>
        <StatusPill status={displayStatus} />
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed">
          {project.description}
        </p>
      )}

      {/* Info Grid */}
      <div className="space-y-2">
        {/* Token */}
        {project.token_address && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Token</span>
            <span className="text-[#39AEC4] font-mono text-[11px]">
              {project.token_address.slice(0, 6)}...{project.token_address.slice(-4)}
            </span>
          </div>
        )}

        {/* Chain */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Chain</span>
          <span className="text-gray-300">
            BSC {project.chain_id === 97 ? 'Testnet' : 'Mainnet'}
          </span>
        </div>

        {/* Reserves */}
        {reserves > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Reserves</span>
            <span className="text-emerald-400 font-bold">{reserves.toFixed(4)} BNB</span>
          </div>
        )}

        {/* DEX */}
        {bd?.target_dex && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Target DEX</span>
            <span className="text-gray-300">{bd.target_dex}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {!isGraduated && threshold > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-gray-500">Graduation Progress</span>
            <span className="text-orange-400 font-bold">{progressPct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-[#756BBA] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Graduated Badge */}
      {isGraduated && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#756BBA]/10">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold bg-[#756BBA]/10 text-[#756BBA]">
            <GraduationCap className="w-3.5 h-3.5" /> Migrated to DEX
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <span className="text-[10px] text-gray-600">
          {new Date(project.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#39AEC4] transition-colors" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty State                                                         */
/* ------------------------------------------------------------------ */
function EmptyState() {
  const router = useRouter();
  return (
    <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] backdrop-blur-xl p-10 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#39AEC4]/10 to-[#756BBA]/10 border border-white/10 flex items-center justify-center mb-5">
        <FolderOpen className="w-7 h-7 text-gray-500" />
      </div>
      <h3 className="text-base font-bold text-gray-300 mb-1">No Projects Yet</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
        Launch your first Fairlaunch or Presale and track it here.
      </p>
      <button
        onClick={() => router.push('/create/fairlaunch')}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#8B7FD8] text-white font-bold text-sm transition-all shadow-lg shadow-[#756BBA]/20"
      >
        <Plus className="w-4 h-4" />
        Create Fairlaunch
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Summary Stats                                                       */
/* ------------------------------------------------------------------ */
function SummaryStats({ projects }: { projects: Project[] }) {
  const total = projects.length;
  const pending = projects.filter(
    (p) => p.status === 'SUBMITTED' || p.status === 'IN_REVIEW'
  ).length;
  const live = projects.filter((p) => {
    const s = getDynamicStatus(p);
    return s === 'LIVE' || s === 'ACTIVE';
  }).length;
  const bonding = projects.filter((p) => p.type === 'BONDING_CURVE').length;
  const success = projects.filter((p) => getDynamicStatus(p) === 'SUCCESS').length;
  const refund = projects.filter((p) => getDynamicStatus(p) === 'FAILED').length;

  const stats = [
    { label: 'Total', value: total, color: 'text-white' },
    { label: 'Pending', value: pending, color: 'text-amber-400' },
    { label: 'Live', value: live, color: 'text-purple-400' },
    { label: 'Bonding', value: bonding, color: 'text-orange-400' },
    { label: 'Success', value: success, color: 'text-emerald-400' },
    { label: 'Refund', value: refund, color: 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-[14px] border border-white/5 bg-white/[0.03] backdrop-blur-xl p-3 text-center"
        >
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{s.label}</p>
          <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page                                                           */
/* ------------------------------------------------------------------ */
export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('ALL');

  useEffect(() => {
    fetchProjects();
  }, [filter]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const url = filter === 'ALL' ? '/api/user/projects' : `/api/user/projects?type=${filter}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch projects');
      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((p) => filter === 'ALL' || p.type === filter);
  const filters: { key: FilterType; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'FAIRLAUNCH', label: 'Fairlaunch' },
    { key: 'PRESALE', label: 'Presale' },
    { key: 'BONDING_CURVE', label: 'Bonding Curve' },
  ];

  return (
    <div className="relative min-h-screen bg-[#050510] text-white pb-24">
      <AnimatedBackground />

      <div className="relative z-10">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 max-w-3xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/profile')}
                className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold leading-tight">My Projects</h1>
                <p className="text-xs text-gray-500">
                  Track your Fairlaunch, Presale &amp; Bonding Curve projects
                </p>
              </div>
              {!loading && projects.length > 0 && (
                <span className="text-xs text-gray-500 bg-white/5 rounded-full px-2.5 py-1 font-bold">
                  {projects.length}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="container mx-auto px-4 sm:px-6 pt-5 max-w-3xl space-y-5">
          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                  filter === f.key
                    ? 'bg-gradient-to-r from-[#39AEC4]/20 to-[#756BBA]/20 border-[#39AEC4]/30 text-[#39AEC4]'
                    : 'border-white/5 bg-white/[0.02] text-gray-500 hover:text-gray-300 hover:border-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#39AEC4] animate-spin" />
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-[20px] border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-6 text-center">
              <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-sm text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchProjects}
                className="px-5 py-2 rounded-[12px] bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-colors border border-red-500/20"
              >
                Retry
              </button>
            </div>
          )}

          {/* Projects */}
          {!loading && !error && (
            <>
              {filteredProjects.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProjects.map((project) => (
                    project.type === 'BONDING_CURVE'
                      ? <BondingCurveCard key={project.id} project={project} />
                      : <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}

              {/* Summary */}
              {projects.length > 0 && <SummaryStats projects={projects} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
