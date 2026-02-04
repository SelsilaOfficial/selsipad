-- Migration: 20260126000001_admin_rbac_enforcement.sql
-- Created: 2026-01-26
-- Description: Update admin_roles untuk align dengan Modul 12 specification

-- Update admin_roles CHECK constraint untuk include semua roles dari Modul 12
ALTER TABLE admin_roles DROP CONSTRAINT IF EXISTS admin_roles_role_check;
ALTER TABLE admin_roles ADD CONSTRAINT admin_roles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'kyc_reviewer', 'moderator', 'finance', 'reviewer', 'ops', 'support'));

COMMENT ON COLUMN admin_roles.role IS 'Admin role types: super_admin, admin, kyc_reviewer, moderator, finance, reviewer, ops, support';

-- Clear existing permission data (kita akan re-seed)
TRUNCATE TABLE admin_permissions;

-- Seed full permission matrix dari Modul 12
INSERT INTO admin_permissions (role, permission, description) VALUES
  -- Super Admin (all permissions)
  ('super_admin', '*', 'All permissions'),
  
  -- Admin role (general admin - approves KYC, manages projects, moderates, issues badges)
  ('admin', 'kyc:view', 'View KYC submissions'),
  ('admin', 'kyc:review', 'Approve/reject KYC'),
  ('admin', 'project:view', 'View all projects'),
  ('admin', 'project:approve', 'Approve projects for listing'),
  ('admin', 'project:reject', 'Reject projects'),
  ('admin', 'badge:view', 'View all badges'),
  ('admin', 'badge:grant', 'Grant badges manually'),
  ('admin', 'badge:revoke', 'Revoke badges'),
  ('admin', 'user:view', 'View user details'),
  ('admin', 'user:ban', 'Ban/unban users'),
  ('admin', 'post:moderate', 'Moderate social feed posts'),
  
  -- KYC Reviewer (read-only KYC access, no treasury/edit permissions)
  ('kyc_reviewer', 'kyc:view', 'View KYC submissions'),
  ('kyc_reviewer', 'kyc:review', 'Approve/reject KYC'),
  ('kyc_reviewer', 'scan:view', 'View smart contract scans'),
  
  -- Moderator (social feed moderation and user bans)
  ('moderator', 'post:view', 'View all posts'),
  ('moderator', 'post:moderate', 'Moderate social feed posts'),
  ('moderator', 'post:delete', 'Delete posts'),
  ('moderator', 'user:view', 'View user details'),
  ('moderator', 'user:ban', 'Ban/unban users'),
  
  -- Finance (treasury monitoring, payout approvals)
  ('finance', 'round:view', 'View all rounds'),
  ('finance', 'round:finalize', 'Finalize rounds (mark success/failed)'),
  ('finance', 'payout:view', 'View payout requests'),
  ('finance', 'payout:approve', 'Approve payouts'),
  ('finance', 'treasury:view', 'View treasury balances'),
  ('finance', 'ledger:view', 'View complete ledger'),
  ('finance', 'fee:view', 'View fee rules'),
  
  -- Reviewer (project review and contract audits)
  ('reviewer', 'kyc:view', 'View KYC submissions'),
  ('reviewer', 'kyc:review', 'Approve/reject KYC'),
  ('reviewer', 'scan:view', 'View smart contract scans'),
  ('reviewer', 'scan:review', 'Approve/reject/override SC scans'),
  ('reviewer', 'project:view', 'View all projects'),
  ('reviewer', 'project:approve', 'Approve projects for listing'),
  ('reviewer', 'project:reject', 'Reject projects'),
  
  -- Ops (operational management - pause/cancel projects)
  ('ops', 'project:view', 'View all projects'),
  ('ops', 'project:pause', 'Pause active projects'),
  ('ops', 'project:cancel', 'Cancel projects'),
  ('ops', 'round:view', 'View all rounds'),
  ('ops', 'round:pause', 'Pause active rounds'),
  ('ops', 'user:view', 'View user details'),
  
  -- Support (Blue Check and user support)
  ('support', 'user:view', 'View user profiles'),
  ('support', 'user:ban', 'Ban/unban users'),
  ('support', 'bluecheck:view', 'View Blue Check requests'),
  ('support', 'bluecheck:revoke', 'Revoke Blue Check'),
  ('support', 'post:moderate', 'Moderate social feed posts');

-- Add audit:view permission for all roles (can view audit logs)
INSERT INTO admin_permissions (role, permission, description) VALUES
  ('admin', 'audit:view', 'View audit logs'),
  ('kyc_reviewer', 'audit:view', 'View audit logs'),
  ('moderator', 'audit:view', 'View audit logs'),
  ('finance', 'audit:view', 'View audit logs'),
  ('reviewer', 'audit:view', 'View audit logs'),
  ('ops', 'audit:view', 'View audit logs'),
  ('support', 'audit:view', 'View audit logs');

-- Add indexes untuk performance
CREATE INDEX IF NOT EXISTS idx_admin_permissions_role_permission ON admin_permissions(role, permission);

-- Add comments
COMMENT ON TABLE admin_permissions IS 'Permission matrix defining what each admin role can do (Modul 12 spec)';
