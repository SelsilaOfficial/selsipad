'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { NetworkBadge } from '@/components/presale/NetworkBadge';
import { StatusPill } from '@/components/presale/StatusPill';
import { ContributionForm } from '@/components/presale/ContributionForm';
import VestingClaimer from '@/components/presale/VestingClaimer';
import RefundCard from '@/components/presale/RefundCard';

interface PresaleDetailClientProps {
  round: any;
  userContribution: any;
  isOwner: boolean;
}

const PRESALE_STATUS = {
  UPCOMING: 0,
  ACTIVE: 1,
  ENDED: 2,
  FINALIZED_SUCCESS: 3,
  FINALIZED_FAILED: 4,
  CANCELLED: 5,
} as const;

export function PresaleDetailClient({
  round,
  userContribution,
  isOwner,
}: PresaleDetailClientProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const { address } = useAccount();
  const roundAddress = round.round_address || round.contract_address;
  const presaleStatus =
    round.result === 'SUCCESS'
      ? PRESALE_STATUS.FINALIZED_SUCCESS
      : round.result === 'FAILED'
        ? PRESALE_STATUS.FINALIZED_FAILED
        : round.result === 'CANCELED' || round.result === 'CANCELLED'
          ? PRESALE_STATUS.CANCELLED
          : PRESALE_STATUS.ENDED;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'contribute', label: 'Contribute', enabled: round.status === 'LIVE' },
    { id: 'claim', label: 'Claim', enabled: round.result === 'SUCCESS' },
    { id: 'refund', label: 'Refund', enabled: ['FAILED', 'CANCELED'].includes(round.result) },
    { id: 'transactions', label: 'Transactions' },
  ].filter((tab) => tab.enabled !== false);

  const calculateProgress = () => {
    if (round.type === 'PRESALE' && round.params.hardcap) {
      return Math.min((round.total_raised / round.params.hardcap) * 100, 100);
    }
    return 0;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start gap-6">
            {/* Logo */}
            {round.projects?.logo_url ? (
              <img
                src={round.projects.logo_url}
                alt={round.projects.name}
                className="w-20 h-20 rounded-full"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {round.projects?.symbol?.[0] || 'P'}
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {round.projects?.name || 'Unnamed Project'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {round.projects?.description || 'No description provided'}
              </p>
              <div className="flex items-center gap-3">
                <NetworkBadge network={round.chain} />
                <StatusPill status={round.status} />
                <span className="px-3 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {round.type}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Progress */}
                {round.type === 'PRESALE' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Presale Progress
                    </h3>
                    <div className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Raised</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {calculateProgress().toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all"
                          style={{ width: `${calculateProgress()}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <span>
                          {round.total_raised} {round.raise_asset}
                        </span>
                        <span>
                          {round.params.hardcap} {round.raise_asset}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Raised</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {round.total_raised} {round.raise_asset}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Participants</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {round.total_participants}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {round.type === 'PRESALE' ? 'Price' : 'Token Supply'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {round.type === 'PRESALE'
                        ? `${round.params.price} ${round.raise_asset}`
                        : `${round.params.token_for_sale} tokens`}
                    </p>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Timeline
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Start Time</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatDate(round.start_at)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">End Time</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatDate(round.end_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contribution Limits */}
                {round.params.min_contribution && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Contribution Limits
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Minimum</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {round.params.min_contribution} {round.raise_asset}
                        </span>
                      </div>
                      {round.params.max_contribution && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Maximum</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {round.params.max_contribution} {round.raise_asset}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vesting Info */}
                {(round.params.investor_vesting || round.params.team_vesting) && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Vesting Schedule
                    </h3>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        ℹ️ This presale includes vesting schedules for both investors and team
                        members. Tokens will be unlocked gradually according to the configured
                        schedule.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'contribute' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Contribute to Presale
                </h3>
                {roundAddress ? (
                  <ContributionForm
                    roundId={round.id}
                    roundAddress={roundAddress as `0x${string}`}
                    paymentToken={round.raise_asset}
                    min={round.params.min_contribution}
                    max={round.params.max_contribution}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Round contract not deployed yet. Contribution will be available after deployment.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'claim' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Claim Your Tokens
                </h3>
                {address && roundAddress ? (
                  <VestingClaimer presaleId={round.id} userAddress={address} />
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Connect your wallet to claim your allocated tokens.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'refund' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Claim Refund
                </h3>
                {roundAddress ? (
                  <RefundCard roundAddress={roundAddress} presaleStatus={presaleStatus} />
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Round contract not deployed; refunds not available.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Your Transactions
                </h3>
                {userContribution ? (
                  <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Contribution</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(userContribution.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {userContribution.amount} {round.raise_asset}
                        </p>
                        <StatusPill status={userContribution.status} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                    No transactions yet
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
