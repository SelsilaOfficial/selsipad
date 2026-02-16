'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Edit, Trash2, Send, Rocket, BarChart3, AlertCircle } from 'lucide-react';
import { NetworkBadge } from '@/components/presale/NetworkBadge';
import { StatusPill } from '@/components/presale/StatusPill';
import { deletePresaleDraft } from '../../../create/presale/actions';

interface Presale {
  id: string;
  status: string;
  network: string;
  params: any;
  created_at: string;
  start_at: string;
  end_at: string;
  total_raised: number;
  total_participants: number;
}

interface OwnerPresalesDashboardProps {
  presales: Presale[];
  walletAddress: string;
}

type Tab = 'ALL' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LIVE' | 'ENDED';

export function OwnerPresalesDashboard({ presales, walletAddress }: OwnerPresalesDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showCreatedToast = searchParams?.get('created') === 'true';

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: presales.length },
    { key: 'DRAFT', label: 'Drafts', count: presales.filter((p) => p.status === 'DRAFT').length },
    {
      key: 'SUBMITTED',
      label: 'In Review',
      count: presales.filter((p) => p.status === 'SUBMITTED').length,
    },
    {
      key: 'APPROVED',
      label: 'Approved',
      count: presales.filter((p) => p.status === 'APPROVED').length,
    },
    {
      key: 'LIVE',
      label: 'Live',
      count: presales.filter((p) => ['LIVE', 'UPCOMING'].includes(p.status)).length,
    },
    {
      key: 'ENDED',
      label: 'Ended',
      count: presales.filter((p) => ['ENDED', 'SUCCESS', 'FAILED'].includes(p.status)).length,
    },
  ];

  const filteredPresales =
    activeTab === 'ALL'
      ? presales
      : activeTab === 'SUBMITTED'
        ? presales.filter((p) => p.status === 'SUBMITTED')
        : activeTab === 'APPROVED'
          ? presales.filter((p) => p.status === 'APPROVED')
          : activeTab === 'LIVE'
            ? presales.filter((p) => ['LIVE', 'UPCOMING'].includes(p.status))
            : activeTab === 'ENDED'
              ? presales.filter((p) => ['ENDED', 'SUCCESS', 'FAILED'].includes(p.status))
              : presales.filter((p) => p.status === activeTab);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
      return;
    }

    setDeletingId(id);
    const result = await deletePresaleDraft(id);

    if (result.success) {
      router.refresh();
    } else {
      alert('Failed to delete: ' + result.error);
    }
    setDeletingId(null);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Presales</h1>
          <p className="text-gray-400">Manage and monitor your token presales</p>
        </div>
        <Link
          href="/create/presale"
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Presale
        </Link>
      </div>

      {/* Success Toast */}
      {showCreatedToast && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-300">
            <strong className="text-green-200">Presale submitted successfully!</strong>
            <p className="mt-1">
              Your presale has been submitted for admin review. You'll be notified once it's been
              reviewed.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-800">
        <div className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-1 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Presales List */}
      {filteredPresales.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-block p-6 bg-gray-800/30 rounded-full mb-4">
            <Rocket className="w-12 h-12 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {activeTab === 'ALL'
              ? 'No presales yet'
              : `No presales in ${tabs.find((t) => t.key === activeTab)?.label}`}
          </h3>
          <p className="text-gray-400 mb-6">
            {activeTab === 'ALL'
              ? 'Get started by creating your first presale'
              : 'Presales matching this filter will appear here'}
          </p>
          {activeTab === 'ALL' && (
            <Link
              href="/create/presale"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Your First Presale
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPresales.map((presale) => (
            <PresaleCard
              key={presale.id}
              presale={presale}
              onDelete={handleDelete}
              isDeleting={deletingId === presale.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PresaleCard({
  presale,
  onDelete,
  isDeleting,
}: {
  presale: Presale;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const router = useRouter();
  const projectName = presale.params?.project_name || 'Untitled Project';
  const hardcap = presale.params?.hardcap || 0;

  const getActions = () => {
    const actions = [];

    if (presale.status === 'DRAFT') {
      actions.push(
        <button
          key="edit"
          onClick={() => router.push(`/create/presale?edit=${presale.id}`)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Edit className="w-4 h-4" />
          Edit
        </button>
      );
      actions.push(
        <button
          key="delete"
          onClick={() => onDelete(presale.id)}
          disabled={isDeleting}
          className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      );
    } else if (presale.status === 'APPROVED') {
      actions.push(
        <button
          key="deploy"
          onClick={() => router.push(`/presales/${presale.id}/deploy`)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Rocket className="w-4 h-4" />
          Deploy On-Chain
        </button>
      );
    }

    if (['LIVE', 'ENDED', 'SUCCESS', 'FAILED'].includes(presale.status)) {
      actions.push(
        <button
          key="analytics"
          onClick={() => router.push(`/presales/${presale.id}`)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          View Analytics
        </button>
      );
    }

    return actions;
  };

  return (
    <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {presale.params?.logo_url && (
              <img
                src={presale.params.logo_url}
                alt={projectName}
                className="w-12 h-12 rounded-lg object-cover"
              />
            )}
            <div>
              <h3 className="text-xl font-bold text-white">{projectName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <NetworkBadge network={presale.network} />
                <StatusPill status={presale.status as any} />
              </div>
            </div>
          </div>

          {/* Rejection Banner */}
          {presale.status === 'REJECTED' && (presale as any).rejection_reason && (
            <div className="mt-4 p-4 bg-red-500/10 border-l-4 border-red-500 rounded-r-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-300 mb-1">Presale Rejected</h4>
                  <p className="text-sm text-red-200/80 mb-3">
                    {(presale as any).rejection_reason}
                  </p>
                  <button
                    onClick={() => router.push(`/create/presale?edit=${presale.id}`)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit & Resubmit
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div>
              <div className="text-xs text-gray-500">Hardcap</div>
              <div className="text-sm font-semibold text-white mt-1">
                {hardcap.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Raised</div>
              <div className="text-sm font-semibold text-white mt-1">
                {presale.total_raised?.toLocaleString() || 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Participants</div>
              <div className="text-sm font-semibold text-white mt-1">
                {presale.total_participants || 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Created</div>
              <div className="text-sm font-semibold text-white mt-1">
                {new Date(presale.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">{getActions()}</div>
      </div>
    </div>
  );
}
