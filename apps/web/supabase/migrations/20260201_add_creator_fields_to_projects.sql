-- Add creator_id and creator_wallet columns to projects table
-- Required for linking projects to users in the Hybrid Admin Deployment

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS creator_wallet TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_projects_creator_id ON projects(creator_id);
CREATE INDEX IF NOT EXISTS idx_projects_creator_wallet ON projects(creator_wallet);

-- Add comments
COMMENT ON COLUMN projects.creator_id IS 'Reference to auth.users id';
COMMENT ON COLUMN projects.creator_wallet IS 'Wallet address of the project creator';
