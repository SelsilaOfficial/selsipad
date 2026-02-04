"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
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
      <div className="flex items-center gap-2">
        <div className="w-16 h-6 bg-gray-800 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <TimeUnit value={timeLeft.days} label="d" />
      <span className="text-gray-500">:</span>
      <TimeUnit value={timeLeft.hours} label="h" />
      <span className="text-gray-500">:</span>
      <TimeUnit value={timeLeft.minutes} label="m" />
      <span className="text-gray-500">:</span>
      <TimeUnit value={timeLeft.seconds} label="s" />
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-0.5">
      <span className="font-mono">{value.toString().padStart(2, "0")}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
