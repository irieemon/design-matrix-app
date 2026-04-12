-- ============================================================================
-- ADR-0013 Step 1: Model Profiles table + ai_token_usage profile_name column
-- Creates: model_profiles (with seed data), profile_name on ai_token_usage
-- ============================================================================

-- ============================================================================
-- 1. model_profiles table
-- ============================================================================

CREATE TABLE public.model_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  task_configs JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.model_profiles IS
  'AI model profiles: budget/balanced/premium. One active at a time. ADR-0013.';
COMMENT ON COLUMN public.model_profiles.task_configs IS
  'JSONB map of TaskType -> { gatewayModelId, fallbackModels, temperature, maxOutputTokens }';

-- updated_at trigger (reuses existing function from fix_security_warnings migration)
CREATE TRIGGER update_model_profiles_updated_at
  BEFORE UPDATE ON public.model_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. RLS policies
-- ============================================================================

ALTER TABLE public.model_profiles ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT (getActiveProfile() uses supabaseAdmin, bypasses RLS)
CREATE POLICY model_profiles_select_admin
  ON public.model_profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins get full CRUD
CREATE POLICY model_profiles_admin_all
  ON public.model_profiles
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- 3. Seed three profiles (budget, balanced, premium)
--    balanced is the default active profile
-- ============================================================================

