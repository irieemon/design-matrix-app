-- ============================================================================
-- Phase 6: Billing & Subscription Enforcement — Schema
-- Creates: subscriptions, usage_tracking, user_notifications, stripe_webhook_events
-- Functions: increment_ai_usage, get_current_ai_usage
-- Per D-01..D-17 in .planning/phases/06-billing-subscription-enforcement/06-CONTEXT.md
-- ============================================================================

-- -------- subscriptions (D-08) --------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  tier text NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'team', 'enterprise')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  past_due_since timestamptz,  -- D-17: 7-day grace period anchor
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON public.subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- -------- usage_tracking (D-04, matches existing subscriptionService query shape) --------
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('ai_idea')),
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_type)
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_tracking_select_own ON public.usage_tracking;
CREATE POLICY usage_tracking_select_own ON public.usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- -------- user_notifications (D-16, BILL-02) --------
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('payment_failed', 'subscription_canceled', 'quota_warning')),
  message text NOT NULL,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_notifications_select_own ON public.user_notifications;
CREATE POLICY user_notifications_select_own ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_notifications_update_own ON public.user_notifications;
CREATE POLICY user_notifications_update_own ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -------- stripe_webhook_events (idempotency, research §2) --------
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No SELECT policy: never user-readable

-- -------- increment_ai_usage (D-04, D-05, D-12) --------
-- Atomic upsert: inserts new row, or increments existing; resets counter to 1
-- when the stored period_start is older than the current calendar month.
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_period_start date := date_trunc('month', now())::date;
  v_new_count int;
BEGIN
  INSERT INTO public.usage_tracking (user_id, resource_type, period_start, count, updated_at)
  VALUES (p_user_id, 'ai_idea', v_period_start, 1, now())
  ON CONFLICT (user_id, resource_type) DO UPDATE
    SET count = CASE
          WHEN usage_tracking.period_start < v_period_start THEN 1
          ELSE usage_tracking.count + 1
        END,
        period_start = v_period_start,
        updated_at = now()
    RETURNING count INTO v_new_count;
  RETURN v_new_count;
END;
$$;

-- -------- get_current_ai_usage (D-05 read-path reset) --------
CREATE OR REPLACE FUNCTION public.get_current_ai_usage(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_period_start date := date_trunc('month', now())::date;
  v_count int;
  v_row_period date;
BEGIN
  SELECT count, period_start INTO v_count, v_row_period
    FROM public.usage_tracking
    WHERE user_id = p_user_id AND resource_type = 'ai_idea';

  IF v_count IS NULL THEN
    RETURN 0;
  END IF;

  IF v_row_period < v_period_start THEN
    RETURN 0;  -- stale period, caller should treat as zero
  END IF;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_ai_usage(uuid) TO authenticated, service_role;
