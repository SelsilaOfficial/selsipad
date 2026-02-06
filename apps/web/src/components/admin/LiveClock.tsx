'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

/**
 * Live Clock Component for Admin Dashboard
 * Shows current time in WIB (Asia/Jakarta) timezone
 */
export function LiveClock() {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      // Format time in WIB (Asia/Jakarta = UTC+7)
      const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };

      const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      };

      setTime(now.toLocaleTimeString('en-US', timeOptions));
      setDate(now.toLocaleDateString('en-US', dateOptions));
    };

    // Update immediately
    updateTime();

    // Update every second
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/50 border border-gray-800 rounded-xl backdrop-blur-sm">
      <Clock size={18} className="text-blue-400" />
      <div className="flex flex-col">
        <span className="text-lg font-mono font-semibold text-white tracking-wide">
          {time || '--:--:--'}
        </span>
        <span className="text-xs text-gray-500">
          {date || 'Loading...'} <span className="text-blue-400">WIB</span>
        </span>
      </div>
    </div>
  );
}
