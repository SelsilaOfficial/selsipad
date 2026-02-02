/**
 * Verification Status Badge
 * Shows contract verification status with appropriate styling
 */

import { CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react';

export type VerificationStatus = 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED';

interface VerificationBadgeProps {
  status: VerificationStatus;
  contractAddress?: string;
  chainId?: number;
  className?: string;
}

const statusConfig = {
  VERIFIED: {
    icon: CheckCircle2,
    label: 'Verified',
    className: 'bg-green-500/10 text-green-500 border-green-500/20',
    iconColor: 'text-green-500',
  },
  VERIFYING: {
    icon: Clock,
    label: 'Verifying...',
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    iconColor: 'text-blue-500',
  },
  PENDING: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    iconColor: 'text-yellow-500',
  },
  FAILED: {
    icon: XCircle,
    label: 'Verification Failed',
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
    iconColor: 'text-red-500',
  },
};

function getExplorerUrl(chainId: number, address: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    56: 'https://bscscan.com',
    97: 'https://testnet.bscscan.com',
    8453: 'https://basescan.org',
    84532: 'https://sepolia.basescan.org',
  };

  const baseUrl = explorers[chainId] || explorers[97];
  return `${baseUrl}/address/${address}#code`;
}

export function VerificationBadge({
  status,
  contractAddress,
  chainId = 97,
  className = '',
}: VerificationBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const badge = (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${config.className} ${className}`}
    >
      <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
      <span>{config.label}</span>
    </div>
  );

  // If verified and has contract address, make it clickable to explorer
  if (status === 'VERIFIED' && contractAddress && chainId) {
    return (
      <a
        href={getExplorerUrl(chainId, contractAddress)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block hover:opacity-80 transition-opacity"
      >
        {badge}
      </a>
    );
  }

  return badge;
}

/**
 * Compact verification icon (for inline use)
 */
export function VerificationIcon({
  status,
  contractAddress,
  chainId = 97,
}: Omit<VerificationBadgeProps, 'className'>) {
  if (status !== 'VERIFIED') return null;

  const Icon = CheckCircle2;

  if (contractAddress) {
    return (
      <a
        href={getExplorerUrl(chainId, contractAddress)}
        target="_blank"
        rel="noopener noreferrer"
        title="View verified contract on explorer"
        className="inline-block"
      >
        <Icon className="w-4 h-4 text-green-500 hover:text-green-400 transition-colors" />
      </a>
    );
  }

  return (
    <span title="Verified">
      <Icon className="w-4 h-4 text-green-500" />
    </span>
  );
}
