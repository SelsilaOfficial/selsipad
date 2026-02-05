'use client';

import { useEffect, useState } from 'react';

export interface CountdownProps {
  targetDate: Date | string;
  onComplete?: () => void;
}

export function Countdown({ targetDate, onComplete }: CountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  function calculateTimeLeft() {
    const target = new Date(targetDate).getTime();
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) {
      onComplete?.();
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }

  useEffect(() => {
    setMounted(true);
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  // Don't render anything on server, only on client after mount
  if (!mounted) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-20 h-5 bg-bg-elevated animate-pulse rounded" />
      </div>
    );
  }

  // If countdown complete, don't show anything
  if (
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0
  ) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-1.5">
      {timeLeft.days > 0 && (
        <>
          <TimeUnit value={timeLeft.days} label="d" />
          <span className="text-text-tertiary text-xs">:</span>
        </>
      )}
      <TimeUnit value={timeLeft.hours} label="h" />
      <span className="text-text-tertiary text-xs">:</span>
      <TimeUnit value={timeLeft.minutes} label="m" />
      <span className="text-text-tertiary text-xs">:</span>
      <TimeUnit value={timeLeft.seconds} label="s" />
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-0.5">
      <span className="text-sm font-bold text-text-primary tabular-nums">
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-[10px] text-text-tertiary font-medium">{label}</span>
    </div>
  );
}
