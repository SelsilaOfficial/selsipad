'use client';

import {
  usePresaleStatus,
  usePresaleTotalRaised,
  usePresaleConfig,
} from '@/lib/web3/presale-hooks';
import { PresaleStatus, STATUS_LABELS, STATUS_COLORS } from '@/lib/web3/presale-contracts';
import { formatEther } from 'viem';
import { useEffect, useState } from 'react';
import type { Address } from 'viem';

interface PresaleStatsProps {
  roundAddress: Address;
}

export function PresaleStats({ roundAddress }: PresaleStatsProps) {
  const { data: status } = usePresaleStatus(roundAddress);
  const { data: totalRaised } = usePresaleTotalRaised(roundAddress);
  const { softCap, hardCap, startTime, endTime, isLoading } = usePresaleConfig(roundAddress);

  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  // Update countdown timer
  useEffect(() => {
    if (!startTime || !endTime) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const start = Number(startTime);
      const end = Number(endTime);

      if (now < start) {
        const diff = start - now;
        setTimeRemaining(`Starts in ${formatDuration(diff)}`);
      } else if (now < end) {
        const diff = end - now;
        setTimeRemaining(`Ends in ${formatDuration(diff)}`);
      } else {
        setTimeRemaining('Ended');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime, endTime]);

  // Calculate progress
  useEffect(() => {
    if (totalRaised && hardCap) {
      const percent = (Number(totalRaised) / Number(hardCap)) * 100;
      setProgress(Math.min(percent, 100));
    }
  }, [totalRaised, hardCap]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  const statusValue = status !== undefined ? status : PresaleStatus.UPCOMING;
  const statusLabel = STATUS_LABELS[statusValue as PresaleStatus];
  const statusColor = STATUS_COLORS[statusValue as PresaleStatus];

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Presale Status</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-400">Progress</span>
          <span className="font-medium text-gray-900 dark:text-white">{progress.toFixed(1)}%</span>
        </div>

        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>{totalRaised ? formatEther(totalRaised as bigint) : '0'} BNB</span>
          <span>{hardCap ? formatEther(hardCap as bigint) : '0'} BNB</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Softcap</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {softCap ? formatEther(softCap as bigint) : '0'} BNB
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Hardcap</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {hardCap ? formatEther(hardCap as bigint) : '0'} BNB
          </p>
        </div>
      </div>

      {/* Timer */}
      {timeRemaining && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">⏱️ {timeRemaining}</p>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
