-- Fix security warnings: function search_path and materialized view exposure
-- Addresses 4 security warnings from Supabase linter

-- ===================================================================
-- SECURITY ISSUE 1: Functions with mutable search_path
-- ===================================================================

-- Problem: Functions without explicit search_path can be exploited
-- by malicious users creating functions in their own schemas
-- that shadow system functions.
--
-- Solution: Set search_path to prevent schema injection attacks

-- Fix: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with definer privileges
SET search_path = public, pg_temp  -- Explicit schema path prevents attacks
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS
  'Trigger function to update updated_at timestamp. SECURITY DEFINER with explicit search_path.';

-- Fix: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with definer privileges
SET search_path = public, pg_temp  -- Explicit schema path prevents attacks
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get role for current authenticated user
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();

  -- Return true if admin or super_admin
  RETURN user_role IN ('admin', 'super_admin');
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Check if current authenticated user has admin privileges. SECURITY DEFINER with explicit search_path.';

-- Fix: refresh_admin_user_stats
CREATE OR REPLACE FUNCTION public.refresh_admin_user_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with definer privileges
SET search_path = public, pg_temp  -- Explicit schema path prevents attacks
AS $$
BEGIN
  -- Only allow admins to refresh stats
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can refresh user statistics';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.admin_user_stats;
END;
$$;

COMMENT ON FUNCTION public.refresh_admin_user_stats() IS
  'Refresh admin_user_stats materialized view. Admin-only. SECURITY DEFINER with explicit search_path.';

-- ===================================================================
-- SECURITY ISSUE 2: Materialized view exposed via API
-- ===================================================================

-- Problem: admin_user_stats materialized view is accessible to anon/authenticated
-- This exposes sensitive user data to unauthorized users
--
-- Solution: Revoke public access and add admin-only RLS

-- Revoke all public access
REVOKE ALL ON public.admin_user_stats FROM anon;
REVOKE ALL ON public.admin_user_stats FROM authenticated;
REVOKE ALL ON public.admin_user_stats FROM public;

-- Grant access only to postgres/service role
GRANT SELECT ON public.admin_user_stats TO postgres;
GRANT SELECT ON public.admin_user_stats TO service_role;

-- Enable RLS on materialized view
ALTER MATERIALIZED VIEW public.admin_user_stats OWNER TO postgres;

-- Note: Materialized views don't support RLS policies directly in PostgreSQL
-- Instead, we control access via GRANT/REVOKE and application-level checks
-- The API should verify is_admin() before allowing queries to this view

-- Add a security barrier view for safe API access
CREATE OR REPLACE VIEW public.admin_user_stats_secure AS
SELECT *
FROM public.admin_user_stats
WHERE public.is_admin();  -- Only admins can see data

COMMENT ON VIEW public.admin_user_stats_secure IS
  'Secure view wrapper for admin_user_stats. Only accessible by administrators.';

-- Grant access to the secure view
GRANT SELECT ON public.admin_user_stats_secure TO authenticated;

-- ===================================================================
-- SECURITY VERIFICATION
-- ===================================================================

-- Verify function security settings
SELECT
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as is_security_definer,
  p.proconfig as configuration
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('update_updated_at_column', 'is_admin', 'refresh_admin_user_stats')
ORDER BY p.proname;

-- Expected results:
-- All functions should have:
-- - is_security_definer = true
-- - configuration contains search_path setting

-- ===================================================================
-- SECURITY IMPACT ANALYSIS
-- ===================================================================

-- Before fixes:
-- 1. Functions vulnerable to search_path injection attacks
-- 2. admin_user_stats exposed to all authenticated users
-- 3. Sensitive user data (emails, usage stats) potentially leaked
--
-- After fixes:
-- 1. Functions protected with explicit search_path = public, pg_temp
-- 2. admin_user_stats access revoked from anon/authenticated
-- 3. Secure view wrapper (admin_user_stats_secure) with is_admin() check
-- 4. Only service_role and admin users can access sensitive data
--
-- Attack vectors mitigated:
-- - Schema injection attacks via search_path manipulation
-- - Unauthorized access to user statistics
-- - Data exfiltration by non-admin users
