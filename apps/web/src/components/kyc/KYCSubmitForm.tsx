'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitKYC, uploadKYCDocuments } from '../../../app/profile/kyc/actions';
import { FileUpload } from '@/components/kyc/FileUpload';

interface KYCSubmitFormProps {
  userProjects: Array<{ id: string; name: string }>;
}

export function KYCSubmitForm({ userProjects }: KYCSubmitFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [projectId, setProjectId] = useState<string>('');

  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  const canSubmit = idFront && selfie && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setSubmitting(true);

    try {
      // 1. Convert files to base64
      const filesToUpload = [];

      const frontBase64 = await fileToBase64(idFront);
      filesToUpload.push({ name: `id-front-${Date.now()}.jpg`, data: frontBase64 });

      if (idBack) {
        const backBase64 = await fileToBase64(idBack);
        filesToUpload.push({ name: `id-back-${Date.now()}.jpg`, data: backBase64 });
      }

      const selfieBase64 = await fileToBase64(selfie);
      filesToUpload.push({ name: `selfie-${Date.now()}.jpg`, data: selfieBase64 });

      // 2. Upload to Supabase Storage
      const documentsUrl = await uploadKYCDocuments(filesToUpload);

      // 3. Submit KYC
      await submitKYC({
        submission_type: 'INDIVIDUAL',
        documents_url: documentsUrl,
        project_id: projectId || undefined,
      });

      alert('KYC submitted successfully! Awaiting review.');
      router.push('/profile/kyc');
    } catch (error: any) {
      console.error('KYC submission error:', error);
      alert(error.message || 'Failed to submit KYC');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Project Association (Optional) */}
      {userProjects.length > 0 && (
        <div>
          <label className="block text-sm font-bold text-white mb-2">
            Link to Project <span className="text-gray-500 font-normal">(Optional)</span>
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors appearance-none"
          >
            <option value="" className="bg-black">
              None - Personal verification only
            </option>
            {userProjects.map((project) => (
              <option key={project.id} value={project.id} className="bg-black">
                {project.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Document Uploads */}
      <div className="space-y-4">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[10px] text-cyan-400 font-bold">
            1
          </span>
          Upload Documents
        </h3>

        <FileUpload
          label="ID Front Side"
          accept="image/jpeg,image/png"
          maxSize={10}
          onFileSelect={setIdFront}
          required
        />

        <FileUpload
          label="ID Back Side (if applicable)"
          accept="image/jpeg,image/png"
          maxSize={10}
          onFileSelect={setIdBack}
        />

        <FileUpload
          label="Selfie with ID"
          accept="image/jpeg,image/png"
          maxSize={10}
          onFileSelect={setSelfie}
          required
        />

        {/* Tips */}
        <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
          <p className="text-sm font-bold text-cyan-400 mb-2">💡 Tips for good photos</p>
          <div className="space-y-1.5">
            {[
              'Use good lighting, avoid glare',
              'Ensure all text is readable',
              'Hold ID next to your face for selfie',
              'All corners of ID must be visible',
            ].map((tip, i) => (
              <p key={i} className="text-xs text-gray-400 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-cyan-500/50 flex-shrink-0" />
                {tip}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 px-6 py-3.5 bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity text-sm"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Submitting...
            </span>
          ) : (
            'Submit for Review'
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="px-6 py-3.5 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl hover:bg-white/10 hover:text-white transition-colors text-sm"
        >
          Cancel
        </button>
      </div>

      <p className="text-[11px] text-gray-600 text-center">
        🔒 Your documents are encrypted and securely stored. Review typically takes 2-5 business
        days.
      </p>
    </form>
  );
}

// Helper function to convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
