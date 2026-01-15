-- Disable RLS on AMA tables for wallet-only auth
-- Application will handle permissions

ALTER TABLE ama_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE ama_join_tokens DISABLE ROW LEVEL SECURITY;

-- Drop old RLS policies that reference auth.uid()
DROP POLICY IF EXISTS ama_sessions_public_read ON ama_sessions;
DROP POLICY IF EXISTS ama_sessions_own_manage ON ama_sessions;
DROP POLICY IF EXISTS ama_sessions_admin_all ON ama_sessions;
DROP POLICY IF EXISTS ama_join_tokens_own_read ON ama_join_tokens;
DROP POLICY IF EXISTS ama_join_tokens_system_insert ON ama_join_tokens;

-- Remove FK constraints to auth.users for wallet-only auth
ALTER TABLE ama_sessions DROP CONSTRAINT IF EXISTS ama_sessions_host_id_fkey;
ALTER TABLE ama_join_tokens DROP CONSTRAINT IF EXISTS ama_join_tokens_user_id_fkey;

-- Update comments
COMMENT ON COLUMN ama_sessions.host_id IS 'Developer/creator user_id (references profiles.user_id)';
COMMENT ON COLUMN ama_join_tokens.user_id IS 'Participant user_id (references profiles.user_id)';
