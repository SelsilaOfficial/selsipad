-- Create platform_config table and master referral account
-- Master referral captures all organic users (those without ?ref= code)

-- 1) Platform config table
CREATE TABLE IF NOT EXISTS platform_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Create master referral profile
-- This is the platform's own account that receives referral rewards from organic users
DO $$
DECLARE
  v_master_id UUID;
BEGIN
  -- Check if master referral already exists
  SELECT user_id INTO v_master_id FROM profiles WHERE username = 'selsipad_platform';
  
  IF v_master_id IS NULL THEN
    v_master_id := gen_random_uuid();
    
    INSERT INTO profiles (user_id, username, bluecheck_status)
    VALUES (v_master_id, 'selsipad_platform', 'ACTIVE');
    
    -- Create a wallet entry for the platform account (treasury wallet)
    INSERT INTO wallets (user_id, address, chain, is_primary, wallet_role)
    VALUES (v_master_id, '0x0000000000000000000000000000000000000000', 'EVM_1', true, 'PRIMARY');
  END IF;
  
  -- Store master referral user_id in config
  INSERT INTO platform_config (key, value)
  VALUES ('master_referral_user_id', v_master_id::text)
  ON CONFLICT (key) DO UPDATE SET value = v_master_id::text, updated_at = NOW();
  
  RAISE NOTICE 'Master referral user_id: %', v_master_id;
END $$;

-- 3) Generate referral code for master referral
UPDATE profiles 
SET referral_code = 'SELSIPAD'
WHERE username = 'selsipad_platform' AND referral_code IS NULL;

COMMENT ON TABLE platform_config IS 'Platform-wide configuration (master referral, etc.)';
