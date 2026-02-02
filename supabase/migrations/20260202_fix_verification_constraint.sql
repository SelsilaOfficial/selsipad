-- Fix verification_status constraint to include NOT_VERIFIED
-- This drops the old constraint and creates a new one with correct values

-- Drop existing constraint
ALTER TABLE launch_rounds 
  DROP CONSTRAINT IF EXISTS launch_rounds_verification_status_check;

-- Add correct constraint
ALTER TABLE launch_rounds
  ADD CONSTRAINT launch_rounds_verification_status_check 
  CHECK (verification_status IN (
    'NOT_VERIFIED',
    'VERIFICATION_PENDING',
    'VERIFICATION_QUEUED',
    'VERIFIED',
    'VERIFICATION_FAILED'
  ));
