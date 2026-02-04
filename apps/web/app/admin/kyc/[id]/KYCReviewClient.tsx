'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveKYC, rejectKYC } from '../actions';
import { ArrowLeft, CheckCircle2, XCircle, FileText, User, Calendar } from 'lucide-react';
import Link from 'next/link';

interface KYCReviewClientProps {
  submission: any;
}

export function KYCReviewClient({ submission }: KYCReviewClientProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');

  const handleApprove = async () => {
    setIsProcessing(true);
    setError('');

    const result = await approveKYC(submission.id);

    if (result.success) {
      alert('KYC approved successfully!');
      router.push('/admin/kyc');
    } else {
      setError(result.error || 'Failed to approve');
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

    const result = await rejectKYC(submission.id, rejectionReason);

    if (result.success) {
      alert('KYC rejected');
      router.push('/admin/kyc');
    } else {
      setError(result.error || 'Failed to reject');
      setIsProcessing(false);
    }
  };

  return (
    <div>
      {/* Back Button */}
      <Link
        href="/admin/kyc"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to KYC Reviews
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Review KYC Submission</h1>
        <p className="text-gray-400">Verify user documents and approve or reject submission</p>
      </div>

      {/* Submission Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Info Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Submission Info</h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-purple-400 mt-1" />
              <div>
                <p className="text-gray-400 text-sm">Wallet Address</p>
                <p className="text-white font-mono">{submission.wallet_address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-blue-400 mt-1" />
              <div>
                <p className="text-gray-400 text-sm">Full Name</p>
                <p className="text-white">{submission.full_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-green-400 mt-1" />
              <div>
                <p className="text-gray-400 text-sm">Country</p>
                <p className="text-white">{submission.country}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-green-400 mt-1" />
              <div>
                <p className="text-gray-400 text-sm">Submitted</p>
                <p className="text-white">{new Date(submission.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Document Preview */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Documents</h2>

          {submission.documents_url ? (
            <div className="space-y-4">
              {/* Document URL */}
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-2">Document URL:</p>
                <p className="text-white font-mono text-xs break-all mb-3">
                  {submission.documents_url}
                </p>

                {/* View/Download Button */}
                <a
                  href={submission.documents_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                >
                  <FileText className="w-4 h-4" />
                  View Document
                </a>
              </div>

              {/* Image Preview (if it's an image) */}
              {submission.documents_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-2">Document Preview:</p>
                  <img
                    src={submission.documents_url}
                    alt="KYC Document"
                    className="w-full rounded-lg border border-gray-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No documents uploaded</p>
            </div>
          )}
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
        <h2 className="text-xl font-semibold text-white mb-4">Review Actions</h2>

        {!showRejectInput ? (
          <div className="flex gap-4">
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <CheckCircle2 className="w-5 h-5" />
              {isProcessing ? 'Approving...' : 'Approve KYC'}
            </button>

            <button
              onClick={() => setShowRejectInput(true)}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <XCircle className="w-5 h-5" />
              Reject KYC
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Rejection Reason (min 10 characters)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this KYC submission is being rejected..."
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
                {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
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
      </div>
    </div>
  );
}
