'use client';

import { useState } from 'react';

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  presaleId: string;
  presaleName: string;
  onSuccess: () => void;
}

export function RejectModal({
  isOpen,
  onClose,
  presaleId,
  presaleName,
  onSuccess,
}: RejectModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleReject = async () => {
    // Validate reason
    if (!reason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Rejection reason must be at least 10 characters');
      return;
    }

    if (reason.trim().length > 500) {
      setError('Rejection reason must not exceed 500 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/rounds/${presaleId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rejection_reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject presale');
      }

      onSuccess();
      setReason(''); // Clear form
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exampleReasons = [
    'Token contract not verified on explorer',
    'Insufficient project documentation provided',
    'Team vesting schedule does not meet requirements',
    'LP lock duration is below minimum threshold',
    'Suspicious contract code detected in scan',
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-4">Reject Presale</h2>
        <p className="text-gray-400 mb-4">
          Rejecting <strong className="text-white">{presaleName}</strong>
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Rejection Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Provide a clear reason for rejection (min 10 characters)..."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 resize-none"
            rows={4}
            maxLength={500}
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-500">Min 10 characters required</p>
            <p className="text-xs text-gray-500">{reason.length}/500</p>
          </div>
        </div>

        {/* Example Reasons */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Common rejection reasons:</p>
          <div className="space-y-1">
            {exampleReasons.map((example, idx) => (
              <button
                key={idx}
                onClick={() => setReason(example)}
                className="block w-full text-left px-3 py-2 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={loading || !reason.trim()}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
