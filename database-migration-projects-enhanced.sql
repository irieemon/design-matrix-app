-- Drop existing projects table if it exists (be careful in production!)
DROP TABLE IF EXISTS public.projects;

-- Create enhanced projects table
CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    project_type text NOT NULL CHECK (project_type IN ('software', 'business_plan', 'product_development', 'marketing', 'operations', 'research', 'other')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
    start_date date,
    target_date date,
    budget numeric(12,2),
    team_size integer,
    priority_level text NOT NULL DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
    tags text[], -- Array of tags
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_ai_generated boolean DEFAULT false,
    ai_analysis jsonb -- Store AI analysis as JSON
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (you can make this more restrictive later)
CREATE POLICY "Allow all operations on projects" ON public.projects
    FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX idx_projects_created_by ON public.projects(created_by);
CREATE INDEX idx_projects_type ON public.projects(project_type);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_priority ON public.projects(priority_level);
CREATE INDEX idx_projects_tags ON public.projects USING GIN(tags);

-- Add a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add a relationship between ideas and projects
ALTER TABLE public.ideas 
ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- Create index for the project_id foreign key
CREATE INDEX idx_ideas_project_id ON public.ideas(project_id);