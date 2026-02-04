-- Migration: 20260126000002_fix_audit_logs_table.sql
-- Created: 2026-01-26
-- Description: Fix admin_audit_logs FK and add before_data column for wallet-only auth

-- Issue: admin_audit_logs.actor_admin_id references auth.users, but we use wallet-only auth now
-- Fix: Change FK to reference profiles(user_id) instead

-- Step 1: Drop existing FK constraint
ALTER TABLE admin_audit_logs 
  DROP CONSTRAINT IF EXISTS admin_audit_logs_actor_admin_id_fkey;

-- Step 2: Add new FK pointing to profiles
ALTER TABLE admin_audit_logs 
  ADD CONSTRAINT admin_audit_logs_actor_admin_id_fkey 
  FOREIGN KEY (actor_admin_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- Step 3: Add before_data column for proper audit trail
ALTER TABLE admin_audit_logs 
  ADD COLUMN IF NOT EXISTS before_data JSONB;

-- Step 4: Rename metadata to after_data for clarity
ALTER TABLE admin_audit_logs 
  RENAME COLUMN metadata TO after_data;

-- Step 5: Add IP address and user agent for security tracking
ALTER TABLE admin_audit_logs 
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE admin_audit_logs 
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add comments
COMMENT ON COLUMN admin_audit_logs.actor_admin_id IS 'Admin user_id from profiles table';
COMMENT ON COLUMN admin_audit_logs.before_data IS 'Entity state before action (JSON)';
COMMENT ON COLUMN admin_audit_logs.after_data IS 'Entity state after action (JSON)';
COMMENT ON COLUMN admin_audit_logs.ip_address IS 'IP address of admin when action performed';
COMMENT ON COLUMN admin_audit_logs.user_agent IS 'User agent string of admin browser';

-- Create index on IP for security monitoring
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_ip ON admin_audit_logs(ip_address);
