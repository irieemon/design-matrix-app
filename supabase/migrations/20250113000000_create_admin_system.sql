-- ============================================================================
-- Admin System Migration
-- ============================================================================
--
-- PURPOSE: Enable comprehensive admin system for Prioritas
-- COMPONENTS:
--   1. ai_token_usage table - Track OpenAI API token consumption and costs
--   2. Admin RLS policies - Grant admins access to all user data
--   3. admin_user_stats materialized view - Pre-aggregated user statistics
--
-- AUTHOR: Claude Code
-- DATE: 2025-01-13
-- VERSION: 1.0
-- ============================================================================

-- ============================================================================
-- PART 1: AI TOKEN USAGE TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  -- API Call Details
  endpoint VARCHAR(100) NOT NULL, -- 'generate-ideas', 'generate-insights', 'generate-roadmap', 'analyze-file', 'analyze-image', 'transcribe-audio'
  model VARCHAR(50) NOT NULL,     -- 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', etc.

  -- Token Counts (from OpenAI response)
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Cost Calculation (USD)
  input_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  output_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,

  -- Metadata
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  response_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (prompt_tokens >= 0),
  CHECK (completion_tokens >= 0),
  CHECK (total_tokens >= 0),
  CHECK (total_cost >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_id ON public.ai_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created_at ON public.ai_token_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_date ON public.ai_token_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_project ON public.ai_token_usage(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_endpoint ON public.ai_token_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_model ON public.ai_token_usage(model);

-- Comments
COMMENT ON TABLE public.ai_token_usage IS 'Track OpenAI API token consumption and costs per request';
COMMENT ON COLUMN public.ai_token_usage.endpoint IS 'API endpoint: generate-ideas, generate-insights, generate-roadmap, analyze-file, analyze-image, transcribe-audio';
COMMENT ON COLUMN public.ai_token_usage.model IS 'OpenAI model used: gpt-5, gpt-5-mini, gpt-5-nano, o1-preview, etc.';
COMMENT ON COLUMN public.ai_token_usage.total_cost IS 'Total cost in USD for this API call (input_cost + output_cost)';
COMMENT ON COLUMN public.ai_token_usage.success IS 'Whether the API call succeeded or failed';
COMMENT ON COLUMN public.ai_token_usage.response_time_ms IS 'API response time in milliseconds';

-- ============================================================================
-- PART 2: ADMIN RLS POLICIES
-- ============================================================================

-- Helper function: Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin() IS 'Check if current authenticated user has admin privileges (admin or super_admin role)';

-- Enable RLS on ai_token_usage table
ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own token usage
DROP POLICY IF EXISTS "Users can view their own token usage" ON public.ai_token_usage;
CREATE POLICY "Users can view their own token usage"
ON public.ai_token_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Service role can insert token usage (backend only)
DROP POLICY IF EXISTS "Service role can insert token usage" ON public.ai_token_usage;
CREATE POLICY "Service role can insert token usage"
ON public.ai_token_usage
FOR INSERT
WITH CHECK (true); -- Service role bypass RLS, but we keep policy for clarity

-- Policy: Admins can view all token usage
DROP POLICY IF EXISTS "Admins can view all token usage" ON public.ai_token_usage;
CREATE POLICY "Admins can view all token usage"
ON public.ai_token_usage
FOR SELECT
USING (is_admin());

-- ============================================================================
-- ADMIN POLICIES FOR EXISTING TABLES
-- ============================================================================

-- Admin can view all users
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (is_admin());

-- Admin can view all projects (if not already covered by existing policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'projects'
    AND policyname = 'Admins can view all projects'
  ) THEN
    CREATE POLICY "Admins can view all projects"
    ON public.projects
    FOR SELECT
    USING (is_admin());
  END IF;
END $$;

-- Admin can view all ideas (if not already covered by existing policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'ideas'
    AND policyname = 'Admins can view all ideas'
  ) THEN
    CREATE POLICY "Admins can view all ideas"
    ON public.ideas
    FOR SELECT
    USING (is_admin());
  END IF;
END $$;

-- Admin can view all subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'subscriptions'
    AND policyname = 'Admins can view all subscriptions'
  ) THEN
    CREATE POLICY "Admins can view all subscriptions"
    ON public.subscriptions
    FOR SELECT
    USING (is_admin());
  END IF;
END $$;

-- Admin can view all usage tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'usage_tracking'
    AND policyname = 'Admins can view all usage tracking'
  ) THEN
    CREATE POLICY "Admins can view all usage tracking"
    ON public.usage_tracking
    FOR SELECT
    USING (is_admin());
  END IF;
END $$;

