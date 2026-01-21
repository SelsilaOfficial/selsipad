-- Add chain tracking to contributions and referral ledger
-- This enables multi-chain contribution and reward tracking
-- Phase 1 of Multi-Chain Implementation

-- ==============================================
-- CONTRIBUTIONS TABLE
-- ==============================================

-- Add chain column to contributions table
ALTER TABLE contributions 
ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'BSC';

-- Add comment
COMMENT ON COLUMN contributions.chain IS 'Blockchain where contribution was made (BSC, ETHEREUM, SOLANA, etc.)';

-- Create indexes for chain-based queries
CREATE INDEX IF NOT EXISTS idx_contributions_chain ON contributions(chain);
CREATE INDEX IF NOT EXISTS idx_contributions_user_chain ON contributions(user_id, chain);

-- ==============================================
-- REFERRAL LEDGER TABLE
-- ==============================================

-- Add chain column to referral_ledger table
ALTER TABLE referral_ledger 
ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'BSC';

-- Add comment
COMMENT ON COLUMN referral_ledger.chain IS 'Blockchain where reward is claimable (BSC, ETHEREUM, SOLANA, etc.)';

-- Create indexes for chain-based queries
CREATE INDEX IF NOT EXISTS idx_referral_ledger_chain ON referral_ledger(chain);
CREATE INDEX IF NOT EXISTS idx_referral_ledger_referrer_chain ON referral_ledger(referrer_id, chain);
CREATE INDEX IF NOT EXISTS idx_referral_ledger_claimed_chain ON referral_ledger(claimed, chain);

-- ==============================================
-- UPDATE EXISTING DATA
-- ==============================================

-- Update existing referral_ledger records based on source
-- BONDING_CURVE rewards are on Solana, others on BSC
UPDATE referral_ledger
SET chain = CASE 
  WHEN source = 'BONDING_CURVE' THEN 'SOLANA'
  ELSE 'BSC'
END
WHERE chain = 'BSC'; -- Only update records that still have default value

-- Note: Contributions will remain BSC by default
-- New contributions will be recorded with correct chain from round data
