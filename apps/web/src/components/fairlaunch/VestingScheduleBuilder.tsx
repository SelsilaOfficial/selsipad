'use client';

import { useState } from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { VestingScheduleUI, getVestingPreset, formatNumber } from '@/lib/fairlaunch/helpers';

interface VestingScheduleBuilderProps {
  schedule: VestingScheduleUI[];
  onChange: (schedule: VestingScheduleUI[]) => void;
  teamAllocation: string;
}

export function VestingScheduleBuilder({
  schedule,
  onChange,
  teamAllocation,
}: VestingScheduleBuilderProps) {
  const totalPercentage = schedule.reduce((sum, period) => sum + period.percentage, 0);
  const isValid = Math.abs(totalPercentage - 100) < 0.01; // Allow small floating point errors

  const addPeriod = () => {
    const lastMonth = schedule.length > 0 ? Math.max(...schedule.map((p) => p.month)) : 0;
    onChange([...schedule, { month: lastMonth + 1, percentage: 0 }]);
  };

  const removePeriod = (index: number) => {
    if (schedule.length <= 1) return; // Keep at least one period
    onChange(schedule.filter((_, i) => i !== index));
  };

  const updatePeriod = (index: number, field: 'month' | 'percentage', value: number) => {
    const updated = [...schedule];
    const item = { ...updated[index] } as VestingScheduleUI;
    if (field === 'month') {
      item.month = value;
    } else {
      item.percentage = value;
    }
    updated[index] = item;
    onChange(updated);
  };

  const applyPreset = (presetName: string) => {
    const preset = getVestingPreset(presetName);
    if (preset.length > 0) {
      onChange(preset as VestingScheduleUI[]);
    }
  };

  const calculateTokens = (percentage: number): string => {
    if (!teamAllocation || parseFloat(teamAllocation) === 0) return '0';
    const tokens = (parseFloat(teamAllocation) * percentage) / 100;
    return formatNumber(tokens);
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex items-start gap-2 bg-purple-950/20 border border-purple-800/30 rounded-lg p-4">
        <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-purple-200 font-medium text-sm">Team Vesting Schedule</p>
          <p className="text-purple-300/70 text-xs mt-1">
            Define when team tokens will unlock. Total must equal exactly 100%. Month 0 = Token
            Generation Event (TGE).
          </p>
        </div>
      </div>

      {/* Vesting Periods */}
      <div className="space-y-3">
        {schedule.map((period, index) => (
          <div
            key={index}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
          >
            <div className="flex gap-3 items-end">
              {/* Month Input */}
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Month</label>
                <input
                  type="number"
                  min="0"
                  value={period.month}
                  onChange={(e) => updatePeriod(index, 'month', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Percentage Input */}
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Percentage</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={period.percentage}
                    onChange={(e) =>
                      updatePeriod(index, 'percentage', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 pr-8 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    %
                  </span>
                </div>
              </div>

              {/* Token Amount Preview */}
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Tokens</label>
                <div className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 text-sm">
                  {calculateTokens(period.percentage)}
                </div>
              </div>

              {/* Remove Button */}
              {schedule.length > 1 && (
                <button
                  onClick={() => removePeriod(index)}
                  className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition"
                  title="Remove period"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Period Button */}
      <button
        onClick={addPeriod}
        className="w-full py-2 border-2 border-dashed border-gray-700 hover:border-purple-500 text-gray-400 hover:text-purple-400 rounded-lg transition flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm font-medium">Add Vesting Period</span>
      </button>

      {/* Total Percentage Indicator */}
      <div
        className={`flex items-center justify-between p-4 rounded-lg border ${
          isValid
            ? 'bg-green-950/30 border-green-800/40'
            : 'bg-amber-950/30 border-amber-800/40'
        }`}
      >
        <div className="flex items-center gap-2">
          {isValid ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400" />
          )}
          <span className={`font-medium ${isValid ? 'text-green-300' : 'text-amber-300'}`}>
            Total Percentage: {totalPercentage.toFixed(2)}%
          </span>
        </div>
        {!isValid && (
          <span className="text-am text-sm">Must equal 100%</span>
        )}
      </div>

      {/* Quick Presets */}
      <div className="border-t border-gray-700 pt-4">
        <p className="text-sm text-gray-400 mb-3">Quick Presets:</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={() => applyPreset('linear-12m')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition"
          >
            📈 Linear 12 Months
            <span className="block text-xs text-gray-500 mt-1">Equal monthly unlock</span>
          </button>
          <button
            onClick={() => applyPreset('cliff-6m')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition"
          >
            ⏰ 6M Cliff + 12M Linear
            <span className="block text-xs text-gray-500 mt-1">20% after 6m, rest monthly</span>
          </button>
          <button
            onClick={() => applyPreset('standard')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition"
          >
            ⭐ Standard (20% TGE)
            <span className="block text-xs text-gray-500 mt-1">20% now + 80% over 12m</span>
          </button>
        </div>
      </div>
    </div>
  );
}
