-- =====================================================
-- FASE 7 Patch: EVM Bonding Curve Adjustments
-- =====================================================
-- Description: Modifies the bonding_pools schema to support EVM token launches
-- without forcing pre-created projects (which was mandatory for Solana pools).
-- =====================================================

-- 1. Loosen `bonding_pools` strictness to support UI-deployed EVM tokens
ALTER TABLE bonding_pools 
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN creator_id DROP NOT NULL,
  ALTER COLUMN virtual_sol_reserves DROP NOT NULL,
  ALTER COLUMN virtual_token_reserves DROP NOT NULL;

-- 2. Expand constraint definitions
-- Existing constraint `bonding_pools_token_mint_key` needs to tolerate EVM addresses instead of specifically "solana token mints"
-- But `token_mint` is just a TEXT column with UNIQUE constraint, so it supports EVM addresses fine natively. We just rename the column conceptually in docs (or leave as is to avoid breaking SOL side).

-- 3. Enhance RLS Policy to allow unauthenticated indexer inserts to fail gracefully or Service Role
-- The existing rule `bonding_pools_insert` checks `auth.uid() = creator_id`.
-- The EVM Indexer operates using a Service Role key, so it bypasses RLS naturally. 

-- Note: We do NOT modify standard presale, fairlaunch, or blue_check logic.
