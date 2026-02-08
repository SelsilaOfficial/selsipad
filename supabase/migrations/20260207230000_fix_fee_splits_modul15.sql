-- Fix fee_splits schema to align with Modul 15 fee distribution
-- Currently has hardcoded 70/30 CHECK constraints that block variable splits

-- 1) Add staking_pool_amount column (for SBT staking 0.5% from presale/fairlaunch)
ALTER TABLE fee_splits ADD COLUMN IF NOT EXISTS staking_pool_amount NUMERIC(78, 0) DEFAULT 0;

-- 2) Drop hardcoded 70/30 CHECK constraints
-- These constraint names may vary - drop by checking existing constraints
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'public.fee_splits'::regclass 
    AND contype = 'c'
    AND conname LIKE '%check%'
  )
  LOOP
    EXECUTE 'ALTER TABLE fee_splits DROP CONSTRAINT IF EXISTS ' || r.conname;
  END LOOP;
END $$;

-- 3) Re-add required constraints (flexible, no hardcoded percentages)
ALTER TABLE fee_splits ADD CONSTRAINT fee_splits_total_positive CHECK (total_amount > 0);
ALTER TABLE fee_splits ADD CONSTRAINT fee_splits_treasury_positive CHECK (treasury_amount >= 0);
ALTER TABLE fee_splits ADD CONSTRAINT fee_splits_referral_positive CHECK (referral_pool_amount >= 0);
ALTER TABLE fee_splits ADD CONSTRAINT fee_splits_staking_positive CHECK (COALESCE(staking_pool_amount, 0) >= 0);
ALTER TABLE fee_splits ADD CONSTRAINT fee_splits_sum_check 
  CHECK (treasury_amount + referral_pool_amount + COALESCE(staking_pool_amount, 0) = total_amount);

-- Update comments
COMMENT ON TABLE fee_splits IS 'Fee distribution: variable splits per source type (Modul 15)';
COMMENT ON COLUMN fee_splits.staking_pool_amount IS 'SBT staking pool share (10% of fee for presale/fairlaunch)';
COMMENT ON COLUMN fee_splits.treasury_amount IS 'Treasury share (varies by source type)';
COMMENT ON COLUMN fee_splits.referral_pool_amount IS 'Referral pool share (varies by source type)';
