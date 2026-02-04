-- Migration: Add Escrow and Admin Deployment Support to launch_rounds
-- Date: 2026-02-01
-- Description: Add columns for token escrow, creation fee tracking, and admin deployment info

BEGIN;

-- Add escrow tracking columns
ALTER TABLE launch_rounds
ADD COLUMN IF NOT EXISTS escrow_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS escrow_amount NUMERIC(78, 0),
ADD COLUMN IF NOT EXISTS creation_fee_paid NUMERIC(78, 0),
ADD COLUMN IF NOT EXISTS creation_fee_tx_hash TEXT;

-- Add admin deployment tracking
ALTER TABLE launch_rounds  
ADD COLUMN IF NOT EXISTS admin_deployer_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- Add new status values to enum
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'PENDING_DEPLOY';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'FINALIZED';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_launch_rounds_escrow_tx ON launch_rounds(escrow_tx_hash);
CREATE INDEX IF NOT EXISTS idx_launch_rounds_admin_deployer ON launch_rounds(admin_deployer_id);
CREATE INDEX IF NOT EXISTS idx_launch_rounds_deployed_at ON launch_rounds(deployed_at);

-- Add comments for documentation
COMMENT ON COLUMN launch_rounds.escrow_tx_hash IS 'Transaction hash when tokens were escrowed';
COMMENT ON COLUMN launch_rounds.escrow_amount IS 'Amount of tokens in escrow (in wei)';
COMMENT ON COLUMN launch_rounds.creation_fee_paid IS 'Creation fee paid in native token (in wei)';
COMMENT ON COLUMN launch_rounds.creation_fee_tx_hash IS 'Transaction hash for creation fee payment';
COMMENT ON COLUMN launch_rounds.admin_deployer_id IS 'Profile ID of admin who deployed the contract';
COMMENT ON COLUMN launch_rounds.deployed_at IS 'Timestamp when admin deployed the contract';
COMMENT ON COLUMN launch_rounds.paused_at IS 'Timestamp when project was paused by admin';
COMMENT ON COLUMN launch_rounds.pause_reason IS 'Reason for pausing the project';

COMMIT;
