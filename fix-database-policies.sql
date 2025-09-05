-- Comprehensive Database Policy Fix
-- This addresses the infinite recursion in project_collaborators and other policy issues

-- First, let's disable RLS temporarily to clean up
ALTER TABLE IF EXISTS public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ideas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.team_members DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view project ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can create ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can update ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can delete ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can manage ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can view own teams" ON public.teams;
DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Users can update own teams" ON public.teams;
DROP POLICY IF EXISTS "Users can manage own teams" ON public.teams;

-- Drop project_collaborators policies if they exist
DROP POLICY IF EXISTS "Users can view project collaborations" ON public.project_collaborators;
DROP POLICY IF EXISTS "Users can manage project collaborations" ON public.project_collaborators;
DROP POLICY IF EXISTS "Project owners can manage collaborators" ON public.project_collaborators;

-- Create project_collaborators table if it doesn't exist
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

-- Create team_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.team_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    invited_by uuid REFERENCES auth.users(id),
    status text DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(team_id, user_id)
);

-- Now create SIMPLE, non-recursive policies

-- Projects: Users can only manage their own projects (no joins to avoid recursion)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_owner_access" ON public.projects
    FOR ALL 
    USING (owner_id = auth.uid());

-- Ideas: Users can manage ideas in their own projects OR ideas without projects
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ideas_access" ON public.ideas
    FOR ALL 
    USING (
        project_id IS NULL 
        OR owner_id = auth.uid()
        OR project_id IN (
            SELECT id FROM public.projects WHERE owner_id = auth.uid()
        )
    );

-- Teams: Users can only manage their own teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_owner_access" ON public.teams
    FOR ALL 
    USING (owner_id = auth.uid());

-- Project collaborators: Simple policy without recursion
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_collaborators_access" ON public.project_collaborators
    FOR ALL 
    USING (
        user_id = auth.uid()
        OR project_id IN (
            SELECT id FROM public.projects WHERE owner_id = auth.uid()
        )
    );

-- Team members: Simple policy without recursion
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_members_access" ON public.team_members
    FOR ALL 
    USING (
        user_id = auth.uid()
        OR team_id IN (
            SELECT id FROM public.teams WHERE owner_id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON public.project_collaborators TO authenticated;
GRANT ALL ON public.team_members TO authenticated;

-- Ensure the ideas table has the owner_id column for the policy
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideas' 
        AND column_name = 'owner_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ideas ADD COLUMN owner_id uuid REFERENCES auth.users(id);
    END IF;
END $$;