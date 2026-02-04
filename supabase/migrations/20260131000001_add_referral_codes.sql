-- Add referral_code to profiles table for Modul 10: Referral & Reward System
-- Each user gets a unique, human-readable referral code

-- Add referral_code column (nullable for existing users)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code) WHERE referral_code IS NOT NULL;

-- Add comment
COMMENT ON COLUMN profiles.referral_code IS 'Unique referral code for this user (8 characters, alphanumeric)';

-- Function to generate unique referral codes
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excludes confusing chars: 0,O,I,1
  code TEXT;
  done BOOLEAN;
BEGIN
  done := false;
  
  -- Keep trying until we get a unique code
  WHILE NOT done LOOP
    code := '';
    
    -- Generate 8-character code
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code already exists
    done := NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = code);
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral code on profile creation
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_referral_code();

-- Backfill: Generate codes for existing users (if any)
UPDATE profiles 
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;
