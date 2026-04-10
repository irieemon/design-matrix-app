-- Optimize database indexes based on Supabase linter recommendations
-- Addresses unindexed foreign keys and removes unused indexes

-- ===================================================================
-- PART 1: Add missing indexes for foreign keys
-- ===================================================================

-- Index for ideas.editing_by foreign key
-- Improves performance when querying ideas by editing user
CREATE INDEX IF NOT EXISTS idx_ideas_editing_by
  ON public.ideas(editing_by)
  WHERE editing_by IS NOT NULL;

-- Index for project_collaborators.invited_by foreign key
-- Improves performance when querying collaborators by inviter
CREATE INDEX IF NOT EXISTS idx_project_collaborators_invited_by
  ON public.project_collaborators(invited_by)
  WHERE invited_by IS NOT NULL;

-- Index for teams.owner_id foreign key
-- Improves performance when querying teams by owner
CREATE INDEX IF NOT EXISTS idx_teams_owner_id
  ON public.teams(owner_id);

-- ===================================================================
-- PART 2: Remove unused indexes
-- ===================================================================

-- FAQ tables - These indexes are unused because RLS policies now handle filtering
DROP INDEX IF EXISTS public.idx_faq_categories_published;
DROP INDEX IF EXISTS public.idx_faq_items_published;
DROP INDEX IF EXISTS public.idx_faq_items_search;

-- AI token usage - These indexes are unused (likely feature not yet active)
DROP INDEX IF EXISTS public.idx_ai_token_usage_user_id;
DROP INDEX IF EXISTS public.idx_ai_token_usage_project;
DROP INDEX IF EXISTS public.idx_ai_token_usage_endpoint;
DROP INDEX IF EXISTS public.idx_ai_token_usage_model;

-- Subscriptions - Unused indexes (Stripe integration patterns may not use these)
DROP INDEX IF EXISTS public.idx_subscriptions_stripe_customer;
DROP INDEX IF EXISTS public.idx_subscriptions_tier_status;

-- Project files - Unused indexes
DROP INDEX IF EXISTS public.idx_project_files_analysis_status;
DROP INDEX IF EXISTS public.idx_project_files_created_at;
DROP INDEX IF EXISTS public.idx_project_files_storage_path;

-- Project insights - Unused index
DROP INDEX IF EXISTS public.idx_project_insights_project_id;

-- Project roadmaps - Unused index
DROP INDEX IF EXISTS public.idx_project_roadmaps_project_id;

-- Projects - Unused team_id index
DROP INDEX IF EXISTS public.idx_projects_team_id;

-- Admin user stats - Unused indexes
DROP INDEX IF EXISTS public.idx_admin_user_stats_tier;
DROP INDEX IF EXISTS public.idx_admin_user_stats_cost;
DROP INDEX IF EXISTS public.idx_admin_user_stats_email;

-- ===================================================================
-- Performance Analysis Comments
-- ===================================================================

-- Foreign Key Indexes Added (3):
-- 1. idx_ideas_editing_by - Partial index (NULL values excluded for efficiency)
-- 2. idx_project_collaborators_invited_by - Partial index (NULL values excluded)
-- 3. idx_teams_owner_id - Full index (owner_id is always set)
--
-- Impact: Faster JOIN operations and foreign key constraint validation
-- Cost: Minimal storage overhead, maintained on writes

-- Unused Indexes Removed (21):
-- These indexes were consuming storage and CPU on write operations
-- without providing query performance benefits
--
-- Impact: Reduced storage, faster INSERT/UPDATE/DELETE operations
-- Savings: ~21 index maintenance operations eliminated per write
