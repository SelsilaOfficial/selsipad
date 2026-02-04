-- Fix referral_relationships foreign keys to point to profiles instead of auth.users
-- This is required because Selsipad uses a wallet-only auth system with custom profiles table

-- Step 1: Drop existing foreign key constraints
ALTER TABLE referral_relationships
  DROP CONSTRAINT IF EXISTS referral_relationships_referrer_id_fkey,
  DROP CONSTRAINT IF EXISTS referral_relationships_referee_id_fkey;

-- Step 2: Add new foreign keys pointing to profiles.user_id
ALTER TABLE referral_relationships
  ADD CONSTRAINT referral_relationships_referrer_id_fkey 
    FOREIGN KEY (referrer_id) 
    REFERENCES profiles(user_id) 
    ON DELETE CASCADE;

ALTER TABLE referral_relationships
  ADD CONSTRAINT referral_relationships_referee_id_fkey 
    FOREIGN KEY (referee_id) 
    REFERENCES profiles(user_id) 
    ON DELETE CASCADE;

-- Add comment to clarify the fix
COMMENT ON CONSTRAINT referral_relationships_referrer_id_fkey ON referral_relationships
  IS 'FK to profiles.user_id (wallet-only auth system)';
  
COMMENT ON CONSTRAINT referral_relationships_referee_id_fkey ON referral_relationships
  IS 'FK to profiles.user_id (wallet-only auth system)';
