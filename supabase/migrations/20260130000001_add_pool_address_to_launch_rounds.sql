-- Migration: Add pool_address field to launch_rounds table
-- Created: 2026-01-30
-- Description: Add pool_address to track DEX LP pool address after finalization

ALTER TABLE launch_rounds
ADD COLUMN pool_address TEXT;

COMMENT ON COLUMN launch_rounds.pool_address IS 'DEX liquidity pool contract address (created after finalization)';

-- Create index for pool_address lookups
CREATE INDEX idx_rounds_pool_address ON launch_rounds(pool_address) WHERE pool_address IS NOT NULL;
