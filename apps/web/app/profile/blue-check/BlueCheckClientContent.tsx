'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Shield,
  Sparkles,
  Zap,
  MessageSquare,
  Award,
  Gift,
  BadgeCheck,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';
import { useAccount } from 'wagmi';
import { MultiChainConnectWallet } from '@/components/wallet/MultiChainConnectWallet';
import { useBlueCheckPurchase } from '@/hooks/useBlueCheckPurchase';
import { useToast } from '@/components/ui';
import { useState } from 'react';

interface BlueCheckClientContentProps {
  bluecheckStatus: string;
}

export default function BlueCheckClientContent({ bluecheckStatus }: BlueCheckClientContentProps) {
  const router = useRouter();
  const isActive = bluecheckStatus === 'active';
  const isPending = bluecheckStatus === 'pending';
  const isRejected = bluecheckStatus === 'rejected';
  const isNone = bluecheckStatus === 'none';

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground />
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content */}
      <div className="relative z-10">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 max-w-2xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/profile')}
                className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
              </button>
              <div className="flex-1">
                <h1 className="text-lg sm:text-xl font-bold">Blue Check</h1>
                <p className="text-xs text-gray-400">Premium verification badge</p>
              </div>
              <StatusPill status={bluecheckStatus} />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 space-y-6 max-w-2xl">
          {/* Hero Card */}
          <HeroCard status={bluecheckStatus} />

          {/* State-specific content */}
          {isActive && <ActiveContent />}
          {isPending && <PendingContent />}
          {isRejected && <RejectedContent />}
          {isNone && <PurchaseContent />}

          {/* Benefits Section — always visible */}
          <BenefitsGrid />
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Pill                                                        */
/* ------------------------------------------------------------------ */

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    active: {
      bg: 'bg-emerald-500/20 border-emerald-500/30',
      text: 'text-emerald-400',
      icon: CheckCircle2,
      label: 'Active',
    },
    pending: {
      bg: 'bg-amber-500/20 border-amber-500/30',
      text: 'text-amber-400',
      icon: Clock,
      label: 'Pending',
    },
    rejected: {
      bg: 'bg-red-500/20 border-red-500/30',
      text: 'text-red-400',
      icon: XCircle,
      label: 'Rejected',
    },
    none: {
      bg: 'bg-white/5 border-white/10',
      text: 'text-gray-400',
      icon: Shield,
      label: 'Not Applied',
    },
  };

  const defaultConfig = {
    bg: 'bg-white/5 border-white/10',
    text: 'text-gray-400',
    icon: Shield,
    label: 'Not Applied',
  };
  const c = config[status] ?? defaultConfig;
  const Icon = c.icon;

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${c.bg} ${c.text}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {c.label}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero Card                                                          */
/* ------------------------------------------------------------------ */

