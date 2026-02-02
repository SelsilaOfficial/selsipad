'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { DeploymentStatus } from '@/types/deployment';

export interface DeploymentStatusBadgeProps {
  status: DeploymentStatus;
  className?: string;
}

/**
 * Badge component for deployment status display
 */
export function DeploymentStatusBadge({ status, className }: DeploymentStatusBadgeProps) {
  const statusConfig = {
    NOT_DEPLOYED: {
      label: 'Not Deployed',
      variant: 'secondary' as const,
      icon: '⚪',
      description: 'Awaiting deployment',
    },
    DEPLOYING: {
      label: 'Deploying',
      variant: 'default' as const,
      icon: '🔄',
      description: 'Transaction pending',
    },
    DEPLOYED: {
      label: 'Deployed',
      variant: 'default' as const,
      icon: '✅',
      description: 'Contract deployed',
    },
    DEPLOYMENT_FAILED: {
      label: 'Failed',
      variant: 'destructive' as const,
      icon: '❌',
      description: 'Deployment error',
    },
    PENDING_FUNDING: {
      label: 'Awaiting Tokens',
      variant: 'outline' as const,
      icon: '⏳',
      description: 'Send tokens to contract',
    },
    FUNDED: {
      label: 'Funded',
      variant: 'default' as const,
      icon: '💰',
      description: 'Tokens received',
    },
    READY: {
      label: 'Ready',
      variant: 'default' as const,
      icon: '🚀',
      description: 'Ready for launch',
    },
  };

  const config = statusConfig[status] || statusConfig.NOT_DEPLOYED;

  return (
    <Badge variant={config.variant} className={className} title={config.description}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}

/**
 * Get deployment status info for display
 */
export function getDeploymentStatusInfo(status: DeploymentStatus) {
  const config = {
    NOT_DEPLOYED: {
      label: 'Not Deployed',
      color: 'gray',
      description: 'Contract has not been deployed yet',
      action: 'Deploy contract',
    },
    DEPLOYING: {
      label: 'Deploying',
      color: 'blue',
      description: 'Deployment transaction is being processed',
      action: 'Wait for confirmation',
    },
    DEPLOYED: {
      label: 'Deployed',
      color: 'green',
      description: 'Contract successfully deployed on-chain',
      action: 'Fund contract with tokens',
    },
    DEPLOYMENT_FAILED: {
      label: 'Deployment Failed',
      color: 'red',
      description: 'Contract deployment encountered an error',
      action: 'Retry deployment',
    },
    PENDING_FUNDING: {
      label: 'Pending Funding',
      color: 'yellow',
      description: 'Contract deployed, awaiting token funding',
      action: 'Send tokens to contract',
    },
    FUNDED: {
      label: 'Funded',
      color: 'green',
      description: 'Contract has received required tokens',
      action: 'Wait for verification',
    },
    READY: {
      label: 'Ready',
      color: 'green',
      description: 'Contract deployed, funded, and verified',
      action: 'Launch can begin',
    },
  };

  return config[status] || config.NOT_DEPLOYED;
}
