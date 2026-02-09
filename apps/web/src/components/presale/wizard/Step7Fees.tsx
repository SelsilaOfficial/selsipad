'use client';

import { Shield, Users } from 'lucide-react';
import type { FeesReferral } from '@/../../packages/shared/src/validators/presale-wizard';

interface Step7FeesProps {
  data: Partial<FeesReferral>;
  onChange: (data: Partial<FeesReferral>) => void;
}

export function Step7Fees({ data, onChange }: Step7FeesProps) {
  const platformFeeBps = data.platform_fee_bps ?? 500;
  const platformFeePercent = (platformFeeBps / 100).toFixed(1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Platform Fees</h2>
        <p className="text-gray-400">
          Fee structure is fixed on-chain via the FeeSplitter smart contract.
        </p>
      </div>

      {/* Platform Fee (Read-only) */}
      <div className="p-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold mb-1">Platform Success Fee</h3>
            <p className="text-sm text-gray-400">Charged only if your presale reaches softcap</p>
          </div>
          <div className="text-3xl font-bold text-purple-400">{platformFeePercent}%</div>
        </div>
      </div>

      {/* Fee Distribution Breakdown */}
      <div className="p-5 bg-gray-800/40 border border-gray-700 rounded-lg space-y-3">
        <h3 className="text-white font-semibold text-sm mb-3">Fee Distribution (On-Chain)</h3>
        <div className="space-y-2">
          {/* Treasury */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm text-gray-300">Treasury</span>
            </div>
            <span className="text-sm font-mono text-white">2.5%</span>
          </div>
          {/* Referral Pool */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-300">Referral Pool</span>
            </div>
            <span className="text-sm font-mono text-white">2.0%</span>
          </div>
          {/* SBT Staking */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-300">SBT Staking Rewards</span>
            </div>
            <span className="text-sm font-mono text-white">0.5%</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex h-2 rounded-full overflow-hidden mt-3">
          <div className="bg-purple-500" style={{ width: '50%' }} />
          <div className="bg-blue-500" style={{ width: '40%' }} />
          <div className="bg-green-500" style={{ width: '10%' }} />
        </div>
      </div>

      {/* Referral Always Active Notice */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-blue-200 mb-1">Referral Rewards — Always Active</p>
            <p className="text-gray-400">
              Referral rewards are automatically enabled for all presales. 2% of raised funds goes
              to the Referral Pool via the on-chain FeeSplitter contract. Referrers who share your
              presale link earn rewards from this pool — at{' '}
              <span className="text-blue-300 font-medium">no extra cost</span> to you or your
              contributors.
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-gray-300">
        <strong className="text-white">How it works:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
          <li>Referrers share a unique link with their network</li>
          <li>When someone contributes via their link, referrer earns a reward</li>
          <li>Rewards are paid from the 2% Referral Pool (on-chain)</li>
          <li>Fee is fixed in the smart contract — no additional cost to you</li>
        </ul>
      </div>

      {/* Security Badge */}
      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
          <div className="text-sm text-green-300">
            <p className="font-semibold text-green-200 mb-1">On-Chain Transparency</p>
            <p className="text-gray-400">
              All fee distributions are handled by the audited FeeSplitter smart contract. Fees are
              only charged when your presale succeeds (reaches softcap). No hidden fees — everything
              is verifiable on-chain.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
