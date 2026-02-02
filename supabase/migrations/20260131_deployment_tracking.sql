-- Migration: 20260131_deployment_tracking.sql
-- Created: 2026-01-31
-- Description: Add deployment and verification tracking fields for direct deployment architecture

-- ============================================
-- DEPLOYMENT STATUS ENUM
-- ============================================

-- Add deployment status field to track deployment lifecycle
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS deployment_status TEXT DEFAULT 'NOT_DEPLOYED' 
  CHECK (deployment_status IN (
    'NOT_DEPLOYED',      -- Initial state (using Factory)
    'DEPLOYING',         -- Deployment transaction pending
    'DEPLOYED',          -- Contract deployed successfully
    'DEPLOYMENT_FAILED', -- Deployment failed
    'PENDING_FUNDING',   -- Deployed, waiting for user to send tokens
    'FUNDED',            -- Tokens sent to contract
    'READY'              -- Ready for launch (deployed + funded + verified)
  ));

COMMENT ON COLUMN launch_rounds.deployment_status IS 'Tracks deployment lifecycle for direct deployment architecture';

-- ============================================
-- VERIFICATION STATUS ENUM
-- ============================================

-- Add verification status field
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'NOT_VERIFIED'
  CHECK (verification_status IN (
    'NOT_VERIFIED',        -- Not yet verified
    'VERIFICATION_PENDING', -- Submitted to block explorer
    'VERIFICATION_QUEUED',  -- In verification queue
    'VERIFIED',            -- Successfully verified on block explorer
    'VERIFICATION_FAILED'  -- Verification failed (non-blocking)
  ));

COMMENT ON COLUMN launch_rounds.verification_status IS 'Tracks verification status on block explorer';

-- ============================================
-- DEPLOYMENT METADATA FIELDS
-- ============================================

-- Add deployer transaction hash
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS deployment_tx_hash TEXT;

COMMENT ON COLUMN launch_rounds.deployment_tx_hash IS 'Transaction hash of contract deployment';

-- Add deployment block number
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS deployment_block_number BIGINT;

COMMENT ON COLUMN launch_rounds.deployment_block_number IS 'Block number where contract was deployed';

-- Add deployer wallet address
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS deployer_address TEXT;

COMMENT ON COLUMN launch_rounds.deployer_address IS 'Platform deployer wallet address that deployed the contract';

-- Add deployment timestamp
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMPTZ;

COMMENT ON COLUMN launch_rounds.deployed_at IS 'Timestamp when contract was successfully deployed';

-- ============================================
-- VERIFICATION METADATA FIELDS
-- ============================================

-- Add verification GUID (from block explorer API)
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS verification_guid TEXT;

COMMENT ON COLUMN launch_rounds.verification_guid IS 'Block explorer verification GUID for status tracking';

-- Add verified timestamp
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

COMMENT ON COLUMN launch_rounds.verified_at IS 'Timestamp when contract was verified on block explorer';

-- Add verification attempts counter
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0;

COMMENT ON COLUMN launch_rounds.verification_attempts IS 'Number of verification attempts (max 3)';

-- Add verification error message
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS verification_error TEXT;

COMMENT ON COLUMN launch_rounds.verification_error IS 'Last verification error message if failed';

-- ============================================
-- FUNDING TRACKING FIELDS
-- ============================================

-- Add token funding status
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS tokens_funded_at TIMESTAMPTZ;

COMMENT ON COLUMN launch_rounds.tokens_funded_at IS 'Timestamp when tokens were sent to deployed contract';

-- Add token funding transaction hash
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS funding_tx_hash TEXT;

COMMENT ON COLUMN launch_rounds.funding_tx_hash IS 'Transaction hash of token funding to contract';

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for deployment status queries
CREATE INDEX IF NOT EXISTS idx_rounds_deployment_status 
  ON launch_rounds(deployment_status);

-- Index for verification status queries
CREATE INDEX IF NOT EXISTS idx_rounds_verification_status 
  ON launch_rounds(verification_status);

