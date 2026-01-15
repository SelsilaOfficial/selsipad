'use client';

import { useState } from 'react';
import { submitAMA, type AMAType } from '../../../app/ama/actions';
import { useRouter } from 'next/navigation';

interface AMASubmitFormProps {
  userProjects: Array<{
    id: string;
    name: string;
  }>;
}

export function AMASubmitForm({ userProjects }: AMASubmitFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    project_id: '',
    title: '',
    description: '',
    type: 'TEXT' as AMAType,
    scheduled_date: '',
    scheduled_time: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const scheduledAt = new Date(
        `${formData.scheduled_date}T${formData.scheduled_time}:00`
      ).toISOString();

      await submitAMA({
        project_id: formData.project_id,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        scheduled_at: scheduledAt,
      });

      alert('AMA submitted successfully! Awaiting admin approval.');
      router.push('/profile/ama');
    } catch (error: any) {
      alert(error.message || 'Failed to submit AMA');
    } finally {
      setLoading(false);
    }
  };

  const isValid =
    formData.project_id &&
    formData.title.length >= 5 &&
    formData.type &&
    formData.scheduled_date &&
    formData.scheduled_time;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Project Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Select Project *</label>
        <select
          value={formData.project_id}
          onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Choose a project...</option>
          {userProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          AMA Title * <span className="text-gray-500 font-normal">(5-200 characters)</span>
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Building Multi-Chain DeFi"
          minLength={5}
          maxLength={200}
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Description <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="What will you discuss?"
          rows={4}
        />
      </div>

      {/* Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">AMA Type *</label>
        <div className="grid grid-cols-3 gap-4">
          {(['TEXT', 'VOICE', 'VIDEO'] as AMAType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData({ ...formData, type })}
              className={`px-4 py-3 border-2 rounded-lg font-medium transition-all ${
                formData.type === type
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Date *</label>
          <input
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Time *</label>
          <input
            type="time"
            value={formData.scheduled_time}
            onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex gap-4 pt-6">
        <button
          type="submit"
          disabled={!isValid || loading}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Submitting...' : 'Submit AMA'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
