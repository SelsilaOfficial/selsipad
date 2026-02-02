-- Add chain_id column to projects table for multi-chain support
-- This is required for the Hybrid Admin Deployment flow

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS chain_id INTEGER NOT NULL DEFAULT 97;

-- Add index for faster chain-based queries
CREATE INDEX IF NOT EXISTS idx_projects_chain_id ON projects(chain_id);

-- Add comment
COMMENT ON COLUMN projects.chain_id IS 'Blockchain network ID (97=BSC Testnet, 56=BSC, 1=Ethereum, etc)';
