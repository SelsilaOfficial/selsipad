'use client';

import { useState, useEffect } from 'react';
import { Copy, CheckCircle2, Share2, Info } from 'lucide-react';
import { getReferralCode } from '@/actions/referral/referral-code';

export function ReferralCodeDisplay() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReferralCode();
  }, []);

  const loadReferralCode = async () => {
    const result = await getReferralCode();
    if (result.success && result.code) {
      setCode(result.code);
    }
    setLoading(false);
  };

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLink = () => {
    if (code) {
      const link = `${window.location.origin}?ref=${code}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[20px] bg-gradient-to-br from-[#39AEC4]/10 to-[#756BBA]/10 backdrop-blur-xl border border-[#39AEC4]/30 p-5 sm:p-6 shadow-xl shadow-[#756BBA]/20">
        <div className="animate-pulse">
          <div className="h-4 bg-white/10 rounded w-24 mb-3"></div>
          <div className="h-10 bg-white/10 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="rounded-[20px] bg-red-500/10 border border-red-500/30 backdrop-blur-xl p-5 sm:p-6">
        <p className="text-red-400 text-sm">⚠️ Referral code not found. Please contact support.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-gradient-to-br from-[#39AEC4]/10 to-[#756BBA]/10 backdrop-blur-xl border border-[#39AEC4]/30 p-5 sm:p-6 shadow-xl shadow-[#756BBA]/20">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-[#39AEC4]" />
        <h3 className="font-bold text-sm sm:text-base">Your Referral Code</h3>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 bg-black/40 border border-[#39AEC4]/30 rounded-lg px-4 py-3">
          <span className="text-xl sm:text-2xl font-bold text-[#39AEC4] tracking-wider flex-1">
            {code}
          </span>
          <button
            onClick={copyCode}
            className="p-2 rounded-lg hover:bg-[#39AEC4]/20 transition-colors"
          >
            {copied ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <Copy className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      <button
        onClick={shareLink}
        className="w-full px-6 py-3 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/30 font-semibold flex items-center justify-center gap-2"
      >
        <Share2 className="w-4 h-4" />
        Share Link
      </button>

      <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <p className="text-xs text-amber-200 flex items-start gap-2">
          <span className="text-amber-400 font-bold">🎁</span>
          <span>Earn rewards when your friends use your code and make contributions!</span>
        </p>
      </div>
    </div>
  );
}
