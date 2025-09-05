-- Enhanced Database Schema for Multi-User Authentication System
-- This migration adds proper user management, authentication, and collaboration features

-- First, let's create the auth schema tables that work with Supabase Auth
-- Note: Supabase Auth automatically creates auth.users table, we'll reference it

-- Create user profiles table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email text UNIQUE NOT NULL,
    full_name text,
    avatar_url text,
    company text,
    job_title text,
    timezone text DEFAULT 'UTC',
    notification_preferences jsonb DEFAULT '{"email_notifications": true, "push_notifications": true}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Create teams/organizations table
CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    avatar_url text,
    owner_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team members table (many-to-many relationship)
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    role team_role DEFAULT 'member' NOT NULL,
    invited_by uuid REFERENCES public.user_profiles(id),
    invited_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    joined_at timestamp with time zone,
    UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Update projects table to support teams and collaboration
ALTER TABLE public.projects DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.projects ADD COLUMN owner_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.projects ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN visibility text DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public'));
ALTER TABLE public.projects ADD COLUMN settings jsonb DEFAULT '{}'::jsonb;

-- Project collaborators table
CREATE TYPE project_role AS ENUM ('owner', 'editor', 'commenter', 'viewer');

CREATE TABLE public.project_collaborators (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    role project_role DEFAULT 'viewer' NOT NULL,
    invited_by uuid REFERENCES public.user_profiles(id),
    invited_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    accepted_at timestamp with time zone,
    UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- Update ideas table to track user attribution properly
ALTER TABLE public.ideas DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.ideas DROP COLUMN IF EXISTS editing_by;
ALTER TABLE public.ideas ADD COLUMN created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.ideas ADD COLUMN editing_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Invitation system for email invites
CREATE TYPE invitation_type AS ENUM ('team', 'project');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL,
    type invitation_type NOT NULL,
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    invited_by uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL, -- 'member', 'admin' for teams; 'editor', 'viewer' for projects
    status invitation_status DEFAULT 'pending' NOT NULL,
    token text UNIQUE NOT NULL, -- For secure invitation links
    expires_at timestamp with time zone DEFAULT (timezone('utc'::text, now()) + interval '7 days') NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    accepted_at timestamp with time zone,
    CONSTRAINT valid_invitation_target CHECK (
        (type = 'team' AND team_id IS NOT NULL AND project_id IS NULL) OR
        (type = 'project' AND project_id IS NOT NULL AND team_id IS NULL)
    )
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Activity log for collaboration tracking
CREATE TYPE activity_type AS ENUM ('project_created', 'project_updated', 'idea_created', 'idea_updated', 'idea_deleted', 'user_joined', 'user_invited', 'comment_added');

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    activity_type activity_type NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_project_collaborators_project_id ON public.project_collaborators(project_id);
CREATE INDEX idx_project_collaborators_user_id ON public.project_collaborators(user_id);
CREATE INDEX idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX idx_projects_team_id ON public.projects(team_id);
CREATE INDEX idx_ideas_created_by ON public.ideas(created_by);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_activity_logs_project_id ON public.activity_logs(project_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);

-- RLS Policies

-- Teams: Users can see teams they're members of
CREATE POLICY "Users can view teams they belong to" ON public.teams
    FOR SELECT USING (
        id IN (
            SELECT team_id FROM public.team_members 
            WHERE user_id = auth.uid()
        )
    );

-- Teams: Only owners can update teams
CREATE POLICY "Team owners can update teams" ON public.teams
    FOR UPDATE USING (owner_id = auth.uid());

-- Team members: Users can view memberships for teams they belong to
CREATE POLICY "Users can view team memberships" ON public.team_members
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM public.team_members 
            WHERE user_id = auth.uid()
        )
    );

-- Projects: Users can view projects they own or collaborate on
CREATE POLICY "Users can view accessible projects" ON public.projects
    FOR SELECT USING (
        owner_id = auth.uid() OR
        id IN (
            SELECT project_id FROM public.project_collaborators 
            WHERE user_id = auth.uid()
        ) OR
        (team_id IS NOT NULL AND team_id IN (
            SELECT team_id FROM public.team_members 
            WHERE user_id = auth.uid()
        ))
    );

-- Projects: Users can update projects they own or have editor access
CREATE POLICY "Users can update editable projects" ON public.projects
    FOR UPDATE USING (
        owner_id = auth.uid() OR
        id IN (
            SELECT project_id FROM public.project_collaborators 
            WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
        )
    );

