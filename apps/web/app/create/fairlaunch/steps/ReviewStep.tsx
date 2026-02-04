'use client';

import { useState } from 'react';
import { FeeBreakdown } from '@/components/fairlaunch/FeeBreakdown';
import { CheckCircle2, FileText, Save } from 'lucide-react';

interface ReviewStepProps {
  wizardData: {
    // Step 1
    network: string;
    tokenAddress: string;
    tokenSource: string;
    securityBadges: string[];
    // Step 2
    projectName: string;
    description: string;
    logoUrl?: string;
    socialLinks: Record<string, string>;
    // Step 3
    tokensForSale: string;
    softcap: string;
    startTime: string;
    endTime: string;
    minContribution: string;
    maxContribution: string;
    dexPlatform: string;
    listingPremiumBps: number;
    // Step 4
    liquidityPercent: number;
    lpLockMonths: number;
    // Step 5
    teamAllocation: string;
    vestingBeneficiary?: string;
    vestingSchedule?: any[];
  };
  termsAccepted: boolean;
  onTermsChange: (accepted: boolean) => void;
  onSaveDraft: () => void;
}

export function ReviewStep({ wizardData, termsAccepted, onTermsChange, onSaveDraft }: ReviewStepProps) {
  const [isSaving, setIsSaving] = useState(false);

  const networkSymbol = wizardData.network.includes('bsc') ? 'BNB' : 'ETH';

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await onSaveDraft();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Sections */}
      <div className="space-y-4">
        {/* Network & Token */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            Network & Token
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Network:</span>
              <span className="text-white font-medium">{wizardData.network}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Token:</span>
              <span className="text-white font-mono text-xs">{wizardData.tokenAddress}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Source:</span>
              <span className="text-white capitalize">{wizardData.tokenSource}</span>
            </div>
            {wizardData.securityBadges.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Badges:</span>
                <div className="flex gap-2">
                  {wizardData.securityBadges.map((badge) => (
                    <span
                      key={badge}
                      className="px-2 py-1 bg-green-900/40 border border-green-700/40 rounded text-xs text-green-300"
                    >
                      {badge === 'SAFU' ? '🛡️ SAFU' : '✓ SC Pass'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Project Info */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Project Information
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400 block mb-1">Project Name:</span>
              <span className="text-white font-medium">{wizardData.projectName}</span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Description:</span>
              <p className="text-white text-xs leading-relaxed">{wizardData.description}</p>
            </div>
            {wizardData.logoUrl && (
              <div>
                <span className="text-gray-400 block mb-1">Logo:</span>
                <img
                  src={wizardData.logoUrl}
                  alt="Project logo"
                  className="w-16 h-16 rounded-lg object-cover border border-gray-700"
                />
              </div>
            )}
            {Object.keys(wizardData.socialLinks).length > 0 && (
              <div>
                <span className="text-gray-400 block mb-1">Social Links:</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(wizardData.socialLinks).map(([platform, url]) => (
                    url && (
                      <span
                        key={platform}
                        className="px-2 py-1 bg-blue-900/30 border border-blue-700/30 rounded text-xs text-blue-300 capitalize"
                      >
                        {platform}
                      </span>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sale Parameters */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
          <h3 className="font-semibold text-white mb-3">Sale Parameters</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-400 block">Tokens for Sale:</span>
              <span className="text-white font-medium">{wizardData.tokensForSale}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Softcap:</span>
              <span className="text-white font-medium">
                {wizardData.softcap} {networkSymbol}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">Start:</span>
              <span className="text-white text-xs">
                {new Date(wizardData.startTime).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">End:</span>
              <span className="text-white text-xs">
                {new Date(wizardData.endTime).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">Min/Max:</span>
              <span className="text-white font-medium">
                {wizardData.minContribution} - {wizardData.maxContribution} {networkSymbol}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">DEX:</span>
              <span className="text-white font-medium">{wizardData.dexPlatform}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-400 block">Listing Premium:</span>
              <span className="text-white font-medium">
                {(wizardData.listingPremiumBps / 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Liquidity Plan */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
          <h3 className="font-semibold text-white mb-3">Liquidity Plan</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Liquidity Percentage:</span>
              <span className="text-white font-medium">{wizardData.liquidityPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">LP Lock Duration:</span>
              <span className="text-white font-medium">{wizardData.lpLockMonths} months</span>
            </div>
          </div>
        </div>

        {/* Team Vesting */}
        {wizardData.teamAllocation && parseFloat(wizardData.teamAllocation) > 0 && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
            <h3 className="font-semibold text-white mb-3">Team Vesting</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Team Allocation:</span>
                <span className="text-white font-medium">{wizardData.teamAllocation} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Beneficiary:</span>
                <span className="text-white font-mono text-xs">
                  {wizardData.vestingBeneficiary}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block mb-1">Schedule:</span>
                <span className="text-white text-xs">
                  {wizardData.vestingSchedule?.length || 0} vesting period(s)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fee Breakdown */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Fee Breakdown</h3>
        <FeeBreakdown
          network={wizardData.network}
          tokenSource={wizardData.tokenSource as 'factory' | 'existing'}
          softcap={wizardData.softcap}
          showExample={true}
        />
      </div>

      {/* Terms & Conditions */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => onTermsChange(e.target.checked)}
            className="mt-1 w-5 h-5 bg-gray-700 border-gray-600 rounded text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
          />
          <div className="text-sm">
            <p className="text-white font-medium">I accept the Terms & Conditions</p>
            <p className="text-gray-400 mt-1">
              By proceeding, you agree to our{' '}
              <a href="/terms" target="_blank" className="text-purple-400 hover:text-purple-300">
                Terms of Service
              </a>{' '}
              and confirm that all information provided is accurate. Your fairlaunch will be deployed
              immediately upon submission.
            </p>
          </div>
        </label>
      </div>

      {/* Save Draft Button */}
      <button
        onClick={handleSaveDraft}
        disabled={isSaving}
        className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Save as Draft
          </>
        )}
      </button>
    </div>
  );
}
