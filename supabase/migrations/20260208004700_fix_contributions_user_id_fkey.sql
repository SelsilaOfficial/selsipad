-- Fix contributions.user_id FK constraint
-- Problem: user_id references auth.users(id) but app uses Pattern 68 (wallet-only auth)
-- where userId comes from profiles.user_id, NOT auth.users.id
-- Also: user_id was NOT NULL but wallet-only contributors may not have a session

-- 1. Drop the old FK constraint referencing auth.users
ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_user_id_fkey;

-- 2. Make user_id nullable (wallet-only auth may not have session)
ALTER TABLE contributions ALTER COLUMN user_id DROP NOT NULL;

-- 3. Add new FK referencing profiles(user_id) instead
ALTER TABLE contributions
  ADD CONSTRAINT contributions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;

-- 4. Add comment for clarity
COMMENT ON COLUMN contributions.user_id IS 'User ID from profiles.user_id - nullable for wallet-only auth';