-- Project collaborators: Users can view collaborators for projects they have access to
CREATE POLICY "Users can view project collaborators" ON public.project_collaborators
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM public.projects 
            WHERE owner_id = auth.uid() OR
            id IN (
                SELECT project_id FROM public.project_collaborators 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Ideas: Users can view ideas from projects they have access to
CREATE POLICY "Users can view accessible ideas" ON public.ideas
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM public.projects 
            WHERE owner_id = auth.uid() OR
            id IN (
                SELECT project_id FROM public.project_collaborators 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Ideas: Users can modify ideas in projects they have editor access to
CREATE POLICY "Users can modify ideas in editable projects" ON public.ideas
    FOR ALL USING (
        project_id IN (
            SELECT id FROM public.projects 
            WHERE owner_id = auth.uid() OR
            id IN (
                SELECT project_id FROM public.project_collaborators 
                WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
            )
        )
    );

-- Invitations: Users can view invitations they sent or received
CREATE POLICY "Users can view relevant invitations" ON public.invitations
    FOR SELECT USING (
        invited_by = auth.uid() OR
        email = (SELECT email FROM public.user_profiles WHERE id = auth.uid())
    );

-- Activity logs: Users can view activity for projects/teams they have access to
CREATE POLICY "Users can view relevant activity" ON public.activity_logs
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM public.projects 
            WHERE owner_id = auth.uid() OR
            id IN (
                SELECT project_id FROM public.project_collaborators 
                WHERE user_id = auth.uid()
            )
        ) OR
        team_id IN (
            SELECT team_id FROM public.team_members 
            WHERE user_id = auth.uid()
        )
    );

-- Functions for common operations

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile when auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check if user can access project
CREATE OR REPLACE FUNCTION public.can_user_access_project(project_uuid uuid, user_uuid uuid)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.projects p
        LEFT JOIN public.project_collaborators pc ON p.id = pc.project_id
        LEFT JOIN public.team_members tm ON p.team_id = tm.team_id
        WHERE p.id = project_uuid AND (
            p.owner_id = user_uuid OR
            (pc.user_id = user_uuid) OR
            (tm.user_id = user_uuid)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's role in project
CREATE OR REPLACE FUNCTION public.get_user_project_role(project_uuid uuid, user_uuid uuid)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Check if owner
    SELECT 'owner' INTO user_role 
    FROM public.projects 
    WHERE id = project_uuid AND owner_id = user_uuid;
    
    IF user_role IS NOT NULL THEN
        RETURN user_role;
    END IF;
    
    -- Check collaborator role
    SELECT role::TEXT INTO user_role 
    FROM public.project_collaborators 
    WHERE project_id = project_uuid AND user_id = user_uuid AND accepted_at IS NOT NULL;
    
    IF user_role IS NOT NULL THEN
        RETURN user_role;
    END IF;
    
    -- Check team membership
    SELECT CASE 
        WHEN tm.role = 'owner' THEN 'editor'
        WHEN tm.role = 'admin' THEN 'editor'
        WHEN tm.role = 'member' THEN 'commenter'
        ELSE 'viewer'
    END INTO user_role
    FROM public.projects p
    JOIN public.team_members tm ON p.team_id = tm.team_id
    WHERE p.id = project_uuid AND tm.user_id = user_uuid;
    
    RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing data to use proper user references (you'll need to run this manually with proper user mapping)
-- This is commented out as it requires manual user ID mapping
-- UPDATE public.projects SET owner_id = (SELECT id FROM public.user_profiles WHERE email = 'your-email@domain.com' LIMIT 1);
-- UPDATE public.ideas SET created_by = (SELECT id FROM public.user_profiles WHERE email = 'your-email@domain.com' LIMIT 1);

COMMENT ON TABLE public.user_profiles IS 'Extended user profiles linked to Supabase Auth users';
COMMENT ON TABLE public.teams IS 'Organizations/teams that can own multiple projects';
COMMENT ON TABLE public.team_members IS 'Team membership with roles';
COMMENT ON TABLE public.project_collaborators IS 'Project-specific collaborators and their permissions';
COMMENT ON TABLE public.invitations IS 'Email invitations for teams and projects';
COMMENT ON TABLE public.activity_logs IS 'Activity tracking for collaboration features';