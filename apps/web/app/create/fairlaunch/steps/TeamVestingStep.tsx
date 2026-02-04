'use client';

import { VestingScheduleBuilder } from '@/components/fairlaunch/VestingScheduleBuilder';
import { VestingScheduleUI } from '@/lib/fairlaunch/helpers';
import { Users, Wallet } from 'lucide-react';

interface TeamVestingStepProps {
  data: {
    teamAllocation: string;
    vestingBeneficiary: string;
    vestingSchedule: VestingScheduleUI[];
  };
  walletAddress: string;
  onChange: (data: Partial<TeamVestingStepProps['data']>) => void;
  errors?: Record<string, string>;
}

export function TeamVestingStep({ data, walletAddress, onChange, errors }: TeamVestingStepProps) {
  const hasTeamAllocation = data.teamAllocation && parseFloat(data.teamAllocation) > 0;

  const handleScheduleChange = (schedule: VestingScheduleUI[]) => {
    onChange({ vestingSchedule: schedule });
  };

  const useMyWallet = () => {
    onChange({ vestingBeneficiary: walletAddress });
  };

  return (
    <div className="space-y-6">
      {/* Team Allocation */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Team Token Allocation <span className="text-red-400">*</span>
        </label>
        <input
          type="number"
          value={data.teamAllocation}
          onChange={(e) => onChange({ teamAllocation: e.target.value })}
          placeholder="e.g., 100000 (set to 0 if no team allocation)"
          min="0"
          step="any"
          className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 transition
            ${
              errors?.teamAllocation
                ? 'border-red-500 focus:border-red-400'
                : 'border-gray-700 focus:border-purple-500'
            }
            focus:outline-none focus:ring-2 focus:ring-purple-500/20
          `}
        />
        {errors?.teamAllocation && (
          <p className="text-red-400 text-sm mt-2">{errors.teamAllocation}</p>
        )}
        <p className="text-gray-400 text-xs mt-1">
          Tokens reserved for team. Set to 0 if you don't need team vesting.
        </p>
      </div>

      {/* No Team Allocation Message */}
      {!hasTeamAllocation && (
        <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Users className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-200 font-medium text-sm">No Team Vesting</p>
              <p className="text-blue-300/70 text-xs mt-1">
                You've set team allocation to 0. All tokens will be distributed to contributors only.
                You can skip the vesting configuration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Vesting Configuration (only if has team allocation) */}
      {hasTeamAllocation && (
        <>
          {/* Vesting Beneficiary */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Vesting Beneficiary <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={data.vestingBeneficiary}
                onChange={(e) => onChange({ vestingBeneficiary: e.target.value })}
                placeholder="0x... (address that will receive vested tokens)"
                className={`flex-1 px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 transition font-mono text-sm
                  ${
                    errors?.vestingBeneficiary
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-gray-700 focus:border-purple-500'
                  }
                  focus:outline-none focus:ring-2 focus:ring-purple-500/20
                `}
              />
              <button
                type="button"
                onClick={useMyWallet}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center gap-2 whitespace-nowrap"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">Use My Wallet</span>
              </button>
            </div>
            {errors?.vestingBeneficiary && (
              <p className="text-red-400 text-sm mt-2">{errors.vestingBeneficiary}</p>
            )}
            <p className="text-gray-400 text-xs mt-1">
              This address will be able to claim vested tokens according to the schedule below.
            </p>
          </div>

          {/* Vesting Schedule Builder */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Vesting Schedule</h3>
            <VestingScheduleBuilder
              schedule={data.vestingSchedule}
              onChange={handleScheduleChange}
              teamAllocation={data.teamAllocation}
            />
            {errors?.vestingSchedule && (
              <p className="text-red-400 text-sm mt-2">{errors.vestingSchedule}</p>
            )}
          </div>

          {/* Info */}
          <div className="bg-purple-950/20 border border-purple-800/30 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Users className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-purple-200 font-medium text-sm">Team Vesting Policy</p>
                <p className="text-purple-300/70 text-xs mt-1">
                  Team tokens will be locked in a smart contract and released according to your
                  schedule. The vesting contract will be deployed automatically when you create the
                  fairlaunch. Month 0 refers to the Token Generation Event (TGE), which happens when
                  fairlaunch ends successfully.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
