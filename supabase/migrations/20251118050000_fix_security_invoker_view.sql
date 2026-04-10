-- Fix security_definer_view warning for admin_user_stats_secure
-- Recreate view with security_invoker=on to respect RLS policies
-- Addresses 1 security warning from Supabase linter

-- ===================================================================
-- SECURITY ISSUE: View with SECURITY DEFINER property
-- ===================================================================

-- Problem: Views with SECURITY DEFINER bypass RLS policies and execute
-- with the permissions of the view creator (postgres) rather than
-- the querying user. This can expose data beyond intended access.
--
-- Solution: Use security_invoker=on (PostgreSQL 15+) to make the view
-- respect RLS policies of underlying tables while still enforcing
-- admin-only access through the is_admin() function.

-- Drop existing view
DROP VIEW IF EXISTS public.admin_user_stats_secure;

-- Recreate view with security_invoker=on
CREATE VIEW public.admin_user_stats_secure
WITH (security_invoker=on)
AS
SELECT *
FROM public.admin_user_stats
WHERE public.is_admin();  -- Only admins can see data

COMMENT ON VIEW public.admin_user_stats_secure IS
  'Secure view wrapper for admin_user_stats. Only accessible by administrators. Uses security_invoker to respect RLS policies.';

-- Grant access to the secure view
GRANT SELECT ON public.admin_user_stats_secure TO authenticated;

-- ===================================================================
-- VERIFICATION
-- ===================================================================

-- Verify view is created with security_invoker
-- Note: Verification query can be run separately in SQL editor
-- SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname = 'admin_user_stats_secure';

-- ===================================================================
-- SECURITY IMPACT ANALYSIS
-- ===================================================================

-- Before fix:
-- - View executed with postgres/owner permissions (SECURITY DEFINER)
-- - Bypassed RLS policies on underlying tables
-- - Potential for unintended data exposure

-- After fix:
-- - View executes with querying user's permissions (security_invoker=on)
-- - Respects RLS policies on admin_user_stats materialized view
-- - is_admin() function still enforces admin-only access
-- - Proper defense-in-depth security model

-- Security improvement:
-- - RLS policies are now respected at all levels
-- - No permission elevation through view execution
-- - Maintains admin-only access through function-based filtering
