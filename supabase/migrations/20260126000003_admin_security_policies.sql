-- Migration: 20260126000003_admin_security_policies.sql
-- Created: 2026-01-26
-- Description: RLS policies untuk admin security (deny-by-default, RBAC enforcement)

-- ============================================================
-- admin_audit_logs: Append-only, RBAC-based read access
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admin audit logs are append-only" ON admin_audit_logs;
DROP POLICY IF EXISTS "Admin can view audit logs" ON admin_audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON admin_audit_logs;

-- Policy 1: Service role can insert (append-only)
CREATE POLICY "Service role can insert audit logs"
ON admin_audit_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy 2: Admins with audit:view permission can read
CREATE POLICY "Admin can view audit logs with permission"
ON admin_audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_roles ar
    JOIN admin_permissions ap ON ap.role = ar.role
    WHERE ar.user_id = auth.uid()
    AND (ap.permission = 'audit:view' OR ap.permission = '*')
  )
);

-- Policy 3: NO UPDATE OR DELETE (append-only enforcement)
-- This is enforced by not creating any UPDATE/DELETE policies

COMMENT ON TABLE admin_audit_logs IS 'Audit trail for admin actions (append-only, cannot be modified)';

-- ============================================================
-- kyc_submissions: RBAC-based access
-- ============================================================

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "KYC reviewers can view submissions" ON kyc_submissions;
DROP POLICY IF EXISTS "KYC reviewers can update submissions" ON kyc_submissions;

-- Policy: Only users with kyc:view permission can read
CREATE POLICY "RBAC: KYC view permission required"
ON kyc_submissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_roles ar
    JOIN admin_permissions ap ON ap.role = ar.role
    WHERE ar.user_id = auth.uid()
    AND (ap.permission = 'kyc:view' OR ap.permission = '*')
  )
);

-- Policy: Only users with kyc:review permission can update
CREATE POLICY "RBAC: KYC review permission required"
ON kyc_submissions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_roles ar
    JOIN admin_permissions ap ON ap.role = ar.role
    WHERE ar.user_id = auth.uid()
    AND (ap.permission = 'kyc:review' OR ap.permission = '*')
  )
);

-- ============================================================
-- admin_roles: Super admin only
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Super admin can manage roles" ON admin_roles;

-- Policy: Only super_admin can view roles
CREATE POLICY "Super admin can view roles"
ON admin_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_roles ar
    WHERE ar.user_id = auth.uid()
    AND ar.role = 'super_admin'
  )
);

-- Note: INSERT/UPDATE/DELETE will be handled via two-man rule API (service role)

-- ============================================================
-- admin_permissions: Read-only for all admins
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view permissions" ON admin_permissions;

-- Policy: All admins can view permission matrix
CREATE POLICY "Admins can view permission matrix"
ON admin_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_roles ar
    WHERE ar.user_id = auth.uid()
  )
);

-- ============================================================
-- admin_actions (two-man rule): RBAC-based access
-- ============================================================

-- Enable RLS if not already enabled
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create actions" ON admin_actions;
DROP POLICY IF EXISTS "Admins can view actions" ON admin_actions;

-- Policy: Admins can create actions (via service role in practice)
CREATE POLICY "Service role can manage actions"
ON admin_actions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Admins can view actions
CREATE POLICY "Admins can view pending actions"
ON admin_actions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_roles ar
    WHERE ar.user_id = auth.uid()
  )
);

-- ============================================================
-- admin_action_approvals: Service role only
-- ============================================================

ALTER TABLE admin_action_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage approvals" ON admin_action_approvals;

CREATE POLICY "Service role can manage approvals"
ON admin_action_approvals FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view approvals"
ON admin_action_approvals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_roles ar
    WHERE ar.user_id = auth.uid()
  )
);