function HeroCard({ status }: { status: string }) {
  const isActive = status === 'active';

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-xl">
      {/* Gradient accent top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#39AEC4] to-[#756BBA]" />

      <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
        {/* Badge icon */}
        <div className="relative">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center ${
              isActive
                ? 'bg-gradient-to-br from-[#39AEC4] to-[#756BBA] shadow-lg shadow-[#39AEC4]/30'
                : 'bg-white/5 border-2 border-dashed border-[#39AEC4]/30'
            }`}
          >
            <BadgeCheck className={`w-12 h-12 ${isActive ? 'text-white' : 'text-[#39AEC4]/50'}`} />
          </div>
          {isActive && (
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/50">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Text */}
        <div className="text-center sm:text-left flex-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-1">
            {isActive ? "You're Verified!" : 'Blue Check Badge'}
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed max-w-md">
            {isActive
              ? 'Your lifetime Blue Check badge is active. Enjoy premium benefits and enhanced credibility across the SELSIPAD ecosystem.'
              : 'A premium verification badge that unlocks exclusive platform features, enhanced trust, and community recognition.'}
          </p>
          {isActive && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              Lifetime Access — No Renewal Needed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Active Content                                                     */
/* ------------------------------------------------------------------ */

function ActiveContent() {
  const perks = [
    { icon: MessageSquare, label: 'Post on SelsiFeed', desc: 'Share insights with the community' },
    { icon: Gift, label: 'Claim Referral Rewards', desc: 'Earn from your network' },
    { icon: Zap, label: 'Priority Presale Access', desc: 'First in line for launches' },
    { icon: Award, label: 'Enhanced Credibility', desc: 'Trusted badge across the platform' },
  ];

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/5 backdrop-blur-xl p-6">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <div className="w-1 h-5 bg-emerald-500 rounded-full" />
        Your Active Benefits
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {perks.map((perk) => (
          <div
            key={perk.label}
            className="flex items-start gap-3 p-4 rounded-[16px] bg-white/5 border border-white/5 hover:border-emerald-500/20 transition-colors"
          >
            <div className="p-2 rounded-[12px] bg-emerald-500/10">
              <perk.icon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{perk.label}</p>
              <p className="text-xs text-gray-400">{perk.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pending Content                                                    */
/* ------------------------------------------------------------------ */

function PendingContent() {
  return (
    <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-full bg-amber-500/10 shrink-0">
          <Clock className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-amber-400 mb-1">Review in Progress</h3>
          <p className="text-sm text-gray-300 leading-relaxed">
            Your Blue Check application is being reviewed. This usually takes{' '}
            <span className="text-white font-semibold">24–48 hours</span>. We&apos;ll notify you
            once the review is complete.
          </p>

          {/* Timeline */}
          <div className="mt-4 space-y-3">
            {[
              { label: 'Payment Received', done: true },
              { label: 'Identity Verification', done: true },
              { label: 'Admin Review', done: false, active: true },
              { label: 'Badge Activation', done: false },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.done
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : step.active
                        ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                        : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {step.done ? '✓' : i + 1}
                </div>
                <span
                  className={`text-sm ${step.done ? 'text-emerald-400' : step.active ? 'text-amber-400 font-semibold' : 'text-gray-500'}`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rejected Content                                                   */
/* ------------------------------------------------------------------ */

function RejectedContent() {
  return (
    <div className="rounded-[20px] border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-full bg-red-500/10 shrink-0">
          <XCircle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-red-400 mb-1">Application Not Approved</h3>
          <p className="text-sm text-gray-300 leading-relaxed mb-4">
            Your Blue Check application was not approved. This may be due to insufficient trading
            history or other verification requirements.
          </p>

          <div className="p-4 rounded-[16px] bg-white/5 border border-white/10 mb-4">
            <h4 className="text-sm font-bold text-white mb-2">Common Reasons:</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                Insufficient trading history (min. 3 contributions required)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                Account age less than 30 days
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                Incomplete or invalid identity verification
              </li>
            </ul>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#8B7FD8] text-white text-sm font-bold transition-all shadow-lg shadow-[#756BBA]/20"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Purchase Content (status === 'none')                               */
/* ------------------------------------------------------------------ */

function PurchaseContent() {
  const { address, isConnected } = useAccount();
  const { showToast } = useToast();
  const {
    requiredBNB,
    hasPurchased,
    isLoading,
    isPurchasing,
    error,
    isWrongChain,
    purchaseBlueCheck,
    switchToBSCTestnet,
  } = useBlueCheckPurchase();

  const handlePurchase = async () => {
    try {
      await purchaseBlueCheck();
      showToast('success', 'Blue Check purchased successfully! 🎉');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to purchase Blue Check');
    }
  };

  // Already purchased on-chain
  if (hasPurchased) {
    return (
      <div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-xl p-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-emerald-400 mb-1">Already Purchased!</h3>
        <p className="text-sm text-gray-400">You already own a lifetime Blue Check badge.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pricing Card */}
      <div className="rounded-[20px] border border-[#39AEC4]/20 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
            <div className="w-1 h-5 bg-gradient-to-b from-[#39AEC4] to-[#756BBA] rounded-full" />
            Get Blue Check
          </h3>
          <p className="text-sm text-gray-400 mb-5">One-time payment. Lifetime access.</p>

          {/* Price display */}
          <div className="flex items-center justify-between p-4 rounded-[16px] bg-black/40 border border-white/10 mb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Price</p>
              <p className="text-3xl font-extrabold text-white">
                $10<span className="text-base text-gray-400 font-normal">.00 USD</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Payable in</p>
              {isLoading ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : (
                <p className="text-lg font-bold text-[#39AEC4]">
                  {parseFloat(requiredBNB).toFixed(4)}{' '}
                  <span className="text-sm text-gray-400">BNB</span>
                </p>
              )}
            </div>
          </div>

          {/* Fee Split */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-[12px] bg-white/5 border border-white/5 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Treasury</p>
              <p className="text-sm font-bold text-white">70%</p>
            </div>
            <div className="p-3 rounded-[12px] bg-white/5 border border-white/5 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Referral Pool</p>
              <p className="text-sm font-bold text-white">30%</p>
            </div>
          </div>

          {/* Wrong Chain Warning */}
          {isConnected && isWrongChain && (
            <div className="mb-4 p-4 rounded-[16px] bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-400 mb-1">Wrong Network</p>
                  <p className="text-xs text-gray-400 mb-3">
                    Blue Check contract is deployed on BSC Testnet. Please switch your wallet to
                    continue.
                  </p>
                  <button
                    onClick={switchToBSCTestnet}
                    className="px-4 py-2 rounded-[12px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-bold transition-colors"
                  >
                    Switch to BSC Testnet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !isWrongChain && (
            <div className="mb-4 p-3 rounded-[12px] bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Connected wallet / purchase button */}
          {!isConnected ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-400">Connect your EVM wallet to proceed</p>
              <MultiChainConnectWallet />
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handlePurchase}
                disabled={isPurchasing || isLoading || isWrongChain}
                className="w-full py-3.5 rounded-[16px] bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#8B7FD8] disabled:opacity-50 disabled:hover:from-[#39AEC4] disabled:hover:to-[#756BBA] text-white font-bold text-sm transition-all shadow-lg shadow-[#756BBA]/20 flex items-center justify-center gap-2"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <BadgeCheck className="w-5 h-5" />
                    Purchase Blue Check
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-500">
                Connected:{' '}
                <span className="text-gray-300 font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Promo */}
      <div className="rounded-[20px] border border-white/10 bg-white/5 backdrop-blur-xl p-5 text-center">
        <p className="text-sm font-bold text-white">
          Selsi Badge bluecheck – <span className="text-green-400">33% OFF</span>
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Early price: <span className="text-white font-semibold">$10</span>{' '}
          <span className="line-through text-gray-600">$15</span>
        </p>
        <p className="text-xs text-yellow-400/80 font-medium mt-1">⏳ Limited time only</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Benefits Grid                                                      */
/* ------------------------------------------------------------------ */

function BenefitsGrid() {
  const benefits = [
    {
      icon: MessageSquare,
      title: 'SelsiFeed Access',
      desc: 'Post updates, share insights, and engage with the community',
      gradient: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-cyan-400',
    },
    {
      icon: Gift,
      title: 'Referral Rewards',
      desc: 'Earn BNB from your network through the referral program',
      gradient: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-400',
    },
    {
      icon: Zap,
      title: 'Priority Access',
      desc: 'Get early access to upcoming presales and fairlaunches',
      gradient: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-400',
    },
    {
      icon: Shield,
      title: 'Trust Badge',
      desc: 'Enhanced credibility and platform recognition',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      iconColor: 'text-emerald-400',
    },
  ];

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/5 backdrop-blur-xl p-6">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <div className="w-1 h-5 bg-gradient-to-b from-[#39AEC4] to-[#756BBA] rounded-full" />
        What is Blue Check?
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-5">
        Blue Check is a premium verification badge that shows you&apos;re a trusted member of the
        SELSIPAD community. It provides exclusive benefits and enhanced credibility — all for a
        one-time payment with lifetime access.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {benefits.map((b) => (
          <div
            key={b.title}
            className={`p-4 rounded-[16px] bg-gradient-to-br ${b.gradient} border border-white/5 hover:border-white/10 transition-colors group`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-[10px] bg-black/30 group-hover:bg-black/40 transition-colors">
                <b.icon className={`w-5 h-5 ${b.iconColor}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-0.5">{b.title}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{b.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