INSERT INTO public.model_profiles (name, display_name, description, is_active, task_configs)
VALUES
  (
    'budget',
    'Budget',
    'Cost-optimized profile using Gemini Flash and DeepSeek for routine tasks',
    false,
    '{
      "generate-ideas": {
        "gatewayModelId": "google/gemini-2.5-flash",
        "fallbackModels": ["deepseek/deepseek-v3.2"],
        "temperature": 0.8,
        "maxOutputTokens": 4096
      },
      "generate-insights": {
        "gatewayModelId": "google/gemini-2.5-flash",
        "fallbackModels": ["deepseek/deepseek-v3.2"],
        "temperature": 0.5,
        "maxOutputTokens": 4096
      },
      "generate-roadmap": {
        "gatewayModelId": "google/gemini-2.5-flash",
        "fallbackModels": ["deepseek/deepseek-v3.2"],
        "temperature": 0.6,
        "maxOutputTokens": 8192
      },
      "analyze-image": {
        "gatewayModelId": "openai/gpt-4o",
        "fallbackModels": ["google/gemini-2.5-flash"],
        "temperature": 0.3,
        "maxOutputTokens": 4096
      },
      "analyze-video": {
        "gatewayModelId": "openai/gpt-4o",
        "fallbackModels": ["google/gemini-2.5-flash"],
        "temperature": 0.3,
        "maxOutputTokens": 4096
      },
      "analyze-file": {
        "gatewayModelId": "google/gemini-2.5-flash",
        "fallbackModels": ["deepseek/deepseek-v3.2"],
        "temperature": 0.3,
        "maxOutputTokens": 4096
      },
      "transcribe-summary": {
        "gatewayModelId": "google/gemini-2.5-flash",
        "fallbackModels": ["deepseek/deepseek-v3.2"],
        "temperature": 0.0,
        "maxOutputTokens": 4096
      }
    }'::jsonb
  ),
  (
    'balanced',
    'Balanced',
    'Default profile balancing quality and cost with Claude Sonnet and GPT-5.4',
    true,
    '{
      "generate-ideas": {
        "gatewayModelId": "anthropic/claude-sonnet-4.6",
        "fallbackModels": ["google/gemini-2.5-flash"],
        "temperature": 0.8,
        "maxOutputTokens": 4096
      },
      "generate-insights": {
        "gatewayModelId": "anthropic/claude-sonnet-4.6",
        "fallbackModels": ["google/gemini-2.5-flash"],
        "temperature": 0.5,
        "maxOutputTokens": 4096
      },
      "generate-roadmap": {
        "gatewayModelId": "anthropic/claude-sonnet-4.6",
        "fallbackModels": ["openai/gpt-5.4-mini"],
        "temperature": 0.6,
        "maxOutputTokens": 8192
      },
      "analyze-image": {
        "gatewayModelId": "openai/gpt-5.4",
        "fallbackModels": ["anthropic/claude-sonnet-4.6"],
        "temperature": 0.3,
        "maxOutputTokens": 4096
      },
      "analyze-video": {
        "gatewayModelId": "openai/gpt-5.4",
        "fallbackModels": ["anthropic/claude-sonnet-4.6"],
        "temperature": 0.3,
        "maxOutputTokens": 4096
      },
      "analyze-file": {
        "gatewayModelId": "anthropic/claude-sonnet-4.6",
        "fallbackModels": ["google/gemini-2.5-flash"],
        "temperature": 0.3,
        "maxOutputTokens": 4096
      },
      "transcribe-summary": {
        "gatewayModelId": "anthropic/claude-haiku-4.5",
        "fallbackModels": ["google/gemini-2.5-flash"],
        "temperature": 0.0,
        "maxOutputTokens": 4096
      }
    }'::jsonb
  ),
  (
    'premium',
    'Premium',
    'Maximum quality profile using Claude Opus and GPT-5.4 for all tasks',
    false,
    '{
      "generate-ideas": {
        "gatewayModelId": "anthropic/claude-opus-4.6",
        "fallbackModels": ["openai/gpt-5.4"],
        "temperature": 0.8,
        "maxOutputTokens": 4096
      },
      "generate-insights": {
        "gatewayModelId": "anthropic/claude-opus-4.6",
        "fallbackModels": ["openai/gpt-5.4"],
        "temperature": 0.5,
        "maxOutputTokens": 4096
      },
      "generate-roadmap": {
        "gatewayModelId": "anthropic/claude-opus-4.6",
        "fallbackModels": ["openai/gpt-5.4"],
        "temperature": 0.6,
        "maxOutputTokens": 8192
      },
      "analyze-image": {
        "gatewayModelId": "openai/gpt-5.4",
        "fallbackModels": ["anthropic/claude-opus-4.6"],
        "temperature": 0.3,
        "maxOutputTokens": 4096
      },
      "analyze-video": {
        "gatewayModelId": "openai/gpt-5.4",
        "fallbackModels": ["anthropic/claude-opus-4.6"],
        "temperature": 0.3,
        "maxOutputTokens": 4096
      },
      "analyze-file": {
        "gatewayModelId": "anthropic/claude-opus-4.6",
        "fallbackModels": ["openai/gpt-5.4"],
        "temperature": 0.3,
        "maxOutputTokens": 4096
      },
      "transcribe-summary": {
        "gatewayModelId": "anthropic/claude-sonnet-4.6",
        "fallbackModels": ["openai/gpt-5.4-mini"],
        "temperature": 0.0,
        "maxOutputTokens": 4096
      }
    }'::jsonb
  );

-- ============================================================================
-- 4. Add profile_name to ai_token_usage for cost attribution
-- ============================================================================

ALTER TABLE public.ai_token_usage
  ADD COLUMN profile_name TEXT;

CREATE INDEX idx_ai_token_usage_profile
  ON public.ai_token_usage(profile_name)
  WHERE profile_name IS NOT NULL;

COMMENT ON COLUMN public.ai_token_usage.profile_name IS
  'Name of the active model profile when this AI call was made. ADR-0013.';

-- ============================================================================
-- ROLLBACK (manual — run these statements to reverse this migration)
-- ============================================================================
-- DROP INDEX IF EXISTS idx_ai_token_usage_profile;
-- ALTER TABLE public.ai_token_usage DROP COLUMN IF EXISTS profile_name;
-- DROP TRIGGER IF EXISTS update_model_profiles_updated_at ON public.model_profiles;
-- DROP POLICY IF EXISTS model_profiles_admin_all ON public.model_profiles;
-- DROP POLICY IF EXISTS model_profiles_select_admin ON public.model_profiles;
-- DROP TABLE IF EXISTS public.model_profiles;
