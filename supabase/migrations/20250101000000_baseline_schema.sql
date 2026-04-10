-- ============================================================================
-- BASELINE SCHEMA — tables originally created via the Supabase dashboard
-- ============================================================================
--
-- PURPOSE: Establish all core tables for CI environments that start from an
--          empty database. These tables were hand-created in the Supabase
--          dashboard and were never captured in a migration file. Every
--          subsequent migration depends on at least one of them existing.
--
-- ORDERING CONSTRAINT: This file must sort BEFORE all other migrations.
--                      Earliest existing migration: 20250113000000.
--
-- FK DEPENDENCY ORDER (tables created top-to-bottom):
--   auth.users (provided by Supabase) →
--   users → user_profiles → teams →
--   projects → ideas → project_files →
--   project_roadmaps → project_insights → team_members
--
-- NOTE: No RLS policies are created here. All policies are created and managed
--       by later migrations (e.g. 20251117190000_fix_all_rls_warnings.sql).
--       This avoids "policy already exists" errors when migrations run
--       sequentially from a clean database.
--
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. public.users
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id                       uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                    text        NOT NULL,
  full_name                text,
  avatar_url               text,
  company                  text,
  job_title                text,
  timezone                 text,
  role                     text        NOT NULL DEFAULT 'user'
                                         CHECK (role IN ('user', 'admin', 'super_admin')),
  is_active                boolean     NOT NULL DEFAULT true,
  last_login               timestamptz,
  notification_preferences jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. public.user_profiles
-- ============================================================================
-- Minimal legacy table; referenced by RLS helper policies in later migrations.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user'
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. public.teams
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  avatar_url  text,
  owner_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  settings    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teams_owner_id_idx ON public.teams (owner_id);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. public.projects
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  description      text,
  project_type     text        NOT NULL DEFAULT 'other'
                                 CHECK (project_type IN (
                                   'software', 'business_plan', 'product_development',
                                   'marketing', 'operations', 'research', 'other'
                                 )),
  status           text        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'completed', 'paused', 'archived')),
  visibility       text        NOT NULL DEFAULT 'private'
                                 CHECK (visibility IN ('private', 'team', 'public')),
  start_date       date,
  target_date      date,
  budget           numeric,
  team_size        integer,
  priority_level   text        NOT NULL DEFAULT 'medium'
                                 CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
  tags             text[],
  owner_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- team_id is nullable: a project may not belong to a team
  team_id          uuid        REFERENCES public.teams(id) ON DELETE SET NULL,
  settings         jsonb,
  is_ai_generated  boolean     NOT NULL DEFAULT false,
  ai_analysis      jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_owner_id_idx  ON public.projects (owner_id);
CREATE INDEX IF NOT EXISTS projects_team_id_idx   ON public.projects (team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_status_idx    ON public.projects (status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. public.ideas
-- ============================================================================
-- CRITICAL: id is TEXT (not uuid) — this is intentional and load-bearing.
-- idea_votes and session_activity_log FK to ideas(id) as text. Do NOT change.
-- Columns session_id, participant_id, and submitted_via are added by
-- 20250120000000_create_brainstorm_sessions.sql — do NOT add them here.

CREATE TABLE IF NOT EXISTS public.ideas (
  id          text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  content     text        NOT NULL,
  details     text        NOT NULL DEFAULT '',
  x           numeric     NOT NULL DEFAULT 0,
  y           numeric     NOT NULL DEFAULT 0,
  priority    text        NOT NULL DEFAULT 'moderate'
                            CHECK (priority IN ('low', 'moderate', 'high', 'strategic', 'innovation')),
  created_by  text,
  project_id  uuid        REFERENCES public.projects(id) ON DELETE CASCADE,
  editing_by  text,
  editing_at  timestamptz,
  is_collapsed boolean    NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ideas_project_id_idx  ON public.ideas (project_id);
CREATE INDEX IF NOT EXISTS ideas_created_by_idx  ON public.ideas (created_by);
CREATE INDEX IF NOT EXISTS ideas_created_at_idx  ON public.ideas (created_at DESC);

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. public.project_files
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_files (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  original_name    text        NOT NULL,
  file_type        text        NOT NULL,
  file_size        bigint      NOT NULL DEFAULT 0,
  mime_type        text        NOT NULL,
  storage_path     text,
  content_preview  text,
  file_data        text,
  ai_analysis      jsonb,
  analysis_status  text        DEFAULT 'pending'
                                 CHECK (analysis_status IN (
                                   'pending', 'analyzing', 'completed', 'failed', 'skipped'
                                 )),
  uploaded_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_files_project_id_idx  ON public.project_files (project_id);
CREATE INDEX IF NOT EXISTS project_files_uploaded_by_idx ON public.project_files (uploaded_by);

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. public.project_roadmaps
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_roadmaps (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version         integer     NOT NULL DEFAULT 1,
  name            text        NOT NULL,
  roadmap_data    jsonb       NOT NULL DEFAULT '{}',
  created_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ideas_analyzed  integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_roadmaps_project_id_idx ON public.project_roadmaps (project_id);
CREATE INDEX IF NOT EXISTS project_roadmaps_created_by_idx ON public.project_roadmaps (created_by);

ALTER TABLE public.project_roadmaps ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. public.project_insights
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_insights (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version        integer     NOT NULL DEFAULT 1,
  name           text        NOT NULL,
  insights_data  jsonb       NOT NULL DEFAULT '{}',
  created_by     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ideas_analyzed integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_insights_project_id_idx ON public.project_insights (project_id);
CREATE INDEX IF NOT EXISTS project_insights_created_by_idx ON public.project_insights (created_by);

ALTER TABLE public.project_insights ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. public.team_members
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'member'
                            CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at  timestamptz NOT NULL DEFAULT now(),
  joined_at   timestamptz,
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON public.team_members (team_id);
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON public.team_members (user_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. public.subscriptions  (stub)
-- 11. public.usage_tracking (stub)
--
-- Stub tables for admin_user_stats materialized view — full schema in
-- 20260408160000_billing_schema.sql.
--
-- The admin migration (20250113000000_create_admin_system.sql) builds a
-- materialized view that LEFT JOINs both tables. Without these stubs the
-- view DDL fails in CI where migrations run sequentially from an empty DB.
-- The billing migration uses CREATE TABLE IF NOT EXISTS so it will no-op the
-- table creation and only add its indexes, functions, and policies on top.
-- ============================================================================

-- -------- 10. public.subscriptions --------

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id                 uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id      text        UNIQUE,
  stripe_subscription_id  text        UNIQUE,
  tier                    text        NOT NULL DEFAULT 'free'
                                        CHECK (tier IN ('free', 'team', 'enterprise')),
  status                  text        NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean     NOT NULL DEFAULT false,
  past_due_since          timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- -------- 11. public.usage_tracking --------

CREATE TABLE IF NOT EXISTS public.usage_tracking (
  user_id        uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type  text  NOT NULL CHECK (resource_type IN ('ai_idea')),
  period_start   date  NOT NULL DEFAULT date_trunc('month', now())::date,
  count          int   NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_type)
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
