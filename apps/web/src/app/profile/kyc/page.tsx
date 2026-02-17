import { getUserProfile } from '@/lib/data/profile';
import Link from 'next/link';
import { formatDistance } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function KYCStatusPage() {
  const profile = await getUserProfile();

  if (!profile) {
    return <div>Profile not found</div>;
  }

  const isVerified = profile.kyc_status === 'verified';
  const isPending = profile.kyc_status === 'pending';
  const isRejected = profile.kyc_status === 'rejected';
  const notStarted = profile.kyc_status === 'not_started';

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans selection:bg-cyan-500/30">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/profile" className="text-gray-400 hover:text-white transition-colors">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Developer KYC</h1>
            <p className="text-xs text-gray-500">Identity Verification</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Status Card */}
        <div
          className={`bg-white/5 border rounded-2xl p-6 relative overflow-hidden ${
            isVerified
              ? 'border-green-500/30'
              : isPending
                ? 'border-yellow-500/30'
                : isRejected
                  ? 'border-red-500/30'
                  : 'border-white/10'
          }`}
        >
          {/* Glow effect */}
          <div
            className={`absolute top-0 left-0 right-0 h-px ${
              isVerified
                ? 'bg-gradient-to-r from-transparent via-green-500 to-transparent'
                : isPending
                  ? 'bg-gradient-to-r from-transparent via-yellow-500 to-transparent'
                  : isRejected
                    ? 'bg-gradient-to-r from-transparent via-red-500 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-cyan-500 to-transparent'
            }`}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                  isVerified
                    ? 'bg-green-500/10 border border-green-500/30'
                    : isPending
                      ? 'bg-yellow-500/10 border border-yellow-500/30'
                      : isRejected
                        ? 'bg-red-500/10 border border-red-500/30'
                        : 'bg-white/5 border border-white/10'
                }`}
              >
                {isVerified ? '✓' : isPending ? '⏳' : isRejected ? '✗' : '🛡️'}
              </div>
              <div>
                <h2 className="text-xl font-bold">Developer KYC Verification</h2>
                <p className="text-sm text-gray-500">Developer identity verification</p>
              </div>
            </div>
            <div
              className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wide ${
                isVerified
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : isPending
                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                    : isRejected
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-white/5 border-white/10 text-gray-500'
              }`}
            >
              {isVerified
                ? 'Verified'
                : isPending
                  ? 'Pending'
                  : isRejected
                    ? 'Rejected'
                    : 'Not Started'}
            </div>
          </div>

          {isVerified && profile.kyc_submitted_at && (
            <p className="text-sm text-gray-500 mt-3">
              Verified{' '}
              {formatDistance(new Date(profile.kyc_submitted_at), new Date(), { addSuffix: true })}
            </p>
          )}
        </div>

        {/* ======= VERIFIED STATE ======= */}
        {isVerified && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <span className="text-green-400 text-lg">✓</span>
              </div>
              <h3 className="text-lg font-bold">Verification Complete</h3>
            </div>
            <p className="text-sm text-gray-400 mb-5">
              Your identity has been verified. You now have access to all features requiring
              Developer KYC.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className="text-sm font-bold text-green-400">Verified ✓</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Verified On</p>
                <p className="text-sm font-bold text-white">
                  {profile.kyc_submitted_at &&
                    new Date(profile.kyc_submitted_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ======= PENDING STATE ======= */}
        {isPending && (
          <>
            {/* Warning Banner */}
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-yellow-400 text-lg">⏳</span>
              </div>
              <div>
                <h3 className="font-bold text-yellow-400 mb-1">Verification in Progress</h3>
                <p className="text-sm text-gray-400">
                  Your KYC documents are being reviewed. This usually takes 2-5 business days.
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-3">What's Next?</h3>
              <p className="text-sm text-gray-400 mb-4">
                Our team is reviewing your submitted documents. You'll receive a notification once
                the review is complete.
              </p>
              <div className="space-y-3">
                {[
                  'Estimated time: 2-5 business days',
                  'Check your email for updates',
                  'No action required from you',
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5"
                  >
                    <div className="w-6 h-6 rounded-full bg-yellow-500/10 flex items-center justify-center">
                      <span className="text-yellow-400 text-xs">{i + 1}</span>
                    </div>
                    <span className="text-sm text-gray-400">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ======= REJECTED STATE ======= */}
        {isRejected && (
          <>
            {/* Error Banner */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-red-400 text-lg">✗</span>
              </div>
              <div>
                <h3 className="font-bold text-red-400 mb-1">Verification Rejected</h3>
                <p className="text-sm text-gray-400">
                  Your KYC submission was rejected. Please review the reason and resubmit.
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-3">Rejection Reason</h3>
              <p className="text-sm text-gray-400 mb-4">
                Document quality too low. Please ensure your ID photo is clear, well-lit, and all
                text is readable.
              </p>

              <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl mb-5">
                <p className="text-sm text-gray-400">
                  💡 <span className="font-bold text-cyan-400">Tips for resubmission:</span> Use
                  good lighting, avoid glare, ensure all corners of the document are visible.
                </p>
              </div>

              <Link
                href="/profile/kyc/submit"
                className="block w-full px-5 py-3 bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white font-bold rounded-xl text-center hover:opacity-90 transition-opacity"
              >
                Resubmit Documents
              </Link>
            </div>
          </>
        )}

        {/* ======= NOT STARTED STATE ======= */}
        {notStarted && (
          <>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <span className="text-cyan-400 text-lg">🛡️</span>
                </div>
                <h3 className="text-lg font-bold">Why Verify Your Identity?</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                KYC verification is required for developer features and helps protect the community
                from fraud. Your information is encrypted and secure.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4">What You'll Need</h3>
              <div className="space-y-3">
                {[
                  {
                    icon: '📄',
                    text: "Government-issued ID (Passport, National ID, or Driver's License)",
                  },
                  { icon: '📸', text: 'Clear photo of your ID (both sides if applicable)' },
                  { icon: '🤳', text: 'Selfie holding your ID next to your face' },
                  { icon: '⏱️', text: '5-10 minutes to complete the process' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-3.5 bg-white/[0.03] rounded-xl border border-white/5 group hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-lg group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <span className="text-sm text-gray-400">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-cyan-500/20 rounded-2xl p-6">
              <div className="flex items-start gap-3 mb-5">
                <span className="text-xl">🔒</span>
                <p className="text-sm text-gray-400">
                  Your data is encrypted and securely stored. We never share your information with
                  third parties.
                </p>
              </div>
              <Link
                href="/profile/kyc/submit"
                className="block w-full px-5 py-3.5 bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white font-bold rounded-xl text-center hover:opacity-90 transition-opacity text-sm"
              >
                Start KYC Verification →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
