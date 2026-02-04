'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
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

  const copyLink = () => {
    if (code) {
      const link = `${window.location.origin}?ref=${code}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLink = async () => {
    if (code && navigator.share) {
      try {
        await navigator.share({
          title: 'Join Selsipad',
          text: 'Use my referral code to join Selsipad and start earning rewards!',
          url: `${window.location.origin}?ref=${code}`,
        });
      } catch (error) {
        // Fallback to copy
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-950/50 to-purple-950/50 border border-blue-800/30 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-24 mb-3"></div>
          <div className="h-8 bg-gray-700 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="bg-red-950/30 border border-red-800/30 rounded-lg p-6">
        <p className="text-red-400">⚠️ Referral code not found. Please contact support.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-950/50 to-purple-950/50 border border-blue-800/30 rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Your Referral Code</h3>
          <div className="flex items-center gap-3">
            <code className="text-2xl font-mono font-bold text-blue-400 tracking-wider">
              {code}
            </code>
            <button
              onClick={copyCode}
              className="p-2 hover:bg-blue-900/30 rounded-lg transition"
              title="Copy code"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-400" />
              ) : (
                <Copy className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>
        
        <button
          onClick={shareLink}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2"
        >
          <Share2 className="w-4 h-4" />
          Share Link
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-blue-800/20">
        <p className="text-sm text-gray-400">
          🎁 <span className="font-medium text-gray-300">Earn rewards</span> when your friends use
          your code and make contributions!
        </p>
      </div>
    </div>
  );
}
