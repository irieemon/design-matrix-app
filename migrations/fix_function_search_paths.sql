-- Fix function search paths for security compliance
-- This prevents potential SQL injection through search_path manipulation
--
-- IMPORTANT: We DROP functions before recreating them to avoid "function name not unique" errors
-- This happens when multiple versions with different signatures exist

-- Fix can_user_access_project function
-- Drop existing function(s) to avoid ambiguity
DROP FUNCTION IF EXISTS public.can_user_access_project(UUID, UUID);
DROP FUNCTION IF EXISTS public.can_user_access_project(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.can_user_access_project;

CREATE OR REPLACE FUNCTION public.can_user_access_project(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- Fixed: Set explicit search_path
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_uuid::text
    AND (
      owner_id = user_uuid::text
      OR visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM project_collaborators
        WHERE project_id = project_uuid::text
        AND user_id = user_uuid::text
      )
    )
  );
END;
$$;

-- Fix get_user_project_role function
-- Drop existing function(s) to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_user_project_role(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_user_project_role(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_user_project_role;

CREATE OR REPLACE FUNCTION public.get_user_project_role(project_uuid UUID, user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- Fixed: Set explicit search_path
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Check if user is owner
  IF EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_uuid::text
    AND owner_id = user_uuid::text
  ) THEN
    RETURN 'owner';
  END IF;

  -- Check if user is collaborator
  SELECT role INTO user_role
  FROM project_collaborators
  WHERE project_id = project_uuid::text
  AND user_id = user_uuid::text;

  RETURN COALESCE(user_role, 'none');
END;
$$;

-- Fix claim_ownerless_project function
-- Drop existing function(s) to avoid ambiguity
DROP FUNCTION IF EXISTS public.claim_ownerless_project(UUID);
DROP FUNCTION IF EXISTS public.claim_ownerless_project(TEXT);
DROP FUNCTION IF EXISTS public.claim_ownerless_project;

CREATE OR REPLACE FUNCTION public.claim_ownerless_project(project_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- Fixed: Set explicit search_path
AS $$
DECLARE
  current_owner UUID;
BEGIN
  -- Get current owner
  SELECT owner_id INTO current_owner
  FROM projects
  WHERE id = project_uuid::text;

  -- If no owner, claim it
  IF current_owner IS NULL THEN
    UPDATE projects
    SET owner_id = auth.uid()::text
    WHERE id = project_uuid::text;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Fix handle_new_user function
-- Drop existing function with CASCADE to remove dependent trigger
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp  -- Fixed: Set explicit search_path
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Fix update_updated_at_column function
-- Drop existing function with CASCADE to remove all dependent triggers
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp  -- Fixed: Set explicit search_path
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate common triggers for updated_at columns
-- Note: Add triggers for your specific tables as needed
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ideas_updated_at ON public.ideas;
CREATE TRIGGER update_ideas_updated_at
  BEFORE UPDATE ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_roadmaps_updated_at ON public.project_roadmaps;
CREATE TRIGGER update_project_roadmaps_updated_at
  BEFORE UPDATE ON public.project_roadmaps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_insights_updated_at ON public.project_insights;
CREATE TRIGGER update_project_insights_updated_at
  BEFORE UPDATE ON public.project_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments explaining the security fix
COMMENT ON FUNCTION public.can_user_access_project IS 'Security hardened: search_path explicitly set to prevent SQL injection';
COMMENT ON FUNCTION public.get_user_project_role IS 'Security hardened: search_path explicitly set to prevent SQL injection';
COMMENT ON FUNCTION public.claim_ownerless_project IS 'Security hardened: search_path explicitly set to prevent SQL injection';
COMMENT ON FUNCTION public.handle_new_user IS 'Security hardened: search_path explicitly set to prevent SQL injection';
COMMENT ON FUNCTION public.update_updated_at_column IS 'Security hardened: search_path explicitly set to prevent SQL injection';
