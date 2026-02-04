-- Migration: Add security badge columns for Fairlaunch SC scan gating
-- Adds columns to track security badges from automated smart contract scanning
-- These badges are displayed on live Fairlaunch pages for retail investor confidence

-- Add security badge columns to launch_rounds table
ALTER TABLE launch_rounds ADD COLUMN IF NOT EXISTS is_platform_token BOOLEAN DEFAULT false;
ALTER TABLE launch_rounds ADD COLUMN IF NOT EXISTS safu_verified BOOLEAN DEFAULT false;
ALTER TABLE launch_rounds ADD COLUMN IF NOT EXISTS no_mint BOOLEAN DEFAULT false;
ALTER TABLE launch_rounds ADD COLUMN IF NOT EXISTS no_pause BOOLEAN DEFAULT false;
ALTER TABLE launch_rounds ADD COLUMN IF NOT EXISTS no_tax_modification BOOLEAN DEFAULT false;
ALTER TABLE launch_rounds ADD COLUMN IF NOT EXISTS no_honeypot BOOLEAN DEFAULT false;

-- Add column for team vesting contract address
ALTER TABLE launch_rounds ADD COLUMN IF NOT EXISTS team_vesting_address TEXT;

-- Add index for platform token filtering
CREATE INDEX IF NOT EXISTS idx_launch_rounds_platform_token ON launch_rounds(is_platform_token) WHERE is_platform_token = true;

-- Add index for security badge filtering (only show verified projects)
CREATE INDEX IF NOT EXISTS idx_launch_rounds_security ON launch_rounds(no_mint, no_pause, no_tax_modification, no_honeypot) 
  WHERE no_mint = true AND no_pause = true AND no_tax_modification = true AND no_honeypot = true;

-- Comments for documentation
COMMENT ON COLUMN launch_rounds.is_platform_token IS 'True if token was created via platform templates (auto-passes security scan)';
COMMENT ON COLUMN launch_rounds.safu_verified IS 'True if token has SAFU badge (platform-verified template)';
COMMENT ON COLUMN launch_rounds.no_mint IS 'True if token has no mint function that can inflate supply';
COMMENT ON COLUMN launch_rounds.no_pause IS 'True if token cannot pause trading';
COMMENT ON COLUMN launch_rounds.no_tax_modification IS 'True if token tax is locked and cannot be changed';
COMMENT ON COLUMN launch_rounds.no_honeypot IS 'True if token has no sell restrictions or blacklist';
COMMENT ON COLUMN launch_rounds.team_vesting_address IS 'Address of TeamVesting.sol contract (if team allocation exists)';
