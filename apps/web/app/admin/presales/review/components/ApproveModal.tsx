'use client';

import { useState } from 'react';

interface ApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  presaleId: string;
  presaleName: string;
  onSuccess: () => void;
}

export function ApproveModal({
  isOpen,
  onClose,
  presaleId,
  presaleName,
  onSuccess,
}: ApproveModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleApprove = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/rounds/${presaleId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve presale');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-4">Approve Presale</h2>
        <p className="text-gray-400 mb-6">
          Are you sure you want to approve <strong className="text-white">{presaleName}</strong>?
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This will change the status to <span className="text-green-400">APPROVED_TO_DEPLOY</span>{' '}
          and allow the owner to deploy the presale.
        </p>

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
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Approving...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
