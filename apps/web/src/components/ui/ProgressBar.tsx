import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  value: number;
  max?: number;
  showPercentage?: boolean;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning';
  className?: string;
  indicatorClassName?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showPercentage = true,
  showLabel = false,
  label,
  size = 'md',
  variant = 'default',
  className,
  indicatorClassName,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variants = {
    default: 'bg-primary-main',
    success: 'bg-status-success-text',
    warning: 'bg-status-warning-text',
  };

  return (
    <div className={className}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-body-sm text-text-secondary">{label}</span>}
          {showPercentage && (
            <span className="text-body-sm font-semibold text-text-primary tabular-nums">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      <div className={cn('w-full bg-bg-elevated rounded-full overflow-hidden', sizes[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            variants[variant],
            indicatorClassName
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
