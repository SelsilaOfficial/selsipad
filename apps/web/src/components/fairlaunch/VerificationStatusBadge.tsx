'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import type { VerificationStatus } from '@/types/deployment';

export interface VerificationStatusBadgeProps {
  status: VerificationStatus;
  contractAddress?: string;
  chainId?: number;
  className?: string;
  showLink?: boolean;
}

/**
 * Badge component for BSCScan verification status
 */
export function VerificationStatusBadge({
  status,
  contractAddress,
  chainId = 97,
  className,
  showLink = false,
}: VerificationStatusBadgeProps) {
  const statusConfig = {
    NOT_VERIFIED: {
      label: 'Not Verified',
      variant: 'secondary' as const,
      icon: '⚪',
      description: 'Verification queued',
    },
    VERIFICATION_QUEUED: {
      label: 'Queued',
      variant: 'default' as const,
      icon: '🔄',
      description: 'In verification queue',
    },
    VERIFICATION_PENDING: {
      label: 'Verifying',
      variant: 'default' as const,
      icon: '⏳',
      description: 'Submitted to block explorer',
    },
    VERIFIED: {
      label: 'Verified',
      variant: 'default' as const,
      icon: '✅',
      description: 'Verified on block explorer',
    },
    VERIFICATION_FAILED: {
      label: 'Failed',
      variant: 'outline' as const,
      icon: '⚠️',
      description: 'Verification failed (non-blocking)',
    },
  };

  const config = statusConfig[status] || statusConfig.NOT_VERIFIED;

  // Get explorer URL
  const explorerUrl = React.useMemo(() => {
    if (!contractAddress || !showLink) return null;

    const explorers: Record<number, string> = {
      97: 'https://testnet.bscscan.com',
      56: 'https://bscscan.com',
      11155111: 'https://sepolia.etherscan.io',
      1: 'https://etherscan.io',
      84532: 'https://sepolia.basescan.org',
      8453: 'https://basescan.org',
    };

    const baseUrl = explorers[chainId];
    return baseUrl ? `${baseUrl}/address/${contractAddress}#code` : null;
  }, [contractAddress, chainId, showLink]);

  if (showLink && explorerUrl && status === 'VERIFIED') {
    return (
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center"
      >
        <Badge variant={config.variant} className={`${className} cursor-pointer hover:opacity-80`} title={config.description}>
          <span className="mr-1">{config.icon}</span>
          {config.label}
          <ExternalLink className="ml-1 h-3 w-3" />
        </Badge>
      </a>
    );
  }

  return (
    <Badge variant={config.variant} className={className} title={config.description}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}

/**
 * Get verification status info for display
 */
export function getVerificationStatusInfo(status: VerificationStatus) {
  const config = {
    NOT_VERIFIED: {
      label: 'Not Verified',
      color: 'gray',
      description: 'Contract source code not yet verified',
      action: 'Automatic verification in progress',
    },
    VERIFICATION_QUEUED: {
      label: 'Verification Queued',
      color: 'blue',
      description: 'Verification job queued for processing',
      action: 'Please wait',
    },
    VERIFICATION_PENDING: {
      label: 'Verification Pending',
      color: 'yellow',
      description: 'Verification submitted to block explorer',
      action: 'Wait for block explorer confirmation',
    },
    VERIFIED: {
      label: 'Verified',
      color: 'green',
      description: 'Contract source code verified on block explorer',
      action: 'View on block explorer',
    },
    VERIFICATION_FAILED: {
      label: 'Verification Failed',
      color: 'orange',
      description: 'Automatic verification unsuccessful',
      action: 'Contact support or verify manually',
    },
  };

  return config[status] || config.NOT_VERIFIED;
}
