-- Migration: 20260131_add_contract_address_to_launch_rounds.sql
-- Created: 2026-01-31
-- Description: Add contract_address column to launch_rounds table for deployed Fairlaunch/Presale contracts

-- Add contract_address column to launch_rounds
ALTER TABLE launch_rounds
  ADD COLUMN IF NOT EXISTS contract_address TEXT;

-- Add index for contract_address lookups
CREATE INDEX IF NOT EXISTS idx_rounds_contract_address ON launch_rounds(contract_address);

-- Add comment
COMMENT ON COLUMN launch_rounds.contract_address IS 'Deployed Fairlaunch or Presale contract address on the specified chain';
