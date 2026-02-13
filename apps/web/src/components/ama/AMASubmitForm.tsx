'use client';

/**
 * AMASubmitForm Component
 *
 * Premium form for developers to request AMA sessions
 * Includes Dev Verified badge gating and payment flow
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAMAPurchase } from '@/hooks/useAMAPurchase';

interface AMASubmitFormProps {
  userProjects: Array<{
    id: string;
    name: string;
  }>;
  isDevVerified: boolean;
}

const timezones = [
  { value: '+7', label: 'WIB (UTC+7)', name: 'Jakarta, Surabaya' },
  { value: '+8', label: 'WITA (UTC+8)', name: 'Makassar, Bali' },
  { value: '+9', label: 'WIT (UTC+9)', name: 'Jayapura, Maluku' },
  { value: '0', label: 'UTC (Global)', name: 'Universal Time' },
];

export function AMASubmitForm({ userProjects, isDevVerified }: AMASubmitFormProps) {
  const router = useRouter();
  const { requiredBNB, feeUSD, bnbPrice, isLoading, isPurchasing, error, submitAMA, refreshPrice } =
    useAMAPurchase();

  const [selectedTimezone, setSelectedTimezone] = useState('+7'); // Default WIB
  const [formData, setFormData] = useState({
    project_id: '',
    project_name: '',
    scheduled_date: '',
    scheduled_time: '',
    description: '',
  });
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Handle project selection
  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    const project = userProjects.find((p) => p.id === projectId);
    setFormData({
      ...formData,
      project_id: projectId,
      project_name: project?.name || '',
    });
  };

  const isFormValid =
    formData.project_id &&
    formData.scheduled_date &&
    formData.scheduled_time &&
    formData.description.length >= 20;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    // Convert local time to UTC properly
    // Parse date/time components manually to avoid browser timezone issues
    const [year = 0, month = 0, day = 0] = formData.scheduled_date.split('-').map(Number);
    const [hour = 0, minute = 0] = formData.scheduled_time.split(':').map(Number);

    // Create UTC date directly from components
    // Subtract timezone offset because: Local Time = UTC + offset, so UTC = Local Time - offset
    const offset = parseInt(selectedTimezone);
    const utcDate = new Date(
      Date.UTC(year, (month || 1) - 1, day || 1, (hour || 0) - offset, minute || 0)
    );
    const scheduledAt = utcDate.toISOString();

    const result = await submitAMA({
      projectId: formData.project_id,
      projectName: formData.project_name,
      scheduledAt,
      description: formData.description,
    });

    if (result.success) {
      setTxHash(result.txHash || null);
      setStep('success');
    }
  };

  // Not Dev Verified - Show Gate
  if (!isDevVerified) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-[#14142b] to-[#0a0a0f] rounded-2xl border border-white/10 p-8 text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Dev Verified Required</h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Only verified developers can request AMA sessions. Complete your KYC verification to
            unlock this feature.
          </p>
          <button
            onClick={() => router.push('/profile/kyc')}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all"
          >
            Get Verified →
          </button>
        </div>
      </div>
    );
  }

  // Success State
  if (step === 'success') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-[#14142b] to-[#0a0a0f] rounded-2xl border border-green-500/30 p-8 text-center">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Request Submitted!</h2>
          <p className="text-gray-400 mb-6">
            Your AMA request has been submitted and is awaiting admin review. You'll be notified
            once it's approved and scheduled.
          </p>
          {txHash && (
            <a
              href={`https://testnet.bscscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 text-sm"
            >
              View Transaction →
            </a>
          )}
          <div className="mt-6">
            <button
              onClick={() => router.push('/profile/ama')}
              className="px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all"
            >
              View My Requests
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation Step
  if (step === 'confirm') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-[#14142b] to-[#0a0a0f] rounded-2xl border border-indigo-500/30 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💳</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Confirm Payment</h2>
            <p className="text-gray-400 mt-2">Review your AMA request details</p>
          </div>

          {/* Summary */}
          <div className="space-y-4 mb-8">
            <div className="flex justify-between p-4 bg-white/5 rounded-xl">
              <span className="text-gray-400">Project</span>
              <span className="text-white font-medium">{formData.project_name}</span>
            </div>
            <div className="flex justify-between p-4 bg-white/5 rounded-xl">
              <span className="text-gray-400">Date & Time</span>
              <span className="text-white font-medium">
                {new Date(`${formData.scheduled_date}T${formData.scheduled_time}`).toLocaleString()}
              </span>
            </div>
            <div className="p-4 bg-white/5 rounded-xl">
              <span className="text-gray-400 block mb-2">Description</span>
              <p className="text-white text-sm">{formData.description}</p>
            </div>
          </div>

          {/* Payment Details */}
          <div className="p-6 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20 mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">AMA Fee</span>
              <span className="text-2xl font-bold text-white">${feeUSD}.00</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Pay in BNB</span>
              <div className="text-right">
                <span className="text-xl font-bold text-indigo-400">≈ {requiredBNB} BNB</span>
                {bnbPrice > 0 && (
                  <p className="text-gray-500 text-xs">@ ${bnbPrice.toFixed(2)}/BNB</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-gray-500 text-xs">
              <span>📊</span>
              <span>Price via Chainlink Oracle (real-time)</span>
              <button onClick={refreshPrice} className="text-indigo-400 hover:text-indigo-300">
                Refresh
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setStep('form')}
              disabled={isPurchasing}
              className="flex-1 px-6 py-4 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 disabled:opacity-50 transition-all"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPurchasing}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isPurchasing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Pay & Submit
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form Step
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-[#14142b] to-[#0a0a0f] rounded-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎤</span>
            <div>
              <h1 className="text-2xl font-bold text-white">Request Developer AMA</h1>
              <p className="text-gray-400">Share your project with the community</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-8 space-y-6">
          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              🏷️ Select Project *
            </label>
            <select
              value={formData.project_id}
              onChange={handleProjectChange}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="" className="bg-gray-900">
                Choose a project...
              </option>
              {userProjects.map((project) => (
                <option key={project.id} value={project.id} className="bg-gray-900">
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timezone Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">🌍 Your Timezone</label>
            <select
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value} className="bg-gray-900">
                  {tz.label} - {tz.name}
                </option>
              ))}
            </select>
            <div className="mt-2 p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-lg">
              <p className="text-xs text-indigo-300">
                💡 <strong>Contoh:</strong> Mau live jam 00:10 tanggal 5?{' '}
                {selectedTimezone === '+7' &&
                  'Pilih 00:10 di input, otomatis jadi 17:10 UTC tanggal 4.'}
                {selectedTimezone === '+8' &&
                  'Pilih 00:10 di input, otomatis jadi 16:10 UTC tanggal 4.'}
                {selectedTimezone === '+9' &&
                  'Pilih 00:10 di input, otomatis jadi 15:10 UTC tanggal 4.'}
                {selectedTimezone === '0' && 'Input langsung dalam UTC.'}
              </p>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">📅 AMA Date *</label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">🕐 AMA Time *</label>
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              📝 Description * <span className="text-gray-500">(shown to investors)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell investors what you'll discuss in this AMA..."
              rows={4}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
            />
            <p className="text-gray-500 text-xs mt-1">
              {formData.description.length}/500 characters (minimum 20)
            </p>
          </div>

          {/* Fee Info */}
          <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💳</span>
                <div>
                  <p className="text-white font-medium">AMA Fee</p>
                  <p className="text-gray-400 text-sm">One-time payment</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-white">${feeUSD}.00</p>
                {!isLoading && <p className="text-indigo-400 text-sm">≈ {requiredBNB} BNB</p>}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={() => setStep('confirm')}
            disabled={!isFormValid}
            className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            Continue to Payment →
          </button>

          {/* Cancel */}
          <button
            onClick={() => router.push('/ama')}
            className="w-full px-6 py-3 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default AMASubmitForm;
