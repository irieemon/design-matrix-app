-- Fix Database Tables and Policies
-- Run this in Supabase SQL Editor to fix the missing tables and policy issues

-- Create projects table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    project_type text DEFAULT 'other' CHECK (project_type IN ('software', 'marketing', 'business', 'research', 'other')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
    priority_level text DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
    visibility text DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
    owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create ideas table if it doesn't exist  
CREATE TABLE IF NOT EXISTS public.ideas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    content text NOT NULL,
    details text,
    x integer NOT NULL DEFAULT 0,
    y integer NOT NULL DEFAULT 0,
    priority text DEFAULT 'moderate' CHECK (priority IN ('low', 'moderate', 'high', 'strategic', 'innovation')),
    created_by text,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    is_collapsed boolean DEFAULT false,
    editing_by text,
    editing_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create teams table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

-- Create simple, non-recursive policies for projects
CREATE POLICY "Users can manage own projects" ON public.projects
    FOR ALL USING (auth.uid() = owner_id);

-- Drop existing policies for ideas to avoid conflicts  
DROP POLICY IF EXISTS "Users can view project ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can create ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can update ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can delete ideas" ON public.ideas;

-- Create simple policies for ideas
CREATE POLICY "Users can manage ideas" ON public.ideas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = ideas.project_id 
            AND projects.owner_id = auth.uid()
        )
        OR project_id IS NULL
    );

-- Create simple policies for teams
DROP POLICY IF EXISTS "Users can view own teams" ON public.teams;
DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Users can update own teams" ON public.teams;

CREATE POLICY "Users can manage own teams" ON public.teams
    FOR ALL USING (auth.uid() = owner_id);

-- Create function to handle user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.projects TO authenticated;
GRANT ALL ON public.ideas TO authenticated;
GRANT ALL ON public.teams TO authenticated;