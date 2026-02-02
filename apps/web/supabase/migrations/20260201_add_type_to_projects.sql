-- Add type column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'FAIRLAUNCH';

-- Add index for filtering by type
CREATE INDEX IF NOT EXISTS idx_projects_type ON public.projects(type);
