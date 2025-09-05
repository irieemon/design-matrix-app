-- Simple Database Fix - No Complex Policies
-- This creates the minimal setup needed for the app to work

-- Disable RLS temporarily to clean up
ALTER TABLE IF EXISTS public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ideas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_collaborators DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
DROP POLICY IF EXISTS "projects_owner_access" ON public.projects;

DROP POLICY IF EXISTS "Users can view project ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can create ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can update ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can delete ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can manage ideas" ON public.ideas;
DROP POLICY IF EXISTS "ideas_access" ON public.ideas;

DROP POLICY IF EXISTS "Users can view own teams" ON public.teams;
DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Users can update own teams" ON public.teams;
DROP POLICY IF EXISTS "Users can manage own teams" ON public.teams;
DROP POLICY IF EXISTS "teams_owner_access" ON public.teams;

DROP POLICY IF EXISTS "Users can view project collaborations" ON public.project_collaborators;
DROP POLICY IF EXISTS "Users can manage project collaborations" ON public.project_collaborators;
DROP POLICY IF EXISTS "Project owners can manage collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "project_collaborators_access" ON public.project_collaborators;

-- Create missing tables
CREATE TABLE IF NOT EXISTS public.project_collaborators (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    invited_by uuid REFERENCES auth.users(id),
    status text DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(project_id, user_id)
);

-- SIMPLE APPROACH: Enable RLS but allow all authenticated users to access everything
-- This removes the infinite recursion but still requires authentication

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_users_projects" ON public.projects
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_users_ideas" ON public.ideas
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_users_teams" ON public.teams
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_users_collaborators" ON public.project_collaborators
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.projects TO authenticated;
GRANT ALL ON public.ideas TO authenticated;
GRANT ALL ON public.teams TO authenticated;
GRANT ALL ON public.project_collaborators TO authenticated;