-- Add token_address to projects table
-- Required for linking the project to its ERC20 token

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS token_address TEXT;

-- Add index
CREATE INDEX IF NOT EXISTS idx_projects_token_address ON projects(token_address);

-- Add comment
COMMENT ON COLUMN projects.token_address IS 'Address of the project token (ERC20)';
