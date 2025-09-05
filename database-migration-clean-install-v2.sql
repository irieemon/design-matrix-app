-- Clean Multi-User Authentication System Installation (V2)
-- This version handles the auth.users constraint properly

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

-- Recreate projects table with proper multi-user structure
-- For now, owner_id can be NULL until real users are created
CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    project_type text DEFAULT 'other' CHECK (project_type IN ('software', 'business_plan', 'product_development', 'marketing', 'operations', 'research', 'other')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
    visibility text DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
    start_date text,
    target_date text,
    budget numeric,
    team_size integer,
    priority_level text DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
    tags text[],
    owner_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL, -- Allow NULL initially
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_ai_generated boolean DEFAULT false,
    ai_analysis jsonb,
    -- Temporary field to track legacy projects
    legacy_created_by text -- Store original created_by until migration
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

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

-- Recreate ideas table with proper user references
CREATE TABLE public.ideas (
    id text PRIMARY KEY,
    content text NOT NULL,
    details text,
    x integer NOT NULL,
    y integer NOT NULL,
    priority text CHECK (priority IN ('low', 'moderate', 'high', 'strategic', 'innovation')),
    created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL, -- Allow NULL initially
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    editing_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    editing_at timestamp with time zone,
    is_collapsed boolean DEFAULT false,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    -- Temporary field to track legacy ideas
    legacy_created_by text -- Store original created_by until migration
);

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

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
    role text NOT NULL,
    status invitation_status DEFAULT 'pending' NOT NULL,
    token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
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
CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX idx_ideas_created_by ON public.ideas(created_by);
CREATE INDEX idx_ideas_project_id ON public.ideas(project_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_activity_logs_project_id ON public.activity_logs(project_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);

-- RLS Policies - PERMISSIVE for development (you can tighten these later)

-- Teams: Users can see teams they're members of OR any team if no auth (for development)
CREATE POLICY "Users can view teams they belong to" ON public.teams
    FOR SELECT USING (
        auth.uid() IS NULL OR  -- Allow if no auth (development mode)
        id IN (
            SELECT team_id FROM public.team_members 
            WHERE user_id = auth.uid()
        ) OR owner_id = auth.uid()
    );

-- Teams: Only owners can update teams OR anyone if no auth
CREATE POLICY "Team owners can update teams" ON public.teams
    FOR UPDATE USING (auth.uid() IS NULL OR owner_id = auth.uid());

-- Teams: Users can create teams
CREATE POLICY "Users can create teams" ON public.teams
    FOR INSERT WITH CHECK (auth.uid() IS NULL OR owner_id = auth.uid());

-- Team members: Allow viewing if no auth or if user belongs to team
CREATE POLICY "Users can view team memberships" ON public.team_members
    FOR SELECT USING (
        auth.uid() IS NULL OR
        team_id IN (
            SELECT team_id FROM public.team_members 
            WHERE user_id = auth.uid()
        ) OR team_id IN (
            SELECT id FROM public.teams WHERE owner_id = auth.uid()
        )
    );

-- Projects: Allow viewing if no auth OR user has access
CREATE POLICY "Users can view accessible projects" ON public.projects
    FOR SELECT USING (
        auth.uid() IS NULL OR  -- Allow if no auth (development mode)
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

-- Projects: Allow updating if no auth OR user has access
CREATE POLICY "Users can update editable projects" ON public.projects
    FOR UPDATE USING (
        auth.uid() IS NULL OR  -- Allow if no auth (development mode)
        owner_id = auth.uid() OR
        id IN (
            SELECT project_id FROM public.project_collaborators 
            WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
        )
    );

-- Projects: Allow creating if no auth OR user is authenticated
CREATE POLICY "Users can create projects" ON public.projects
    FOR INSERT WITH CHECK (
        auth.uid() IS NULL OR  -- Allow if no auth (development mode)
        owner_id = auth.uid() OR 
        owner_id IS NULL  -- Allow NULL owner initially
    );

-- Project collaborators: Allow viewing if accessible
CREATE POLICY "Users can view project collaborators" ON public.project_collaborators
    FOR SELECT USING (
        auth.uid() IS NULL OR
        project_id IN (
            SELECT id FROM public.projects 
            WHERE owner_id = auth.uid() OR
            id IN (
                SELECT project_id FROM public.project_collaborators 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Ideas: Allow viewing if project is accessible
CREATE POLICY "Users can view accessible ideas" ON public.ideas
    FOR SELECT USING (
        auth.uid() IS NULL OR  -- Allow if no auth (development mode)
        project_id IN (
            SELECT id FROM public.projects 
            WHERE owner_id = auth.uid() OR
            owner_id IS NULL OR  -- Allow for projects without owner
            id IN (
                SELECT project_id FROM public.project_collaborators 
                WHERE user_id = auth.uid()
            ) OR
            (team_id IS NOT NULL AND team_id IN (
                SELECT team_id FROM public.team_members 
                WHERE user_id = auth.uid()
            ))
        )
    );

-- Ideas: Allow modification if project is editable
CREATE POLICY "Users can modify ideas in editable projects" ON public.ideas
    FOR ALL USING (
        auth.uid() IS NULL OR  -- Allow if no auth (development mode)
        project_id IN (
            SELECT id FROM public.projects 
            WHERE owner_id = auth.uid() OR
            owner_id IS NULL OR  -- Allow for projects without owner
            id IN (
                SELECT project_id FROM public.project_collaborators 
                WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
            )
        )
    );

-- Invitations: Users can view invitations they sent or received
CREATE POLICY "Users can view relevant invitations" ON public.invitations
    FOR SELECT USING (
        auth.uid() IS NULL OR
        invited_by = auth.uid() OR
        email = (SELECT email FROM public.user_profiles WHERE id = auth.uid())
    );

-- Activity logs: Users can view activity for projects/teams they have access to
CREATE POLICY "Users can view relevant activity" ON public.activity_logs
    FOR SELECT USING (
        auth.uid() IS NULL OR
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
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check if user can access project
CREATE OR REPLACE FUNCTION public.can_user_access_project(project_uuid uuid, user_uuid uuid)
RETURNS BOOLEAN AS $$
BEGIN
    -- Allow access if no user (development mode)
    IF user_uuid IS NULL THEN
        RETURN TRUE;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.projects p
        LEFT JOIN public.project_collaborators pc ON p.id = pc.project_id
        LEFT JOIN public.team_members tm ON p.team_id = tm.team_id
        WHERE p.id = project_uuid AND (
            p.owner_id = user_uuid OR
            p.owner_id IS NULL OR  -- Allow for ownerless projects
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
    -- Default to owner if no user (development mode)
    IF user_uuid IS NULL THEN
        RETURN 'owner';
    END IF;

    -- Check if owner
    SELECT 'owner' INTO user_role 
    FROM public.projects 
    WHERE id = project_uuid AND owner_id = user_uuid;
    
    IF user_role IS NOT NULL THEN
        RETURN user_role;
    END IF;
    
    -- Check if project has no owner (legacy project)
    SELECT 'owner' INTO user_role 
    FROM public.projects 
    WHERE id = project_uuid AND owner_id IS NULL;
    
    IF user_role IS NOT NULL THEN
        RETURN 'owner';  -- First authenticated user becomes owner of ownerless projects
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

-- Function to claim ownership of ownerless projects (for migration)
CREATE OR REPLACE FUNCTION public.claim_ownerless_project(project_uuid uuid, user_uuid uuid)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.projects 
    SET owner_id = user_uuid 
    WHERE id = project_uuid AND owner_id IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to automatically update updated_at timestamp for projects
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

CREATE TRIGGER update_ideas_updated_at
    BEFORE UPDATE ON public.ideas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Table comments
COMMENT ON TABLE public.user_profiles IS 'Extended user profiles linked to Supabase Auth users';
COMMENT ON TABLE public.teams IS 'Organizations/teams that can own multiple projects';
COMMENT ON TABLE public.team_members IS 'Team membership with roles';
COMMENT ON TABLE public.project_collaborators IS 'Project-specific collaborators and their permissions';
COMMENT ON TABLE public.invitations IS 'Email invitations for teams and projects';
COMMENT ON TABLE public.activity_logs IS 'Activity tracking for collaboration features';

-- Success message
SELECT 'Clean multi-user system installation completed successfully! 🚀' as result,
       'Projects and ideas can have NULL owners initially for smooth migration.' as note;