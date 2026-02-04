/**
 * Database types for deployment tracking
 * Generated from migration: 20260131_deployment_tracking.sql
 */

export type DeploymentStatus =
  | 'NOT_DEPLOYED'      // Initial state (using Factory)
  | 'DEPLOYING'         // Deployment transaction pending
  | 'DEPLOYED'          // Contract deployed successfully
  | 'DEPLOYMENT_FAILED' // Deployment failed
  | 'PENDING_FUNDING'   // Deployed, waiting for user to send tokens
  | 'FUNDED'            // Tokens sent to contract
  | 'READY';            // Ready for launch (deployed + funded + verified)

export type VerificationStatus =
  | 'NOT_VERIFIED'        // Not yet verified
  | 'VERIFICATION_PENDING' // Submitted to block explorer
  | 'VERIFICATION_QUEUED'  // In verification queue
  | 'VERIFIED'            // Successfully verified on block explorer
  | 'VERIFICATION_FAILED'; // Verification failed (non-blocking)

export type LaunchRoundStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'LIVE'
  | 'ENDED'
  | 'FINALIZED'
  | 'REJECTED';

export type LaunchRoundResult = 'NONE' | 'SUCCESS' | 'FAILED' | 'CANCELED';

export type LaunchRoundType = 'PRESALE' | 'FAIRLAUNCH';

/**
 * Extended Launch Round type with deployment tracking
 */
export interface LaunchRound {
  // Core fields
  id: string;
  project_id: string;
  type: LaunchRoundType;
  chain: string;
  token_address: string;
  raise_asset: string;

  // Timing
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp

  // Status
  status: LaunchRoundStatus;
  result: LaunchRoundResult;

  // Gates
  kyc_status_at_submit: string | null;
  scan_status_at_submit: string | null;

  // Parameters (varies by type)
  params: Record<string, any>;

  // Totals
  total_raised: number;
  total_participants: number;

  // Admin
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  finalized_by: string | null;
  finalized_at: string | null;

  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;

  // ===== DEPLOYMENT TRACKING (NEW) =====

  // Contract deployment
  contract_address: string | null;
  deployment_status: DeploymentStatus;
  deployment_tx_hash: string | null;
  deployment_block_number: number | null;
  deployer_address: string | null;
  deployed_at: string | null; // ISO timestamp

  // Verification
  verification_status: VerificationStatus;
  verification_guid: string | null;
  verified_at: string | null; // ISO timestamp
  verification_attempts: number;
  verification_error: string | null;

  // Funding
  tokens_funded_at: string | null; // ISO timestamp
  funding_tx_hash: string | null;
}

/**
 * Deployment pipeline view
 */
export interface DeploymentPipelineView {
  id: string;
  type: LaunchRoundType;
  contract_address: string;
  chain: string;
  deployment_status: DeploymentStatus;
  verification_status: VerificationStatus;
  deployer_address: string | null;
  deployment_tx_hash: string | null;
  deployed_at: string | null;
  verified_at: string | null;
  tokens_funded_at: string | null;
  created_at: string;
}

/**
 * Pending verifications view
 */
export interface PendingVerificationView {
  id: string;
  contract_address: string;
  chain: string;
  deployment_status: DeploymentStatus;
  verification_status: VerificationStatus;
  verification_attempts: number;
  verification_error: string | null;
  deployed_at: string | null;
  created_at: string;
}

/**
 * Type guard for deployment status
 */
export function isDeploymentStatus(value: string): value is DeploymentStatus {
  return [
    'NOT_DEPLOYED',
    'DEPLOYING',
    'DEPLOYED',
    'DEPLOYMENT_FAILED',
    'PENDING_FUNDING',
    'FUNDED',
    'READY',
  ].includes(value);
}

/**
 * Type guard for verification status
 */
export function isVerificationStatus(value: string): value is VerificationStatus {
  return [
    'NOT_VERIFIED',
    'VERIFICATION_PENDING',
    'VERIFICATION_QUEUED',
    'VERIFIED',
    'VERIFICATION_FAILED',
  ].includes(value);
}

/**
 * Helper to get deployment status display info
 */
export function getDeploymentStatusInfo(status: DeploymentStatus): {
  label: string;
  color: 'gray' | 'blue' | 'green' | 'yellow' | 'red';
  description: string;
} {
  switch (status) {
    case 'NOT_DEPLOYED':
      return {
        label: 'Not Deployed',
        color: 'gray',
        description: 'Using Factory deployment',
      };
    case 'DEPLOYING':
      return {
        label: 'Deploying',
        color: 'blue',
        description: 'Deployment transaction pending...',
      };
    case 'DEPLOYED':
      return {
        label: 'Deployed',
        color: 'blue',
        description: 'Contract deployed successfully',
      };
    case 'DEPLOYMENT_FAILED':
      return {
        label: 'Failed',
        color: 'red',
        description: 'Deployment failed',
      };
    case 'PENDING_FUNDING':
      return {
        label: 'Awaiting Tokens',
        color: 'yellow',
        description: 'Send tokens to contract',
      };
    case 'FUNDED':
      return {
        label: 'Funded',
        color: 'green',
        description: 'Tokens received',
      };
    case 'READY':
      return {
        label: 'Ready',
        color: 'green',
        description: 'Ready for launch',
      };
  }
}

/**
 * Helper to get verification status display info
 */
export function getVerificationStatusInfo(status: VerificationStatus): {
  label: string;
  color: 'gray' | 'blue' | 'green' | 'yellow' | 'red';
  description: string;
  icon: string;
} {
  switch (status) {
    case 'NOT_VERIFIED':
      return {
        label: 'Not Verified',
        color: 'gray',
        description: 'Contract not verified',
        icon: '⏳',
      };
    case 'VERIFICATION_PENDING':
      return {
        label: 'Verifying',
        color: 'blue',
        description: 'Submitted to block explorer',
        icon: '🔄',
      };
    case 'VERIFICATION_QUEUED':
      return {
        label: 'Queued',
        color: 'blue',
        description: 'In verification queue',
        icon: '⏱️',
      };
    case 'VERIFIED':
      return {
        label: 'Verified',
        color: 'green',
        description: 'Verified on block explorer',
        icon: '✅',
      };
    case 'VERIFICATION_FAILED':
      return {
        label: 'Failed',
        color: 'yellow',
        description: 'Verification failed (contract still works)',
        icon: '⚠️',
      };
  }
}