-- ============================================================================
-- PART 3: ADMIN USER STATS MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.admin_user_stats AS
SELECT
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.created_at as join_date,
  u.last_login,
  s.tier as subscription_tier,
  s.status as subscription_status,

  -- Project counts
  COALESCE(p.project_count, 0) as project_count,

  -- Idea counts
  COALESCE(i.idea_count, 0) as idea_count,

  -- Usage counts (current month)
  COALESCE(ut_ai.ai_usage, 0) as monthly_ai_usage,
  COALESCE(ut_export.export_usage, 0) as monthly_export_usage,

  -- Token usage (all time)
  COALESCE(tokens.total_tokens, 0) as total_tokens_used,
  COALESCE(tokens.total_cost, 0) as total_cost_usd,

  -- Token usage (current month)
  COALESCE(tokens_month.monthly_tokens, 0) as monthly_tokens,
  COALESCE(tokens_month.monthly_cost, 0) as monthly_cost_usd

FROM public.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
LEFT JOIN (
  SELECT owner_id, COUNT(*) as project_count
  FROM public.projects
  GROUP BY owner_id
) p ON p.owner_id = u.id
LEFT JOIN (
  SELECT created_by, COUNT(*) as idea_count
  FROM public.ideas
  GROUP BY created_by
) i ON i.created_by::uuid = u.id
LEFT JOIN (
  SELECT user_id, SUM(count) as ai_usage
  FROM public.usage_tracking
  WHERE resource_type = 'ai_idea'
    AND period_start >= date_trunc('month', NOW())
  GROUP BY user_id
) ut_ai ON ut_ai.user_id = u.id
LEFT JOIN (
  SELECT user_id, SUM(count) as export_usage
  FROM public.usage_tracking
  WHERE resource_type = 'export'
    AND period_start >= date_trunc('month', NOW())
  GROUP BY user_id
) ut_export ON ut_export.user_id = u.id
LEFT JOIN (
  SELECT user_id, SUM(total_tokens) as total_tokens, SUM(total_cost) as total_cost
  FROM public.ai_token_usage
  GROUP BY user_id
) tokens ON tokens.user_id = u.id
LEFT JOIN (
  SELECT user_id, SUM(total_tokens) as monthly_tokens, SUM(total_cost) as monthly_cost
  FROM public.ai_token_usage
  WHERE created_at >= date_trunc('month', NOW())
  GROUP BY user_id
) tokens_month ON tokens_month.user_id = u.id;

-- Indexes for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_user_stats_id ON public.admin_user_stats(id);
CREATE INDEX IF NOT EXISTS idx_admin_user_stats_tier ON public.admin_user_stats(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_admin_user_stats_cost ON public.admin_user_stats(total_cost_usd DESC);
CREATE INDEX IF NOT EXISTS idx_admin_user_stats_email ON public.admin_user_stats(email);

COMMENT ON MATERIALIZED VIEW public.admin_user_stats IS 'Pre-aggregated user statistics for admin dashboard performance';

-- ============================================================================
-- PART 4: MATERIALIZED VIEW REFRESH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_admin_user_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.admin_user_stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.refresh_admin_user_stats() IS 'Refresh admin_user_stats materialized view with concurrent option (non-blocking)';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify ai_token_usage table created
SELECT
  'ai_token_usage table created' as status,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'ai_token_usage';

-- Verify RLS policies on ai_token_usage
SELECT
  'ai_token_usage RLS policies' as status,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'ai_token_usage'
ORDER BY policyname;

-- Verify admin policies on existing tables
SELECT
  'Admin policies on existing tables' as status,
  tablename,
  policyname
FROM pg_policies
WHERE policyname LIKE '%Admin%'
ORDER BY tablename, policyname;

-- Verify admin_user_stats view
SELECT
  'admin_user_stats view created' as status,
  schemaname,
  matviewname,
  matviewowner
FROM pg_matviews
WHERE schemaname = 'public' AND matviewname = 'admin_user_stats';

-- Verify is_admin() function exists
SELECT
  'is_admin() function created' as status,
  proname,
  prosrc
FROM pg_proc
WHERE proname = 'is_admin';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Admin system migration completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  ✓ ai_token_usage table with indexes';
  RAISE NOTICE '  ✓ is_admin() helper function';
  RAISE NOTICE '  ✓ Admin RLS policies for all tables';
  RAISE NOTICE '  ✓ admin_user_stats materialized view';
  RAISE NOTICE '  ✓ refresh_admin_user_stats() function';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Implement token tracking in api/ai.ts';
  RAISE NOTICE '  2. Create adminRepository.ts';
  RAISE NOTICE '  3. Build admin UI components';
END $$;