-- Index for deployment tx hash lookups
CREATE INDEX IF NOT EXISTS idx_rounds_deployment_tx 
  ON launch_rounds(deployment_tx_hash);

-- Composite index for pending verifications
CREATE INDEX IF NOT EXISTS idx_rounds_pending_verification 
  ON launch_rounds(verification_status, deployed_at) 
  WHERE verification_status IN ('NOT_VERIFIED', 'VERIFICATION_PENDING', 'VERIFICATION_QUEUED');

-- Composite index for active deployments
CREATE INDEX IF NOT EXISTS idx_rounds_active_deployments 
  ON launch_rounds(deployment_status, created_at) 
  WHERE deployment_status IN ('DEPLOYING', 'DEPLOYED', 'PENDING_FUNDING');

-- ============================================
-- UPDATE TRIGGER FOR AUTO-TIMESTAMPS
-- ============================================

-- Function to auto-update verified_at timestamp
CREATE OR REPLACE FUNCTION update_verified_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_status = 'VERIFIED' AND OLD.verification_status != 'VERIFIED' THEN
    NEW.verified_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on verification status change
DROP TRIGGER IF EXISTS trigger_update_verified_at ON launch_rounds;
CREATE TRIGGER trigger_update_verified_at
  BEFORE UPDATE ON launch_rounds
  FOR EACH ROW
  WHEN (NEW.verification_status IS DISTINCT FROM OLD.verification_status)
  EXECUTE FUNCTION update_verified_at_timestamp();

-- Function to auto-update deployment_status based on fields
CREATE OR REPLACE FUNCTION auto_update_deployment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If contract address is set and deployed_at is set, mark as DEPLOYED
  IF NEW.contract_address IS NOT NULL 
     AND NEW.deployed_at IS NOT NULL 
     AND NEW.deployment_status = 'NOT_DEPLOYED' THEN
    NEW.deployment_status = 'PENDING_FUNDING';
  END IF;
  
  -- If tokens are funded, update status
  IF NEW.tokens_funded_at IS NOT NULL 
     AND NEW.deployment_status = 'PENDING_FUNDING' THEN
    NEW.deployment_status = 'FUNDED';
  END IF;
  
  -- If funded and verified, mark as READY
  IF NEW.deployment_status = 'FUNDED' 
     AND NEW.verification_status = 'VERIFIED' THEN
    NEW.deployment_status = 'READY';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-status updates
DROP TRIGGER IF EXISTS trigger_auto_deployment_status ON launch_rounds;
CREATE TRIGGER trigger_auto_deployment_status
  BEFORE INSERT OR UPDATE ON launch_rounds
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_deployment_status();

-- ============================================
-- VIEWS FOR MONITORING
-- ============================================

-- View for pending verifications (for admin dashboard)
CREATE OR REPLACE VIEW pending_verifications AS
SELECT 
  id,
  contract_address,
  chain,
  deployment_status,
  verification_status,
  verification_attempts,
  verification_error,
  deployed_at,
  created_at
FROM launch_rounds
WHERE verification_status IN ('NOT_VERIFIED', 'VERIFICATION_PENDING', 'VERIFICATION_QUEUED')
  AND contract_address IS NOT NULL
ORDER BY deployed_at DESC;

COMMENT ON VIEW pending_verifications IS 'Active contracts awaiting verification';

-- View for deployment monitoring
CREATE OR REPLACE VIEW deployment_pipeline AS
SELECT 
  id,
  type,
  contract_address,
  chain,
  deployment_status,
  verification_status,
  deployer_address,
  deployment_tx_hash,
  deployed_at,
  verified_at,
  tokens_funded_at,
  created_at
FROM launch_rounds
WHERE deployment_status != 'NOT_DEPLOYED'
ORDER BY created_at DESC;

COMMENT ON VIEW deployment_pipeline IS 'Overview of all direct deployments';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant access to authenticated users
GRANT SELECT ON pending_verifications TO authenticated;
GRANT SELECT ON deployment_pipeline TO authenticated;

-- Grant admin full access
GRANT ALL ON pending_verifications TO service_role;
GRANT ALL ON deployment_pipeline TO service_role;
