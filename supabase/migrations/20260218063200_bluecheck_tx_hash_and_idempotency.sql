-- Add bluecheck_tx_hash column to profiles for reconciliation
-- This stores the purchase transaction hash for future reference
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bluecheck_tx_hash TEXT;

-- Add unique constraint on fee_splits(source_type, source_id) for idempotent upserts
-- This prevents duplicate fee_split records when verify-purchase is called multiple times
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fee_splits_source_type_source_id_key'
  ) THEN
    ALTER TABLE public.fee_splits
      ADD CONSTRAINT fee_splits_source_type_source_id_key UNIQUE (source_type, source_id);
  END IF;
END $$;

-- Add unique constraint on referral_ledger(source_type, source_id) for idempotent upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_ledger_source_type_source_id_key'
  ) THEN
    ALTER TABLE public.referral_ledger
      ADD CONSTRAINT referral_ledger_source_type_source_id_key UNIQUE (source_type, source_id);
  END IF;
END $$;
