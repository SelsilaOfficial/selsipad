/**
 * FASE 4: Launchpad Types
 * TypeScript interfaces for Presale and Fairlaunch pools
 */

// ============================================
// Pool Types
// ============================================

export type PoolType = 'PRESALE' | 'FAIRLAUNCH';

export type PoolStatus =
  | 'DRAFT'
  // Old + transitional statuses (kept for backwards compatibility)
  | 'SUBMITTED'
  | 'APPROVED'
  // Current DB/UI statuses
  | 'SUBMITTED_FOR_REVIEW'
  | 'APPROVED_TO_DEPLOY'
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'UPCOMING'
  | 'LIVE'
  | 'ENDED'
  | 'FINALIZED'
  | 'SUCCESS'
  | 'FAILED'
  | 'REJECTED';

export type PoolResult = 'NONE' | 'SUCCESS' | 'FAILED' | 'CANCELED';

export type ContributionStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';

export type RefundStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// ============================================
// Pool Parameters
// ============================================

/**
 * Presale pool parameters (fixed price)
 */
export interface PresaleParams {
  price: number; // Token price in raise_asset
  hardcap: number; // Maximum raise amount
  softcap: number; // Minimum raise amount for success
  token_for_sale: number; // Total tokens available
  min_contribution?: number; // Min contribution per wallet
  max_contribution?: number; // Max contribution per wallet
}

/**
 * Fairlaunch pool parameters (price discovery)
 */
export interface FairlaunchParams {
  softcap: number; // Minimum raise amount for success
  token_for_sale: number; // Total tokens available
  final_price?: number | null; // Calculated at finalization
  listing_premium_bps?: number; // Listing price premium in basis points
}

export type PoolParams = PresaleParams | FairlaunchParams;

// ============================================
// Launch Round Entity
// ============================================

export interface LaunchRound {
  id: string;
  project_id: string;
  type: PoolType;

  // Chain and token
  chain: string; // EVM chain_id or 'SOLANA'
  token_address: string;
  raise_asset: string; // USDC, ETH, SOL, etc.

  // Timing
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp

  // Status
  status: PoolStatus;
  result: PoolResult;

  // Gate snapshots
  kyc_status_at_submit: string | null;
  scan_status_at_submit: string | null;

  // Pool-specific params
  params: PoolParams;

  // Denormalized totals
  total_raised: number;
  total_participants: number;

  // Admin fields
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  finalized_by: string | null;
  finalized_at: string | null;

  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Contribution Entity
// ============================================

export interface Contribution {
  id: string;
  round_id: string;
  user_id: string;

  // Transaction details
  wallet_address: string;
  amount: number;
  chain: string;
  tx_hash: string;
  tx_id: string | null;

  // Status
  status: ContributionStatus;

  // Timestamps
  created_at: string;
  confirmed_at: string | null;
}

// ============================================
// Round Allocation Entity
// ============================================

export interface RoundAllocation {
  id: string;
  round_id: string;
  user_id: string;

  // Amounts
  contributed_amount: number;
  allocation_tokens: number;
  claimable_tokens: number;
  refund_amount: number;

  // Status
  claim_status: string;
  refund_status: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// Refund Entity
// ============================================

export interface Refund {
  id: string;
  round_id: string;
  user_id: string;

  // Details
  amount: number;
  status: RefundStatus;

  // Transaction
  tx_id: string | null;
  tx_hash: string | null;
  chain: string | null;

  // Idempotency
  idempotency_key: string | null;

  // Timestamps
  created_at: string;
  processed_at: string | null;
  completed_at: string | null;
}

// ============================================
// Extended Types (with relations)
// ============================================

export interface LaunchRoundWithProject extends LaunchRound {
  projects?: {
    name: string;
    symbol: string;
    logo_url: string | null;
    kyc_status: string;
    sc_scan_status: string;
  };
}

export interface LaunchRoundWithContributions extends LaunchRound {
  contributions?: Contribution[];
  contribution_count?: number;
}

export interface ContributionWithRound extends Contribution {
  launch_rounds?: {
    type: PoolType;
    status: PoolStatus;
    chain: string;
    raise_asset: string;
  };
}

// ============================================
// Request/Response Types
// ============================================

/**
 * Create pool request
 */
export interface CreatePoolRequest {
  project_id: string;
  type: PoolType;
  chain: string;
  token_address: string;
  raise_asset: string;
  start_at: string;
  end_at: string;
  params: PoolParams;
}

/**
 * Update pool request (only allowed in DRAFT)
 */
export interface UpdatePoolRequest {
  start_at?: string;
  end_at?: string;
  params?: Partial<PoolParams>;
}

/**
 * Contribution intent request
 */
export interface ContributionIntentRequest {
  round_id: string;
  amount: number;
  wallet_address: string;
}

/**
 * Contribution intent response
 */
export interface ContributionIntentResponse {
  intent_id: string;
  round_id: string;
  contract_address?: string; // For EVM
  deposit_address?: string; // For Solana
  amount: number;
  expires_at: string;
}

/**
 * Contribution confirm request
 */
export interface ContributionConfirmRequest {
  round_id: string;
  tx_hash: string;
  amount: number;
  wallet_address: string;
}

/**
 * Admin approve request
 */
export interface ApprovePoolRequest {
  notes?: string;
}

/**
 * Admin reject request
 */
export interface RejectPoolRequest {
  rejection_reason: string;
}

/**
 * Finalize request
 */
export interface FinalizePoolRequest {
  notes?: string;
}

/**
 * Refund claim request
 */
export interface RefundClaimRequest {
  round_id: string;
}

// ============================================
// API Response Types
// ============================================

export interface PoolListResponse {
  pools: LaunchRound[];
  total: number;
  page: number;
  limit: number;
}

export interface PoolDetailsResponse {
  pool: LaunchRoundWithProject;
  user_contribution?: Contribution;
  is_eligible: boolean;
  eligibility_reasons?: string[];
}

export interface ContributionListResponse {
  contributions: Contribution[];
  total_contributed: number;
  user_allocation?: RoundAllocation;
}

export interface RefundQuoteResponse {
  refund_amount: number;
  is_eligible: boolean;
  reason?: string;
  primary_wallet: string | null;
}

export interface PoolStatusResponse {
  status: PoolStatus;
  result: PoolResult;
  total_raised: number;
  total_participants: number;
  time_remaining_seconds: number | null;
  progress_percentage: number;
}

// ============================================
// Pool Statistics
// ============================================

export interface PoolStatistics {
  total_raised: number;
  total_participants: number;
  average_contribution: number;
  progress_percentage: number; // For presale hardcap
  price_per_token: number; // Final price for fairlaunch
  time_status: 'upcoming' | 'live' | 'ended';
  time_remaining_seconds: number | null;
}

// ============================================
// Eligibility Check
// ============================================

export interface PoolEligibilityCheck {
  is_eligible: boolean;
  reasons: string[];
  checks: {
    kyc_verified: boolean;
    sc_scan_passed: boolean;
    pool_live: boolean;
    wallet_connected: boolean;
    min_contribution_met?: boolean;
    max_contribution_not_exceeded?: boolean;
  };
}
