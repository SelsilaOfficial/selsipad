'use client';

import Link from 'next/link';
import {
  Rocket,
  Coins,
  Users,
  ShieldCheck,
  Clock,
  ArrowRight,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { LiveClock } from '@/components/admin/LiveClock';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-gray-400 mt-1">System overview and operational status.</p>
        </div>
        <div className="flex items-center gap-4">
          <LiveClock />
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
            <span className="text-sm font-medium text-green-400">Systems Operational</span>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Active Fairlaunches"
          value="12"
          trend="+2 this week"
          icon={Rocket}
          color="blue"
        />
        <StatsCard
          title="Pending KYC"
          value="5"
          trend="Action Required"
          icon={Users}
          color="yellow"
        />
        <StatsCard
          title="Total Raised"
          value="1,240 BNB"
          trend="+15% vs last month"
          icon={Coins}
          color="green"
        />
        <StatsCard
          title="Security Alerts"
          value="0"
          trend="All clear"
          icon={ShieldCheck}
          color="purple"
        />
      </div>

      {/* Main Action Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Operational (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Activity / Action Items */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Activity size={20} className="text-blue-400" />
                Recent Activity
              </h2>
              <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                View Log
              </button>
            </div>

            <div className="space-y-4">
              <ActivityItem
                title="New Fairlaunch Submitted"
                subtitle="Project 'MoonWalker' waiting for review"
                time="2 hours ago"
                type="info"
              />
              <ActivityItem
                title="KYC Submission"
                subtitle="Developer 'AlexDev' submitted documents"
                time="5 hours ago"
                type="warning"
              />
              <ActivityItem
                title="Contract Deployed"
                subtitle="Fairlaunch Factory v1.2 deployed to BSC Testnet"
                time="1 day ago"
                type="success"
              />
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ActionCard
              title="Review Submissions"
              description="3 new projects waiting"
              href="/admin/fairlaunch"
              icon={Rocket}
            />
            <ActionCard
              title="Verify KYC"
              description="5 generated requests"
              href="/admin/kyc"
              icon={Users}
            />
          </div>
        </div>

        {/* Right Column - System Status (1/3 width) */}
        <div className="space-y-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4">System Health</h2>
            <div className="space-y-4">
              <StatusItem label="BSC Testnet RPC" status="operational" ping="45ms" />
              <StatusItem label="IPFS Gateway" status="operational" ping="120ms" />
              <StatusItem label="Indexer Service" status="operational" ping="Synced" />
              <StatusItem label="Verification Bot" status="active" ping="Idle" />
            </div>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-yellow-500 mb-2 flex items-center gap-2">
              <AlertTriangle size={18} />
              Pending Actions
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              There are 5 KYC requests that have been pending for more than 24 hours.
            </p>
            <Link
              href="/admin/kyc"
              className="text-sm font-medium text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
            >
              Go to KYC Review <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  trend,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  trend: string;
  icon: any;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors backdrop-blur-sm group">
      <div className="flex justify-between items-start mb-4">
        <div className={cn('p-2 rounded-lg border', colors[color])}>
          <Icon size={20} />
        </div>
        <span className="text-xs font-medium text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
          Today
        </span>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-1">{title}</h3>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        <p className="text-xs text-gray-500">{trend}</p>
      </div>
    </div>
  );
}

function ActionCard({ title, description, href, icon: Icon }: any) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-800 rounded-xl hover:bg-gray-800 hover:border-gray-700 transition-all group"
    >
      <div className="p-3 bg-gray-800 rounded-lg group-hover:bg-gray-700 transition-colors">
        <Icon size={24} className="text-gray-400 group-hover:text-white" />
      </div>
      <div>
        <h3 className="text-white font-medium group-hover:text-green-400 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <ArrowRight
        size={16}
        className="ml-auto text-gray-600 group-hover:text-green-400 transition-colors"
      />
    </Link>
  );
}

function ActivityItem({
  title,
  subtitle,
  time,
  type,
}: {
  title: string;
  subtitle: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
}) {
  const types = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-start gap-4 p-3 hover:bg-gray-800/50 rounded-lg transition-colors">
      <div className={cn('mt-1.5 w-2 h-2 rounded-full ring-4 ring-gray-900/50', types[type])} />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white">{title}</h4>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
        <Clock size={10} /> {time}
      </span>
    </div>
  );
}

function StatusItem({ label, status, ping }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-gray-600">{ping}</span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-xs font-medium text-green-500">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {status}
        </div>
      </div>
    </div>
  );
}

// Utility for merging classes (local version if standard cn is not available)
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
