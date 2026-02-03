'use client';

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface AdminPauseModalProps {
  projectName: string;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

export function AdminPauseModal({ projectName, onConfirm, onCancel }: AdminPauseModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      alert('Please provide a reason');
      return;
    }

    try {
      setLoading(true);
      await onConfirm(reason);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-red-600 rounded-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Pause Project</h2>
              <p className="text-sm text-gray-400">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Warning */}
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm">
            ⚠️ This will immediately pause the project and prevent new contributions. 
            The developer will see the pause reason in their dashboard.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Reason for Pausing *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g., Contract security issue, Developer misconduct, etc."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
              rows={4}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be visible to the project creator
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Pausing...' : 'Pause Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
