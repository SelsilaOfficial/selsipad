-- Migration: Enforce EVM-Primary Wallet Architecture
-- Date: 2026-01-21
-- Purpose: Make EVM wallet mandatory primary, Solana optional secondary

-- ============================================
-- STEP 1: Add wallet_role column
-- ============================================
ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS wallet_role text DEFAULT 'SECONDARY'
CHECK (wallet_role IN ('PRIMARY', 'SECONDARY'));

-- ============================================
-- STEP 2: Set all existing EVM wallets as PRIMARY
-- ============================================
UPDATE wallets
SET wallet_role = 'PRIMARY'
WHERE chain LIKE 'EVM_%';

-- ============================================
-- STEP 3: Set all Solana wallets as SECONDARY
-- ============================================
UPDATE wallets
SET wallet_role = 'SECONDARY'
WHERE chain = 'SOLANA';

-- ============================================
-- STEP 4: Delete users with ONLY Solana wallet (test data)
-- This will CASCADE delete related data:
-- - wallets (ON DELETE CASCADE)
-- - auth_sessions (ON DELETE CASCADE from wallet_id FK)
-- - other user data
-- ============================================
DELETE FROM profiles
WHERE user_id IN (
  SELECT DISTINCT user_id
  FROM wallets
  WHERE chain = 'SOLANA'
    AND user_id NOT IN (
      SELECT user_id FROM wallets WHERE chain LIKE 'EVM_%'
    )
);

-- ============================================
-- STEP 5: Add constraint - one PRIMARY per user
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_wallet
ON wallets(user_id)
WHERE wallet_role = 'PRIMARY';

-- ============================================
-- STEP 6: Add constraint - PRIMARY must be EVM
-- Only check when inserting/updating PRIMARY wallets
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enforce_evm_primary'
  ) THEN
    ALTER TABLE wallets
    ADD CONSTRAINT enforce_evm_primary
    CHECK (
      (wallet_role = 'PRIMARY' AND chain LIKE 'EVM_%') OR
      (wallet_role = 'SECONDARY')
    );
  END IF;
END $$;

-- ============================================
-- STEP 7: Create helper function to get primary wallet
-- ============================================
CREATE OR REPLACE FUNCTION get_primary_wallet(p_user_id uuid)
RETURNS TABLE (
  wallet_id uuid,
  address text,
  chain text
) AS $$
BEGIN
  RETURN QUERY
  SELECT id, address, chain
  FROM wallets
  WHERE user_id = p_user_id
    AND wallet_role = 'PRIMARY'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 8: Add index for faster wallet_role lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_wallets_role ON wallets(wallet_role);

-- ============================================
-- STEP 9: Add comments for documentation
-- ============================================
COMMENT ON COLUMN wallets.wallet_role IS 'Wallet role: PRIMARY (EVM, identity) or SECONDARY (feature-specific like Solana)';
COMMENT ON FUNCTION get_primary_wallet IS 'Get the primary (EVM) wallet for a user';
