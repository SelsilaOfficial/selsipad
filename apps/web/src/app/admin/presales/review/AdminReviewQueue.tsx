'use client';

import { useState } from 'react';
import { ApproveModal } from './components/ApproveModal';
import { RejectModal } from './components/RejectModal';

interface Presale {
  id: string;
  created_by: string;
  status: string;
  network: string;
  params: any;
  created_at: string;
}

interface AdminReviewQueueProps {
  presales: Presale[];
}

export function AdminReviewQueue({ presales: initialPresales }: AdminReviewQueueProps) {
  const [presales, setPresales] = useState(initialPresales);
  const [selectedPresale, setSelectedPresale] = useState<Presale | null>(
    initialPresales.length > 0 ? (initialPresales[0] ?? null) : null
  );
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleApproveSuccess = () => {
    // Remove from queue
    const updatedPresales = presales.filter((p) => p.id !== selectedPresale?.id);
    setPresales(updatedPresales);
    setSelectedPresale(updatedPresales.length > 0 ? (updatedPresales[0] ?? null) : null);
    setShowApproveModal(false);
  };

  const handleRejectSuccess = () => {
    // Remove from queue
    const updatedPresales = presales.filter((p) => p.id !== selectedPresale?.id);
    setPresales(updatedPresales);
    setSelectedPresale(updatedPresales.length > 0 ? (updatedPresales[0] ?? null) : null);
    setShowRejectModal(false);
  };

  if (presales.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Admin Review Queue</h1>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-white mb-2">Queue is Empty</h2>
          <p className="text-gray-400">No presales awaiting review at this time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">Admin Review Queue</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue List - Left Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h2 className="text-lg font-semibold text-white mb-4">
              Pending Reviews ({presales.length})
            </h2>
            <div className="space-y-2">
              {presales.map((presale) => (
                <button
                  key={presale.id}
                  onClick={() => setSelectedPresale(presale)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedPresale?.id === presale.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white truncate">
                      {presale.params?.project_name || 'Unnamed Project'}
                    </h3>
                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded ml-2 flex-shrink-0">
                      {presale.network}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 truncate">
                    {presale.created_by.slice(0, 6)}...{presale.created_by.slice(-4)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(presale.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Detail Panel - Right */}
        <div className="lg:col-span-2">
          {selectedPresale && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-6">
              {/* Header */}
              <div className="border-b border-gray-800 pb-4">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {selectedPresale.params?.project_name || 'Unnamed Project'}
                </h2>
                <p className="text-gray-400">
                  {selectedPresale.params?.project_description || 'No description'}
                </p>
              </div>

              {/* Compliance Checklist */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Compliance Checklist</h3>
                <ComplianceItem
                  label="Developer KYC"
                  status={selectedPresale.params?.kyc_status || 'PENDING'}
                />
                <ComplianceItem
                  label="Smart Contract Scan"
                  status={selectedPresale.params?.sc_scan_status || 'NOT_REQUESTED'}
                />
                <ComplianceItem
                  label="Investor Vesting Valid"
                  status={
                    selectedPresale.params?.investor_vesting?.schedule?.reduce(
                      (sum: number, s: any) => sum + s.percentage,
                      0
                    ) === 100
                      ? 'PASS'
                      : 'FAIL'
                  }
                />
                <ComplianceItem
                  label="Team Vesting Valid"
                  status={
                    selectedPresale.params?.team_vesting?.schedule?.reduce(
                      (sum: number, s: any) => sum + s.percentage,
                      0
                    ) === 100
                      ? 'PASS'
                      : 'FAIL'
                  }
                />
                <ComplianceItem
                  label="LP Lock Valid (≥12 months)"
                  status={selectedPresale.params?.lp_lock?.duration_months >= 12 ? 'PASS' : 'FAIL'}
                />
              </div>

              {/* Sale Parameters */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Sale Parameters</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <DetailRow label="Price" value={selectedPresale.params?.price || 'N/A'} />
                  <DetailRow label="Softcap" value={selectedPresale.params?.softcap || 'N/A'} />
                  <DetailRow label="Hardcap" value={selectedPresale.params?.hardcap || 'N/A'} />
                  <DetailRow
                    label="Tokens for Sale"
                    value={selectedPresale.params?.token_for_sale || 'N/A'}
                  />
                  <DetailRow
                    label="Min Contribution"
                    value={selectedPresale.params?.min_contribution || 'N/A'}
                  />
                  <DetailRow
                    label="Max Contribution"
                    value={selectedPresale.params?.max_contribution || 'N/A'}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button
                  onClick={() => setShowApproveModal(true)}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  ✗ Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedPresale && (
        <>
          <ApproveModal
            isOpen={showApproveModal}
            onClose={() => setShowApproveModal(false)}
            presaleId={selectedPresale.id}
            presaleName={selectedPresale.params?.project_name || 'Unnamed Project'}
            onSuccess={handleApproveSuccess}
          />
          <RejectModal
            isOpen={showRejectModal}
            onClose={() => setShowRejectModal(false)}
            presaleId={selectedPresale.id}
            presaleName={selectedPresale.params?.project_name || 'Unnamed Project'}
            onSuccess={handleRejectSuccess}
          />
        </>
      )}
    </div>
  );
}

// Helper Components
function ComplianceItem({ label, status }: { label: string; status: string }) {
  const isPass =
    status === 'PASS' ||
    status === 'CONFIRMED' ||
    status === 'PASS_OVERRIDE_ADMIN' ||
    status === 'VERIFIED';
  const isPending = status === 'PENDING' || status === 'NOT_REQUESTED';

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-1 rounded ${
            isPass
              ? 'bg-green-500/20 text-green-300'
              : isPending
                ? 'bg-yellow-500/20 text-yellow-300'
                : 'bg-red-500/20 text-red-300'
          }`}
        >
          {status}
        </span>
        <span className="text-lg">{isPass ? '✅' : isPending ? '⏳' : '❌'}</span>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}
