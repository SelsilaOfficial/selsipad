import { notFound } from 'next/navigation';
import { Card, CardContent, StatusBadge, ProgressBar, Tabs } from '@/components/ui';
import { PageHeader, PageContainer } from '@/components/layout';
import { getProjectById } from '@/lib/data/projects';
import { ProjectInteractionCard } from '@/components/features/ProjectInteractionCard';
import TransactionsTable from '@/components/features/TransactionsTable';
import TokenomicsSection from '@/components/features/TokenomicsSection';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';
import {
  ShieldCheck,
  Globe,
  Twitter,
  Send,
  Disc,
  ExternalLink,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await getProjectById(params.id);

  if (!project) {
    notFound();
  }

  const isLive = project.status === 'live';
  const isEnded = project.status === 'ended';
  const metadata = (project as any).metadata || {};

  // Status Colors for Detail Page
  const accentColor = isLive ? '#39AEC4' : '#756BBA';
  const statusBg = isLive
    ? 'bg-[#39AEC4]/20 text-[#39AEC4] border-[#39AEC4]/30'
    : 'bg-[#756BBA]/20 text-[#756BBA] border-[#756BBA]/30';

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden pb-20 relative font-sans selection:bg-[#39AEC4]/30">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AnimatedBackground />
      </div>

      {/* Header Navigation */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PageHeader showBack title="" className="!bg-transparent border-none !px-0 [&>div]:!px-0" />
      </div>

      {/* Content Container */}
      <PageContainer className="relative z-10 py-0 space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="relative rounded-[32px] overflow-hidden border border-white/10 bg-[#0A0A0C]/60 backdrop-blur-2xl shadow-2xl">
          {/* Banner */}
          <div className="h-64 sm:h-80 w-full relative">
            <img
              src={project.banner || '/placeholder-banner.jpg'}
              alt={project.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/50 to-transparent" />
          </div>

          {/* Project Header Content */}
          <div className="px-6 pb-8 -mt-20 sm:-mt-24 relative flex flex-col md:flex-row items-start md:items-end gap-6">
            {/* Logo */}
            <div className="relative group">
              <div
                className={`absolute -inset-0.5 rounded-[24px] blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt ${isLive ? 'bg-cyan-500' : 'bg-purple-600'}`}
              ></div>
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-[22px] overflow-hidden border-4 border-[#0A0A0C] bg-[#0A0A0C] shadow-2xl">
                <img
                  src={project.logo || '/placeholder-icon.png'}
                  alt={project.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Title and Badges */}
            <div className="flex-1 mb-2">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md flex items-center gap-1.5 ${statusBg}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#39AEC4] animate-pulse' : 'bg-[#756BBA]'}`}
                  />
                  {project.status === 'live' ? 'Live Now' : project.status}
                </div>
                <div className="px-3 py-1 rounded-full bg-black/40 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-1">
                  {project.network === 'EVM' ? (
                    <Zap size={12} className="text-[#39AEC4]" fill="currentColor" />
                  ) : (
                    'SOL'
                  )}
                  {project.network} {project.currency}
                </div>
                <div className="px-3 py-1 rounded-full bg-black/40 border border-white/10 text-xs font-bold text-gray-300 uppercase">
                  {(project as any).type}
                </div>
                {project.kyc_verified && (
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck size={12} /> SAFU
                  </div>
                )}
                {project.audit_status === 'pass' && (
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck size={12} /> AUDIT
                  </div>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-2">
                {project.name}{' '}
                <span className="text-2xl text-gray-500 font-medium align-middle ml-2">
                  ${project.symbol}
                </span>
              </h1>

              <p className="text-gray-400 max-w-2xl text-sm sm:text-base line-clamp-2">
                {project.description}
              </p>
            </div>

            {/* Social Links */}
            <div className="flex gap-3 mb-3">
              {metadata.website && (
                <Link
                  href={metadata.website}
                  target="_blank"
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#39AEC4]/50 hover:text-[#39AEC4] transition-all group"
                >
                  <Globe size={20} />
                </Link>
              )}
              {metadata.twitter && (
                <Link
                  href={metadata.twitter}
                  target="_blank"
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#39AEC4]/50 hover:text-[#39AEC4] transition-all group"
                >
                  <Twitter size={20} />
                </Link>
              )}
              {metadata.telegram && (
                <Link
                  href={metadata.telegram}
                  target="_blank"
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#39AEC4]/50 hover:text-[#39AEC4] transition-all group"
                >
                  <Send size={20} />
                </Link>
              )}
              {metadata.discord && (
                <Link
                  href={metadata.discord}
                  target="_blank"
                  className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#39AEC4]/50 hover:text-[#39AEC4] transition-all group"
                >
                  <Disc size={20} />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Details & Tabs (Span 2) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Progress Card (Mobile/Tablet prominent, or keep generic) */}
            <div className="rounded-3xl p-6 md:p-8 bg-[#0A0A0C]/60 backdrop-blur-xl border border-white/10">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-sm text-gray-400 uppercase tracking-wider font-semibold mb-1">
                    Total Raised
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                      {project.raised.toLocaleString()}{' '}
                      <span className="text-lg text-gray-500">{project.currency}</span>
                    </span>
                    <span className="text-sm text-gray-400">
                      / {project.target.toLocaleString()} {project.currency}
                      {project.type === 'fairlaunch' && ' (Soft Cap)'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400 font-medium mb-1">Progress</p>
                  <p
                    className={`text-2xl font-bold ${isLive || (isEnded && project.raised >= (project.type === 'fairlaunch' ? project.target : project.target * 0.5)) ? 'text-[#39AEC4]' : 'text-gray-200'}`}
                  >
                    {project.type === 'fairlaunch'
                      ? `${Math.round((project.raised / project.target) * 100)}%`
                      : `${Math.min(100, Math.round((project.raised / project.target) * 100))}%`}
                  </p>
                </div>
              </div>

              <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full relative overflow-hidden transition-all duration-1000 ${isLive || (isEnded && project.raised >= (project.type === 'fairlaunch' ? project.target : project.target * 0.5)) ? 'bg-gradient-to-r from-[#39AEC4] to-[#756BBA]' : 'bg-gray-600'}`}
                  style={{ width: `${Math.min(100, (project.raised / project.target) * 100)}%` }}
                >
                  <div
                    className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)',
                      transform: 'skewX(-20deg)',
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Custom Tabs Implementation */}
            <div className="min-h-[400px]">
              <Tabs
                defaultTab="overview"
                className="w-full"
                tabs={[
                  {
                    id: 'overview',
                    label: 'Overview',
                    content: (
                      <div className="space-y-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {[
                            {
                              label: 'Start Time',
                              value: project.startDate
                                ? new Date(project.startDate).toLocaleDateString()
                                : 'TBA',
                            },
                            {
                              label: 'End Time',
                              value: project.endDate
                                ? new Date(project.endDate).toLocaleDateString()
                                : 'TBA',
                            },
                            {
                              label: 'Soft Cap',
                              value:
                                project.type === 'fairlaunch'
                                  ? `${project.target.toLocaleString()} ${project.currency}`
                                  : `${(project.target * 0.5).toLocaleString()} ${project.currency}`,
                            },
                            ...(project.type !== 'fairlaunch'
                              ? [
                                  {
                                    label: 'Hard Cap',
                                    value: `${project.target.toLocaleString()} ${project.currency}`,
                                  },
                                ]
                              : []),
                          ].map((item, i) => (
                            <div
                              key={i}
                              className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center hover:bg-white/10 transition-colors"
                            >
                              <p className="text-xs text-gray-400 uppercase mb-1">{item.label}</p>
                              <p className="text-sm font-bold text-white">{item.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Contract Addresses - Transparency Section */}
                        {(project.token_address ||
                          project.contract_address ||
                          project.vesting_address) && (
                          <div className="rounded-3xl p-6 bg-[#0A0A0C]/40 border border-white/5">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                              <div className="w-1 h-6 bg-green-500 rounded-full"></div>
                              Smart Contracts
                              <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 ml-2">
                                Transparent
                              </span>
                            </h3>
                            <div className="space-y-3">
                              {[
                                {
                                  label: 'Token Address',
                                  address: project.token_address,
                                  icon: '🪙',
                                },
                                {
                                  label: 'Sale Contract',
                                  address: project.contract_address,
                                  icon: '📄',
                                },
                                {
                                  label: 'Vesting Contract',
                                  address: project.vesting_address,
                                  icon: '🔒',
                                },
                              ]
                                .filter((item) => item.address)
                                .map((item, i) => {
                                  const explorerUrl =
                                    project.chain === '97'
                                      ? `https://testnet.bscscan.com/address/${item.address}`
                                      : project.chain === '56'
                                        ? `https://bscscan.com/address/${item.address}`
                                        : project.chain === '1'
                                          ? `https://etherscan.io/address/${item.address}`
                                          : `https://testnet.bscscan.com/address/${item.address}`;

                                  return (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors group"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="text-lg">{item.icon}</span>
                                        <div>
                                          <p className="text-xs text-gray-500 uppercase tracking-wide">
                                            {item.label}
                                          </p>
                                          <p className="text-sm font-mono text-gray-300">
                                            {item.address!.slice(0, 6)}...{item.address!.slice(-4)}
                                          </p>
                                        </div>
                                      </div>
                                      <a
                                        href={explorerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors opacity-60 group-hover:opacity-100"
                                      >
                                        View
                                        <svg
                                          width="12"
                                          height="12"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                          <polyline points="15 3 21 3 21 9" />
                                          <line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                      </a>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        <div className="rounded-3xl p-6 bg-[#0A0A0C]/40 border border-white/5">
                          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <div className="w-1 h-6 bg-[#39AEC4] rounded-full"></div>
                            Project Story
                          </h3>
                          <div
                            className="prose prose-invert max-w-none text-gray-300 leading-relaxed text-sm md:text-base"
                            style={{
                              fontFamily:
                                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                            }}
                          >
                            {project.description}
                            <p className="mt-4">
                              (Extended description placeholder if needed. This area would contain
                              rich text content about the project's roadmap, team, and utility.)
                            </p>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'tokenomics',
                    label: 'Tokenomics',
                    content: (
                      <div className="mt-6">
                        <TokenomicsSection
                          tokenomics={project.tokenomics}
                          symbol={project.symbol}
                          currency={project.currency}
                        />
                      </div>
                    ),
                  },
                  {
                    id: 'transactions',
                    label: 'Transactions',
                    content: (
                      <div className="mt-6 rounded-3xl overflow-hidden border border-white/10 bg-[#0A0A0C]/40">
                        <TransactionsTable project={project} />
                      </div>
                    ),
                  },
                  {
                    id: 'safety',
                    label: 'Safety',
                    content: (
                      <div className="grid gap-4 mt-6">
                        <div
                          className={`p-5 rounded-2xl border ${project.kyc_verified ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-full ${project.kyc_verified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}
                            >
                              <ShieldCheck size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-white">KYC Verification</h4>
                              <p className="text-sm text-gray-400">
                                {project.kyc_verified
                                  ? 'The team has been verified.'
                                  : 'KYC verification pending.'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div
                          className={`p-5 rounded-2xl border ${project.audit_status === 'pass' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-full ${project.audit_status === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}
                            >
                              <CheckCircle2 size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-white">Audit Status</h4>
                              <p className="text-sm text-gray-400">
                                {project.audit_status === 'pass'
                                  ? 'Contract audit passed.'
                                  : 'Audit pending or not submitted.'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div
                          className={`p-5 rounded-2xl border ${project.lp_lock ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-full ${project.lp_lock ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}
                            >
                              <Zap size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-white">Liquidity Lock</h4>
                              <p className="text-sm text-gray-400">
                                {project.lp_lock
                                  ? 'Liquidity is locked automatically.'
                                  : 'No automatic liquidity lock.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>

          {/* Right Column: Interaction (Span 1) */}
          <div className="space-y-6">
            {/* Participation Form Container */}
            <div className="sticky top-24">
              <div className="rounded-3xl p-1 bg-gradient-to-b from-white/10 to-transparent">
                <div className="bg-[#0A0A0C]/90 backdrop-blur-xl rounded-[20px] p-6 border border-white/5 shadow-2xl">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-white">Participate</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#39AEC4]/20 text-[#39AEC4] border border-[#39AEC4]/30">
                      {isLive ? 'OPEN' : 'CLOSED'}
                    </span>
                  </div>

                  {/* Render Interaction Card */}
                  <ProjectInteractionCard project={project} />

                  <div className="mt-6 pt-6 border-t border-white/10 text-center">
                    <p className="text-xs text-gray-500">
                      By participating, you agree to our Terms & Conditions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
