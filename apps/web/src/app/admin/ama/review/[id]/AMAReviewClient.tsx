'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { pinAMA, rejectAMA, startAMA, endAMA } from '../../actions';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  Clock,
  Pin,
  Play,
  Square,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';

interface AMAReviewClientProps {
  ama: any;
}

export function AMAReviewClient({ ama }: AMAReviewClientProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');

  const handlePin = async () => {
    setIsProcessing(true);
    setError('');

    const result = await pinAMA(ama.id);

    if (result.success) {
      alert('AMA pinned successfully!');
      router.push('/admin/ama');
    } else {
      setError(result.error || 'Failed to pin');
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (rejectionReason.trim().length < 10) {
      setError('Rejection reason must be at least 10 characters');
      return;
    }

    setIsProcessing(true);
    setError('');

    const result = await rejectAMA(ama.id, rejectionReason);

    if (result.success) {
      alert('AMA rejected - refund will be processed');
      router.push('/admin/ama');
    } else {
      setError(result.error || 'Failed to reject');
      setIsProcessing(false);
    }
  };

  const handleStart = async () => {
    setIsProcessing(true);
    setError('');

    const result = await startAMA(ama.id);

    if (result.success) {
      alert('AMA is now LIVE!');
      router.push('/admin/ama');
    } else {
      setError(result.error || 'Failed to start');
      setIsProcessing(false);
    }
  };

  const handleEnd = async () => {
    setIsProcessing(true);
    setError('');

    const result = await endAMA(ama.id);

    if (result.success) {
      alert('AMA has ended');
      router.push('/admin/ama');
    } else {
      setError(result.error || 'Failed to end');
      setIsProcessing(false);
    }
  };

  return (
    <div>
      {/* Back Button */}
      <Link
        href="/admin/ama"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to AMA Management
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-white">
            {ama.status === 'PENDING' ? 'Review' : 'Manage'} AMA Request
          </h1>
          <StatusBadge status={ama.status} />
        </div>
        <p className="text-gray-400">
          {ama.status === 'PENDING' && 'Review and approve or reject this AMA request'}
          {ama.status === 'PINNED' &&
            'This AMA is approved and visible. You can start it when ready.'}
          {ama.status === 'LIVE' && 'This AMA is currently live!'}
          {ama.status === 'ENDED' && 'This AMA has ended.'}
          {ama.status === 'REJECTED' && 'This AMA was rejected.'}
        </p>
      </div>

      {/* AMA Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Basic Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Request Details</h2>

          <div className="space-y-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Project</p>
              <p className="text-white font-medium text-lg">{ama.project_name}</p>
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-1">Description</p>
              <p className="text-white">{ama.description}</p>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-indigo-400 mt-1" />
              <div>
                <p className="text-gray-400 text-sm">Developer</p>
                <p className="text-white">@{ama.profiles?.nickname || 'Unknown'}</p>
                <p className="text-gray-500 text-sm">
                  {ama.profiles?.kyc_status === 'APPROVED' ? '✓ KYC Verified' : '⏳ Pending KYC'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule & Payment Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Schedule & Payment</h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-green-400 mt-1" />
              <div>
                <p className="text-gray-400 text-sm">Scheduled Time</p>
                <p className="text-white" suppressHydrationWarning>
                  {new Date(ama.scheduled_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-yellow-400 mt-1" />
              <div>
                <p className="text-gray-400 text-sm">Payment</p>
                <p className="text-indigo-400 font-medium">
                  {Number(ama.payment_amount_bnb).toFixed(4)} BNB
                </p>
                <a
                  href={`${ama.chain === '97' ? 'https://testnet.bscscan.com' : 'https://bscscan.com'}/tx/${ama.payment_tx_hash}`}
                  target="_blank"
                  className="text-xs text-gray-500 hover:text-indigo-400"
                >
                  View Transaction →
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-gray-400 text-sm">Submitted</p>
                <p className="text-white" suppressHydrationWarning>
                  {new Date(ama.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {ama.rejection_reason && (
              <div className="p-3 bg-red-950/30 border border-red-800 rounded-lg">
                <p className="text-red-400 text-sm font-medium">Rejection Reason:</p>
                <p className="text-red-300">{ama.rejection_reason}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-950/30 border border-red-800 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Actions</h2>

        {/* PENDING - Show Pin/Reject */}
        {ama.status === 'PENDING' && !showRejectInput && (
          <div className="flex gap-4">
            <button
              onClick={handlePin}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <Pin className="w-5 h-5" />
              {isProcessing ? 'Processing...' : 'Pin AMA (Approve)'}
            </button>

            <button
              onClick={() => setShowRejectInput(true)}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <XCircle className="w-5 h-5" />
              Reject & Refund
            </button>
          </div>
        )}

        {/* Rejection Input */}
        {ama.status === 'PENDING' && showRejectInput && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Rejection Reason (min 10 characters)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this AMA request is being rejected..."
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none"
                rows={4}
                disabled={isProcessing}
              />
              <p className="text-gray-500 text-sm mt-1">
                {rejectionReason.length}/10 characters minimum
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleReject}
                disabled={isProcessing || rejectionReason.trim().length < 10}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                <XCircle className="w-5 h-5" />
                {isProcessing ? 'Rejecting...' : 'Confirm Rejection & Refund'}
              </button>

              <button
                onClick={() => {
                  setShowRejectInput(false);
                  setRejectionReason('');
                  setError('');
                }}
                disabled={isProcessing}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* PINNED - Show Start */}
        {ama.status === 'PINNED' && (
          <button
            onClick={handleStart}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            <Play className="w-5 h-5" />
            {isProcessing ? 'Starting...' : 'Start AMA (Go Live)'}
          </button>
        )}

        {/* LIVE - Show End */}
        {ama.status === 'LIVE' && (
          <div className="space-y-4">
            <div className="p-4 bg-green-950/30 border border-green-800 rounded-lg">
              <p className="text-green-400 font-medium">🔴 This AMA is currently LIVE!</p>
              <p className="text-green-300 text-sm">Users can now send messages in the chat.</p>
            </div>
            <button
              onClick={handleEnd}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <Square className="w-5 h-5" />
              {isProcessing ? 'Ending...' : 'End AMA'}
            </button>
          </div>
        )}

        {/* ENDED/REJECTED - View only */}
        {(ama.status === 'ENDED' || ama.status === 'REJECTED') && (
          <p className="text-gray-400 text-center py-4">
            No actions available for {ama.status.toLowerCase()} AMAs.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    PINNED: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    LIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
    ENDED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded border ${styles[status] || ''}`}>
      {status}
    </span>
  );
}
