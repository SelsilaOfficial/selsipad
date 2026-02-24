-- =====================================================
-- FASE 7.7: EVM-First Bonding Curve Schema
-- Migration 012
-- =====================================================
-- Description: Rebuilding bonding_pools and bonding_swaps to be chain-agnostic 
--              and support EVM uint256 values natively without BIGINT overflow.
-- =====================================================

BEGIN;

DROP TABLE IF EXISTS bonding_swaps CASCADE;
DROP TABLE IF EXISTS bonding_pools CASCADE;

CREATE TABLE bonding_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  
  -- Token Information
  token_address TEXT NOT NULL UNIQUE, 
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_decimals INTEGER NOT NULL DEFAULT 18,
  total_supply NUMERIC NOT NULL,
  
  -- Bonding Curve AMM Configuration
  virtual_native_reserves NUMERIC NOT NULL DEFAULT 0,
  virtual_token_reserves NUMERIC NOT NULL DEFAULT 0,
  actual_native_reserves NUMERIC NOT NULL DEFAULT 0,
  actual_token_reserves NUMERIC NOT NULL DEFAULT 0,
  
  -- Fees & Thresholds
  deploy_fee_native NUMERIC DEFAULT 0,
  swap_fee_bps INTEGER NOT NULL DEFAULT 150,
  graduation_threshold_native NUMERIC,
  
  -- Lifecycle
  deploy_tx_hash TEXT,
  deploy_tx_verified BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'LIVE' CHECK (status IN ('DRAFT', 'DEPLOYING', 'LIVE', 'GRADUATING', 'GRADUATED', 'FAILED', 'PAUSED')),
  failure_reason TEXT,
  
  -- DEX Migration
  target_dex TEXT,
  dex_pool_address TEXT, 
  migration_tx_hash TEXT,
  
  -- General
  chain_id INTEGER,
  creator_wallet TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deployed_at TIMESTAMPTZ,
  graduated_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bonding_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES bonding_pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  
  swap_type TEXT NOT NULL CHECK (swap_type IN ('BUY', 'SELL')),
  input_amount NUMERIC NOT NULL,
  output_amount NUMERIC NOT NULL,
  price_per_token NUMERIC NOT NULL,
  
  swap_fee_amount NUMERIC NOT NULL DEFAULT 0,
  treasury_fee NUMERIC NOT NULL DEFAULT 0,
  referral_pool_fee NUMERIC NOT NULL DEFAULT 0,
  referrer_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  
  tx_hash TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  
  native_reserves_before NUMERIC DEFAULT 0,
  token_reserves_before NUMERIC DEFAULT 0,
  native_reserves_after NUMERIC DEFAULT 0,
  token_reserves_after NUMERIC DEFAULT 0,
  
  chain_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Re-apply RLS
ALTER TABLE bonding_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonding_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY bonding_pools_select ON bonding_pools FOR SELECT USING (true);
CREATE POLICY bonding_swaps_select ON bonding_swaps FOR SELECT USING (true);

COMMIT;
