-- Add DEPLOYED status to projects table check constraint
-- Allows admin deployment to set status to DEPLOYED

-- Drop old constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add new constraint with DEPLOYED included
ALTER TABLE projects ADD CONSTRAINT projects_status_check 
  CHECK (status IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'LIVE', 'ENDED', 'DEPLOYED'));

-- Add comment
COMMENT ON COLUMN projects.status IS 'Project status: DRAFT → SUBMITTED → IN_REVIEW → APPROVED/REJECTED → DEPLOYED → LIVE → ENDED';
