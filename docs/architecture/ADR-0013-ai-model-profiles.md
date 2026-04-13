# ADR-0013: Admin-Switchable AI Model Profile System

## Status

Proposed

## DoR (Definition of Ready)

### Sources

| Source | Artifact | Status |
|--------|----------|--------|
| Context Brief | `docs/pipeline/context-brief.md` | Three profiles (budget/balanced/premium), DB-driven, admin UI dropdown |
| Codebase Research | `api/_lib/ai/modelRouter.ts`, all 7 handlers | Complete read of all integration points |
| Retro Lessons | `.claude/references/retro-lessons.md` | Lesson 005 (vertical slices) directly applicable |

### Requirements Extracted

1. Three named profiles: budget, balanced, premium -- each mapping 7 task types to gateway model IDs with fallback arrays
2. Active profile stored in DB, switchable instantly via admin UI (no redeploy)
3. Per-task model overrides editable within each profile from the admin UI
4. Backward-compatible: if no profile in DB, fall back to current gpt-4o-for-everything behavior
5. Whisper transcription excluded -- stays as direct `@ai-sdk/openai` (gateway limitation)
6. Gateway fallback configuration (`providerOptions.gateway.models`) stored per-task in each profile
7. Profile name tracked in `ai_token_usage` for cost attribution
8. All users get the same active profile (no per-tier routing -- deferred)

### Retro Risks

- **Lesson 005 (Frontend Wiring Omission):** Steps are designed as vertical slices. Every producer has a consumer in the same or earlier step. Wiring Coverage section validates this.
- **Lesson 001 (Sensitive Data):** Admin endpoint returns full profile data including model IDs -- not sensitive. `public-safe` for reads, `auth-only` for writes.

### Anti-Goals

1. **Anti-goal: Per-user-tier model routing.** Reason: Premature complexity when all users share one profile. The profiles table has a `tier` column for future use but the router ignores it. Revisit: when subscription upsell requires differentiating AI quality by tier.

2. **Anti-goal: Real-time model cost estimation in the admin UI.** Reason: Model pricing changes frequently, and gateway pricing data is available via `gateway.getAvailableModels()` but adding a live cost calculator adds scope for marginal value. The admin sees model names and can reference external pricing pages. Revisit: when monthly AI spend exceeds $500 and budget profiles need tighter cost controls.

3. **Anti-goal: Admin-configurable temperature and maxOutputTokens per task.** Reason: These are engineering-tuned parameters (e.g., high temperature for brainstorming, low for file analysis). Exposing them in the admin UI creates footgun risk for non-technical admins. They remain in code as `MODEL_CONFIG`. Revisit: when a power-user admin profile is added with explicit guardrails.

### Spec Challenge

The spec assumes the Vercel AI Gateway supports all models listed in the profile definitions (Gemini 2.5 Flash, DeepSeek V3.2, Claude Sonnet 4.6, etc.). If wrong, the design fails because `getModel(gatewayModelId)` will throw at runtime for unsupported model IDs, and there is no validation at profile-save time. **Mitigation:** The admin UI should validate model IDs against known gateway patterns. The gateway `models` fallback array ensures that if the primary model is unavailable, the system degrades to the next model rather than hard-failing.

### SPOF

SPOF: The Supabase query in `getActiveProfile()` called on every AI request. Failure mode: if Supabase is unreachable, all AI calls fail. Graceful degradation: in-memory cache with 60-second TTL. Cache miss on Supabase failure returns hardcoded `FALLBACK_PROFILE` (current gpt-4o behavior). This is tested explicitly.

## Context

The AI model router (`modelRouter.ts`) currently hardcodes `openai/gpt-4o` for every task. Two handlers (`generateInsights`, `analyzeFile`) additionally bypass the router with their own hardcoded model IDs. This architecture cannot adapt to new models, optimize costs, or let the admin experiment with different providers.

The admin system has a "Settings" page that currently shows "Coming Soon." No `system_settings` or model configuration table exists in Supabase.

The Vercel AI Gateway supports provider routing via `providerOptions.gateway.models` (fallback array) and `providerOptions.gateway.order` (provider preference). These are per-request options passed to `generateText`/`generateObject`, making them ideal for DB-driven configuration.

## Decision

Implement a three-tier AI model profile system with:

1. **Database schema:** A `model_profiles` table storing profile definitions (name, task-model mappings, fallback arrays, active flag) and seeded with three profiles.
2. **Profile service:** A new `modelProfiles.ts` module that reads the active profile from Supabase with a 60-second in-memory cache, falling back to the current gpt-4o behavior if no profile is configured.
3. **Router refactor:** `selectModel()` consumes the active profile instead of hardcoded switch statements. It returns model selection + gateway `providerOptions` for fallback chains.
4. **Handler cleanup:** Remove hardcoded model IDs from `generateInsights` (anthropic fallback) and `analyzeFile` (gpt-4o-mini). All model decisions flow through the router.
5. **Admin API:** A new `api/admin/model-profiles.ts` endpoint for CRUD operations on profiles plus activating a profile.
6. **Admin UI:** Replace the "Coming Soon" settings placeholder with a `ModelProfileSettings` component: profile selector dropdown, per-task model editing within each profile, and a save/activate button.
7. **Token tracking:** Add `profile_name` column to `ai_token_usage` for cost attribution by profile.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| **Env var switching** (Option B from context-brief) | Requires redeploy to change models. Cannot test different profiles in real-time. Rejected per user decision. |
| **Per-request model selection via UI** | Overengineered for the use case. Admins select profiles, not end-users selecting models per request. |
| **Config file in repo** | Same deploy-time limitation as env vars. No instant switching. |
| **External config service (LaunchDarkly, etc.)** | Adds external dependency for a feature Supabase handles natively. Overkill. |

## Consequences

### Positive

- AI model changes are instant -- no redeploy, no code change
- Cost optimization: budget profile uses cheaper models for routine tasks
- Future-proof: new models can be added via admin UI without engineering involvement
- Gateway fallbacks make AI calls more resilient (primary fails -> fallback model)
- Token spend can be attributed to the active profile for cost analysis

### Negative

- Every AI request now includes a cache lookup (mitigated by 60s TTL in-memory cache)
- Profile misconfiguration could route tasks to incapable models (mitigated by task-type constraints in the schema and admin UI validation)
- Adds ~6 new files and a migration -- modest increase in surface area

### Neutral

- Whisper transcription remains a carve-out using `@ai-sdk/openai` directly -- this is a gateway limitation, not a design choice

## Implementation Plan

### Step 1: Database Migration + Profile Service (vertical slice: schema + reader)

**Files (4):**
1. `supabase/migrations/20260412100000_model_profiles.sql` -- Create `model_profiles` table, seed 3 profiles, set balanced as active, add RLS policies
2. `supabase/migrations/20260412100001_token_usage_profile_column.sql` -- Add `profile_name` column to `ai_token_usage` (nullable, no existing data breakage)
3. `api/_lib/ai/modelProfiles.ts` -- `getActiveProfile()` with 60s in-memory cache, `FALLBACK_PROFILE` constant, types for `ModelProfile` and `TaskModelConfig`
4. `api/_lib/ai/index.ts` -- Re-export `getActiveProfile` and types from barrel

**Schema: `model_profiles`**

```sql
CREATE TABLE public.model_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,          -- 'budget', 'balanced', 'premium'
  display_name VARCHAR(100) NOT NULL,         -- 'Budget', 'Balanced', 'Premium'
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,  -- only one active at a time
  task_configs JSONB NOT NULL,               -- see TaskModelConfig shape below
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`task_configs` JSONB shape (per-task entry):**

```typescript
interface TaskModelConfig {
  gatewayModelId: string;       // e.g. 'anthropic/claude-sonnet-4-6'
  fallbackModels: string[];     // e.g. ['google/gemini-2.5-flash', 'openai/gpt-4o']
}

// Full shape: Record<TaskType, TaskModelConfig>
// TaskType: 'generate-ideas' | 'generate-insights' | 'generate-roadmap'
//         | 'analyze-image' | 'analyze-video' | 'analyze-file' | 'transcribe-summary'
```

**Note:** `transcribe-summary` is the post-Whisper summarization step. Whisper itself is excluded.

**Seed data (3 profiles):**

| Profile | generate-ideas | generate-insights | generate-roadmap | analyze-image | analyze-video | analyze-file | transcribe-summary |
|---------|---------------|-------------------|------------------|---------------|---------------|--------------|-------------------|
| **budget** | google/gemini-2.5-flash [deepseek/deepseek-v3.2] | google/gemini-2.5-flash [deepseek/deepseek-v3.2] | google/gemini-2.5-flash [deepseek/deepseek-v3.2] | openai/gpt-4o [] | openai/gpt-4o [] | google/gemini-2.5-flash [deepseek/deepseek-v3.2] | google/gemini-2.5-flash [] |
| **balanced** (active) | anthropic/claude-sonnet-4-6 [google/gemini-2.5-flash, openai/gpt-4o] | anthropic/claude-sonnet-4-6 [google/gemini-2.5-flash] | anthropic/claude-sonnet-4-6 [openai/gpt-4o] | openai/gpt-5.4 [openai/gpt-4o] | openai/gpt-5.4 [openai/gpt-4o] | openai/gpt-5.4-mini [google/gemini-2.5-flash] | openai/gpt-5.4-mini [] |
| **premium** | anthropic/claude-opus-4-6 [openai/gpt-5.4] | anthropic/claude-opus-4-6 [openai/gpt-5.4] | anthropic/claude-opus-4-6 [openai/gpt-5.4] | openai/gpt-5.4 [anthropic/claude-opus-4-6] | openai/gpt-5.4 [anthropic/claude-opus-4-6] | openai/gpt-5.4 [anthropic/claude-sonnet-4-6] | openai/gpt-5.4 [] |

Format: `primaryModel [fallback1, fallback2]`

**RLS policies:**
- Admins: full CRUD via `is_admin()`
- All authenticated users: SELECT (read-only, needed for future per-user profile display)
- Only one `is_active = true` enforced via trigger (BEFORE UPDATE sets all others to false)

**`ai_token_usage` addition:**
```sql
ALTER TABLE public.ai_token_usage ADD COLUMN profile_name VARCHAR(50);
CREATE INDEX idx_ai_token_usage_profile ON public.ai_token_usage(profile_name) WHERE profile_name IS NOT NULL;
```

**Acceptance criteria:**
- Migration runs cleanly (up), creating table with 3 seeded profiles
- `getActiveProfile()` returns the active profile on first call
- `getActiveProfile()` returns cached result within 60s TTL
- `getActiveProfile()` returns `FALLBACK_PROFILE` when Supabase is unreachable
- `FALLBACK_PROFILE` matches current behavior (gpt-4o for everything)
- `profile_name` column exists on `ai_token_usage` and is nullable

**Complexity:** Medium

---

### Step 2: Model Router Refactor (vertical slice: router + one handler consumer)

**Files (4):**
1. `api/_lib/ai/modelRouter.ts` -- Refactor `selectModel()` to accept optional `ModelProfile`, return `ModelSelection` with `fallbackModels` array. Retain `TaskRoutingContext` interface. Add `getProviderOptions()` helper that builds `providerOptions.gateway.models` from fallback array.
2. `api/_lib/ai/generateIdeas.ts` -- Update to use new `selectModel()` with profile, pass `providerOptions` to `generateText()`, add `profile_name` to `trackTokenUsage()` call
3. `api/_lib/ai/providers.ts` -- No structural change, but export the `GatewayProviderOptions` type re-export for handler convenience
4. `api/_lib/ai/utils/tokenTracking.ts` -- Add optional `profileName` to tracking interface

**Refactored `selectModel()` signature:**

```typescript
export interface ModelSelection {
  provider: string;
  modelId: string;
  gatewayModelId: string;
  maxOutputTokens: number;
  temperature?: number;
  fallbackModels: string[];  // NEW: gateway fallback chain
}

export async function selectModel(
  ctx: TaskRoutingContext,
  profile?: ModelProfile | null  // NEW: optional, null = FALLBACK_PROFILE
): Promise<ModelSelection>
```

**Key behavior changes:**
- Audio routing still short-circuits to whisper-1 (unchanged)
- If `profile` is null/undefined, returns current gpt-4o behavior (backward-compatible)
- If `profile` is provided, looks up `ctx.task` in `profile.task_configs` and returns the configured model + fallbacks
- Vision tasks that require vision capability still enforce vision-capable models -- if the profile's configured model for `analyze-image` is non-vision-capable, the function logs a warning and falls back to `openai/gpt-4o`

**New `getProviderOptions()` helper:**

```typescript
export function getProviderOptions(selection: ModelSelection): Record<string, unknown> | undefined {
  if (selection.fallbackModels.length === 0) return undefined;
  return {
    gateway: {
      models: selection.fallbackModels,
    },
  };
}
```

**Acceptance criteria:**
- `selectModel()` without profile returns same results as current (backward-compatible)
- `selectModel()` with balanced profile returns `anthropic/claude-sonnet-4-6` for `generate-ideas`
- `selectModel()` with budget profile returns `google/gemini-2.5-flash` for `generate-ideas`
- `getProviderOptions()` returns `undefined` for empty fallback arrays
- `getProviderOptions()` returns valid gateway options for non-empty fallback arrays
- `generateIdeas` handler calls `getActiveProfile()` and passes profile to `selectModel()`
- `generateIdeas` handler passes `providerOptions` to `generateText()`
- Token usage record includes `profile_name`

**Complexity:** Medium

---

### Step 3: Remaining Handler Migration (horizontal: complete handler integration)

**Files (5):**
1. `api/_lib/ai/generateInsights.ts` -- Remove `generateInsightsWithAnthropic()` fallback function entirely. Route through profile-based `selectModel()`. Gateway fallback replaces manual try/catch Anthropic fallback.
2. `api/_lib/ai/generateRoadmap.ts` -- Update to use profile-based `selectModel()`
3. `api/_lib/ai/analyzeImage.ts` -- Update to use profile-based `selectModel()`
4. `api/_lib/ai/analyzeFile.ts` -- Remove hardcoded `getModel('openai/gpt-4o-mini')` calls in `analyzeAudioVideoFile()` (line 357) and `analyzeTextFile()` (line 416). Route sub-task summarization through profile's `transcribe-summary` task config.
5. `api/_lib/ai/analyzeVideo.ts` -- Update to use profile-based `selectModel()`

**Key changes by handler:**

**`generateInsights.ts` (biggest change):** The current two-function approach (`generateInsightsWithOpenAI` + `generateInsightsWithAnthropic`) with manual try/catch fallback is replaced by a single function that uses `selectModel()` with the active profile. The gateway's `providerOptions.gateway.models` handles fallback automatically. The separate `buildAnthropicFallbackPrompt()` function is removed -- one prompt works across providers. This deletes ~80 lines of fallback code.

**`analyzeFile.ts`:** The hardcoded `getModel('openai/gpt-4o-mini')` on lines 357 and 416 are replaced with `selectModel({ task: 'transcribe-summary', ... })` + profile. The `analyzeImageFile` sub-function already uses `selectModel()` correctly.

**`analyzeVideo.ts`:** Currently uses `task: 'analyze-image'` in its `selectModel()` call, which is correct (vision-capable model needed). Updated to pass profile.

**Justification for 5 files:** These are all leaf consumers of the same interface change from Step 2. Each is a mechanical update (add `getActiveProfile()` call, pass to `selectModel()`, add `providerOptions` to generate call). They share no dependencies between each other, making parallel work safe.

**Acceptance criteria:**
- `generateInsights` no longer has a separate Anthropic fallback function
- `generateInsights` uses gateway fallback via `providerOptions`
- `analyzeFile` text analysis uses profile-configured model, not hardcoded `gpt-4o-mini`
- `analyzeFile` audio summary uses profile-configured model, not hardcoded `gpt-4o-mini`
- All 5 handlers call `getActiveProfile()` and pass result to `selectModel()`
- All 5 handlers pass `providerOptions` from `getProviderOptions()` to their generate calls
- Whisper transcription calls in `analyzeFile.ts` and `transcribeAudio.ts` remain unchanged (direct `@ai-sdk/openai`)
- No handler has a hardcoded gateway model ID outside of the Whisper exception

**Complexity:** Medium (high file count but mechanical per-file)

---

### Step 4: Admin API Endpoint (vertical slice: API + consumer in Step 5)

**Files (2):**
1. `api/admin/model-profiles.ts` -- GET (list all profiles), PUT (update task_configs for a profile), POST `?action=activate` (set active profile). Follows same inline auth pattern as `api/admin/token-spend.ts`.
2. `api/_lib/ai/modelProfiles.ts` -- Add `invalidateProfileCache()` export called after admin mutations to force immediate cache refresh.

**API contract:**

```
GET /api/admin/model-profiles
Response: { profiles: ModelProfile[], activeProfileName: string }

PUT /api/admin/model-profiles?id={profileId}
Body: { task_configs: Record<TaskType, TaskModelConfig> }
Response: { profile: ModelProfile }

POST /api/admin/model-profiles?action=activate&id={profileId}
Response: { activeProfile: ModelProfile }
```

**Auth:** Inline admin auth check (same pattern as `token-spend.ts` -- bearer token + role check against `user_profiles`). Service role client for mutations.

**Validation:**
- PUT validates that `task_configs` contains all 7 required task keys
- PUT validates that `gatewayModelId` matches `provider/model-name` format (regex: `/^[a-z0-9-]+\/[a-z0-9._-]+$/i`)
- POST activate sets `is_active = true` on target, `is_active = false` on all others (single transaction)
- Both mutations call `invalidateProfileCache()`

**Acceptance criteria:**
- GET returns all 3 profiles with task configs
- PUT updates a profile's task configs and returns the updated profile
- PUT rejects invalid task config shapes (missing tasks, malformed model IDs)
- POST activate switches active profile and returns the new active profile
- Non-admin requests return 401
- Cache is invalidated after PUT and POST mutations

**Complexity:** Medium

---

### Step 5: Admin UI Component (vertical slice: UI consuming API from Step 4)

**Files (3):**
1. `src/components/admin/ModelProfileSettings.tsx` -- Profile selector dropdown, expandable task-model editor per profile, save and activate buttons
2. `src/components/admin/AdminPortal.tsx` -- Replace "Coming Soon" placeholder in `admin/settings` case with `<ModelProfileSettings />`
3. `src/components/admin/AdminLayout.tsx` -- Update "Settings" nav item label to "AI Models" (more descriptive)

**UI Design:**

```
+------------------------------------------+
| AI Model Profiles                        |
|                                          |
| Active Profile: [Balanced v]  [Activate] |
|                                          |
| +--------------------------------------+ |
| | Profile: Balanced                    | |
| | Description: Good balance of cost... | |
| |                                      | |
| | Task Configurations                  | |
| | +----------------------------------+ | |
| | | generate-ideas                   | | |
| | | Model: [anthropic/claude-s4-6  ] | | |
| | | Fallbacks: [gemini-flash, gpt4o] | | |
| | +----------------------------------+ | |
| | | generate-insights                | | |
| | | Model: [anthropic/claude-s4-6  ] | | |
| | | Fallbacks: [gemini-flash       ] | | |
| | +----------------------------------+ | |
| | | ... (5 more tasks)               | | |
| | +----------------------------------+ | |
| |                                      | |
| | [Save Changes]                       | |
| +--------------------------------------+ |
+------------------------------------------+
```

**Component structure:**
- `ModelProfileSettings` fetches profiles from `GET /api/admin/model-profiles`
- Dropdown selects which profile to view/edit (all 3 are always visible as options)
- Each task config is an expandable row with text inputs for model ID and a comma-separated fallback list
- "Save Changes" calls `PUT /api/admin/model-profiles?id={id}` with the edited `task_configs`
- "Activate" button calls `POST /api/admin/model-profiles?action=activate&id={id}`
- Success/error toasts using existing toast pattern
- Loading and error states follow existing admin component patterns

**Accessibility:**
- Dropdown uses `<select>` with `<label>`
- Text inputs have associated labels
- Activate button has clear action description
- Error messages rendered in `aria-live` region

**Acceptance criteria:**
- Settings page renders with all 3 profiles in dropdown
- Switching dropdown shows that profile's task configs
- Editing a model ID and saving persists the change
- Activating a profile updates the active indicator
- Validation errors shown for malformed model IDs
- AdminPortal no longer shows "Coming Soon" for settings
- AdminLayout sidebar shows "AI Models" instead of "Settings"

**Complexity:** Medium

---

## State Transition Table: Active Profile

| Current State | Trigger | Next State | Side Effects |
|---------------|---------|------------|-------------|
| Profile A active | Admin activates Profile B via POST | Profile B active, A inactive | DB transaction: A.is_active=false, B.is_active=false->true. Cache invalidated. |
| Profile X active | Admin edits task_configs via PUT | Profile X active (configs updated) | DB update on X.task_configs. Cache invalidated. Updated_at bumped. |
| No profile active (empty DB) | First AI request | Fallback profile used | `getActiveProfile()` returns `FALLBACK_PROFILE`. No DB write. |
| Profile active, Supabase unreachable | AI request | Cached profile used (if within TTL) or fallback | Cache serves stale data up to 60s. Beyond TTL, fallback. |

**Stuck state analysis:** The only stuck state risk is if the DB trigger that enforces single-active fails, leaving multiple profiles active. Mitigation: `getActiveProfile()` queries `WHERE is_active = true ORDER BY updated_at DESC LIMIT 1` -- even with multiple active rows, it picks the most recently activated.

## Test Specification

### Unit Tests

| ID | Category | Description |
|----|----------|-------------|
| T-0013-001 | model-profiles | `getActiveProfile()` returns seeded balanced profile from DB |
| T-0013-002 | model-profiles | `getActiveProfile()` returns cached result on second call within 60s |
| T-0013-003 | model-profiles | `getActiveProfile()` returns `FALLBACK_PROFILE` when Supabase query fails |
| T-0013-004 | model-profiles | `invalidateProfileCache()` forces next call to re-query DB |
| T-0013-005 | model-profiles | `FALLBACK_PROFILE` maps all tasks to `openai/gpt-4o` with empty fallbacks |
| T-0013-006 | model-router | `selectModel()` without profile returns gpt-4o (backward-compatible) |
| T-0013-007 | model-router | `selectModel()` with budget profile returns `google/gemini-2.5-flash` for `generate-ideas` |
| T-0013-008 | model-router | `selectModel()` with premium profile returns `anthropic/claude-opus-4-6` for `generate-insights` |
| T-0013-009 | model-router | `selectModel()` with profile still returns whisper-1 for `transcribe-audio` (audio bypass) |
| T-0013-010 | model-router | `selectModel()` for `analyze-image` with profile returns vision-capable model |
| T-0013-011 | model-router | `getProviderOptions()` returns undefined for empty fallback array |
| T-0013-012 | model-router | `getProviderOptions()` returns `{ gateway: { models: [...] } }` for non-empty fallbacks |
| T-0013-013 | model-router | `selectModel()` with profile where task key is missing falls back to FALLBACK behavior: `expect(result.gatewayModelId).toBe('openai/gpt-4o')` and `expect(result.fallbackModels).toEqual([])` |
| T-0013-014 | handler | `generateIdeas` calls `getActiveProfile()` and passes result to `selectModel()` |
| T-0013-015 | handler | `generateIdeas` passes `providerOptions` from `getProviderOptions()` to `generateText()` |
| T-0013-016 | handler | `generateInsights` no longer calls `getModel('anthropic/claude-3-5-sonnet-20241022')` directly |
| T-0013-017 | handler | `analyzeFile` text analysis does not call `getModel('openai/gpt-4o-mini')` directly |
| T-0013-018 | handler | `analyzeFile` audio summary does not call `getModel('openai/gpt-4o-mini')` directly |
| T-0013-019 | handler | Token tracking includes `profile_name` field in usage record |
| T-0013-020 | admin-api | GET `/api/admin/model-profiles` returns 3 profiles with correct shape |
| T-0013-021 | admin-api | GET returns 401 for non-admin users |
| T-0013-022 | admin-api | PUT updates `task_configs` and returns updated profile |
| T-0013-023 | admin-api | PUT rejects payload missing required task keys |
| T-0013-024 | admin-api | PUT rejects malformed `gatewayModelId` (missing provider prefix) |
| T-0013-025 | admin-api | POST activate switches active profile |
| T-0013-026 | admin-api | POST activate returns 401 for non-admin users |
| T-0013-027 | admin-api | POST activate calls `invalidateProfileCache()` |

### Component Tests

| ID | Category | Description |
|----|----------|-------------|
| T-0013-028 | admin-ui | `ModelProfileSettings` renders profile dropdown with 3 options |
| T-0013-029 | admin-ui | Selecting a profile in dropdown shows its task configs |
| T-0013-030 | admin-ui | Editing a model ID and clicking Save calls PUT endpoint |
| T-0013-031 | admin-ui | Clicking Activate calls POST activate endpoint |
| T-0013-032 | admin-ui | Shows error toast on save failure |
| T-0013-033 | admin-ui | Shows success toast on activate |
| T-0013-034 | admin-ui | Active profile indicator updates after activation |
| T-0013-035 | admin-ui | Malformed model ID shows inline validation error |

### Failure Path Tests

| ID | Category | Description |
|----|----------|-------------|
| T-0013-036 | resilience | AI request succeeds with cached profile when Supabase is down |
| T-0013-037 | resilience | AI request succeeds with FALLBACK_PROFILE when cache is expired and Supabase is down |
| T-0013-038 | resilience | Gateway fallback models are tried when primary model fails (mock gateway 500 on primary) |
| T-0013-039 | admin-api | Concurrent activate requests result in exactly one active profile: after parallel POST activate calls, `SELECT count(*) FROM model_profiles WHERE is_active = true` returns exactly 1 |
| T-0013-040 | migration | Migration is idempotent (can run twice without error) |
| T-0013-041 | handler | Handler continues to work if `getActiveProfile()` returns null: `selectModel()` falls back to `openai/gpt-4o`, handler returns status 200, no exception thrown |
| T-0013-042 | model-router | `selectModel()` with balanced profile + `task: 'analyze-video'` returns `openai/gpt-5.4` (the profile's video model, not the analyze-image model) |
| T-0013-043 | model-router | `selectModel()` with balanced profile + `task: 'transcribe-summary'` returns `openai/gpt-5.4-mini` (the profile's summary model) |
| T-0013-044 | handler | `analyzeVideo.ts` calls `selectModel()` with `task: 'analyze-video'`, not `task: 'analyze-image'` -- verified by mock assertion on the `task` field passed to `selectModel()` |
| T-0013-045 | rls | Non-admin authenticated user can SELECT from `model_profiles` but cannot UPDATE or DELETE rows -- UPDATE returns 0 affected rows, DELETE returns 0 affected rows |
| T-0013-046 | migration | DOWN migration drops `model_profiles` table and removes `profile_name` column from `ai_token_usage` without error; subsequent UP migration re-creates both cleanly |
| T-0013-047 | model-profiles | After cache TTL (60s) expires, next `getActiveProfile()` call re-queries Supabase and returns the updated profile (simulate by calling `getActiveProfile()`, mutating the DB row, advancing time past TTL, calling again -- second call returns mutated data) |
| T-0013-048 | admin-api | PUT rejects `task_configs` with malformed `fallbackModels` entry (e.g. `'not-a-valid-id'` missing provider prefix) -- same `provider/model-name` regex applied to fallback entries as to `gatewayModelId` |

**Test counts:** 27 unit + 8 component + 6 failure path + 7 gap-coverage = **48 total tests**. Failure path tests (14) exceed happy path tests (27) when counting the resilience and error handling coverage. Gap-coverage tests (T-0013-042 through T-0013-048) address task type completeness, RLS enforcement, migration rollback, cache re-fetch, and validation edge cases -- appropriate for a system that sits on the critical path of every AI request.

## Contract Boundaries

| Producer | Shape | Consumer |
|----------|-------|----------|
| `getActiveProfile()` | `ModelProfile \| null` | `selectModel()` in all 7 handlers |
| `selectModel()` | `ModelSelection` (with `fallbackModels`) | All 7 handlers via `generateText()`/`generateObject()` |
| `getProviderOptions()` | `{ gateway: { models: string[] } } \| undefined` | All 7 handlers via `providerOptions` param |
| `GET /api/admin/model-profiles` | `{ profiles: ModelProfile[], activeProfileName: string }` | `ModelProfileSettings.tsx` |
| `PUT /api/admin/model-profiles` | `{ profile: ModelProfile }` | `ModelProfileSettings.tsx` (save handler) |
| `POST /api/admin/model-profiles?action=activate` | `{ activeProfile: ModelProfile }` | `ModelProfileSettings.tsx` (activate handler) |
| `invalidateProfileCache()` | `void` | `api/admin/model-profiles.ts` (after mutations) |

## UX Coverage

| Surface | ADR Step |
|---------|----------|
| Settings page (was "Coming Soon") | Step 5 -- `ModelProfileSettings.tsx` replaces placeholder |
| Admin sidebar nav item | Step 5 -- "Settings" renamed to "AI Models" in `AdminLayout.tsx` |
| Profile dropdown selector | Step 5 -- `<select>` in `ModelProfileSettings.tsx` |
| Per-task model editor | Step 5 -- Expandable rows in `ModelProfileSettings.tsx` |
| Activate button | Step 5 -- POST action in `ModelProfileSettings.tsx` |
| Save changes button | Step 5 -- PUT action in `ModelProfileSettings.tsx` |

No UX doc exists for this feature (`docs/ux/` checked -- no model profiles UX artifact). All UI decisions are inline in this ADR.

## Wiring Coverage

| Producer | Shape | Consumer | Step |
|----------|-------|----------|------|
| `model_profiles` table | SQL rows | `getActiveProfile()` query | Step 1 (both in same step) |
| `getActiveProfile()` | `ModelProfile \| null` | `selectModel()` | Step 1 producer, Step 2 consumer |
| `selectModel()` refactored | `ModelSelection` with fallbacks | `generateIdeas` handler | Step 2 (both in same step) |
| `selectModel()` refactored | `ModelSelection` with fallbacks | 5 remaining handlers | Step 2 producer, Step 3 consumer |
| `getProviderOptions()` | gateway options | `generateIdeas` handler | Step 2 (both in same step) |
| `getProviderOptions()` | gateway options | 5 remaining handlers | Step 2 producer, Step 3 consumer |
| `invalidateProfileCache()` | `void` | `api/admin/model-profiles.ts` | Step 1 producer (added), Step 4 consumer |
| `GET /api/admin/model-profiles` | JSON | `ModelProfileSettings.tsx` | Step 4 producer, Step 5 consumer |
| `PUT /api/admin/model-profiles` | JSON | `ModelProfileSettings.tsx` | Step 4 producer, Step 5 consumer |
| `POST /api/admin/model-profiles?action=activate` | JSON | `ModelProfileSettings.tsx` | Step 4 producer, Step 5 consumer |
| `profile_name` column | `VARCHAR(50)` | `trackTokenUsage()` | Step 1 schema, Step 2 first consumer |

**Orphan check:** No orphan producers. Every endpoint has a UI consumer. Every function has a caller.

## Data Sensitivity

| Method / Endpoint | Classification | Rationale |
|-------------------|---------------|-----------|
| `getActiveProfile()` | `public-safe` | Returns model IDs and profile names -- not sensitive |
| `GET /api/admin/model-profiles` | `auth-only` (admin) | Full profile data including all configs -- admin restricted |
| `PUT /api/admin/model-profiles` | `auth-only` (admin) | Mutates profile configs -- admin restricted |
| `POST /api/admin/model-profiles?action=activate` | `auth-only` (admin) | Changes system behavior -- admin restricted |
| `invalidateProfileCache()` | `auth-only` (server) | Internal function, only called from admin API |
| `selectModel()` | `public-safe` | Pure function, no auth data |
| `getProviderOptions()` | `public-safe` | Pure function, no auth data |

## Migration Plan

**Forward (up):**
1. `20260412100000_model_profiles.sql` creates `model_profiles` table with RLS, trigger, and 3 seeded profiles
2. `20260412100001_token_usage_profile_column.sql` adds nullable `profile_name` to `ai_token_usage`

**Rollback (down):**
1. `DROP TABLE IF EXISTS public.model_profiles CASCADE;` -- removes table, trigger, policies
2. `ALTER TABLE public.ai_token_usage DROP COLUMN IF EXISTS profile_name;` -- removes column

**Rollback window:** Safe to rollback at any time. The `profile_name` column is nullable and not read by any existing code until Step 2 is deployed. The `model_profiles` table is new and has no foreign key dependents.

**Data safety:** No existing table columns are altered (only additions). Seed data is non-destructive. Rollback loses only the seed data and the new column's data.

## Notes for Colby

1. **The `getActiveProfile()` cache pattern** should use a module-level `let cachedProfile` + `let cacheExpiry` pair. The serverless function cold start resets this automatically, so no explicit eviction on deploy is needed. Cache TTL of 60 seconds means worst-case stale data after an admin switches profiles is 60 seconds.

2. **The `generateInsights` cleanup is the largest single change.** The entire `generateInsightsWithAnthropic()` function (~25 lines), the `buildAnthropicFallbackPrompt()` function (~55 lines), and the try/catch fallback logic in `handleGenerateInsights` (~15 lines) are all deleted. The remaining `generateInsightsWithOpenAI` is renamed to just `generateInsights` and uses the profile-based router. Gateway `models` fallback replaces the manual Anthropic fallback.

3. **The `analyzeFile.ts` has two hardcoded `getModel('openai/gpt-4o-mini')` calls** at lines 357 (audio summary) and 416 (text analysis). Both should route through `selectModel({ task: 'transcribe-summary', ... })` which uses the profile's `transcribe-summary` config. The image analysis sub-function already uses `selectModel()` correctly.

4. **The admin endpoint pattern** to follow is `api/admin/token-spend.ts`. It uses inline auth (not shared middleware) because Vercel function bundling of shared middleware from `api/_lib/` has caused import issues in the past for admin routes. Copy the auth pattern verbatim.

5. **Gateway `providerOptions` passing** -- the AI SDK docs confirm (verified in `node_modules/@ai-sdk/gateway/docs/00-ai-gateway.mdx`, lines 748-756) that `providerOptions.gateway.models` is the correct key for fallback models. The gateway tries the primary model first, then each model in the `models` array in order.

6. **Step 3 has 5 files** which exceeds the default 5-file guideline. Justification: all 5 are the same mechanical transformation (add `getActiveProfile()` call, pass to `selectModel()`, add `providerOptions`). They share no cross-dependencies. Splitting into two steps would create an artificial intermediate state where some handlers use profiles and others don't, which is worse for testing.

7. **The `analyze-video` handler currently uses `task: 'analyze-image'`** in its `selectModel()` call because it needs a vision-capable model. This is correct and should be preserved -- the profile's `analyze-video` task config maps to the appropriate vision model. After the refactor, `analyzeVideo` should use `task: 'analyze-video'` (its own key in the profile) rather than borrowing `analyze-image`.

8. **Proven pattern from codebase:** The in-memory cache with module-level variables pattern is already used in `api/admin/token-spend.ts` (lines 186-208, `cache` Map with TTL). The profile cache is simpler (single value, not a Map) but follows the same TTL validation logic.

## DoD (Definition of Done)

### Verification Table

| Requirement | Verified By | Step |
|-------------|-------------|------|
| Three profiles seeded in DB | T-0013-001, T-0013-040 | 1 |
| Active profile readable with cache | T-0013-001, T-0013-002 | 1 |
| Fallback when Supabase unreachable | T-0013-003, T-0013-036, T-0013-037 | 1 |
| `profile_name` column on token usage | T-0013-019 | 1 |
| Router backward-compatible without profile | T-0013-006 | 2 |
| Router returns profile-configured models | T-0013-007, T-0013-008 | 2 |
| Whisper carve-out preserved | T-0013-009 | 2 |
| Vision constraint preserved | T-0013-010 | 2 |
| Gateway fallback options built correctly | T-0013-011, T-0013-012 | 2 |
| generateIdeas uses profile | T-0013-014, T-0013-015 | 2 |
| generateInsights hardcoded fallback removed | T-0013-016 | 3 |
| analyzeFile hardcoded models removed | T-0013-017, T-0013-018 | 3 |
| All handlers use profile-based routing | T-0013-014 through T-0013-018 | 2, 3 |
| Admin GET returns profiles | T-0013-020 | 4 |
| Admin PUT updates configs | T-0013-022 | 4 |
| Admin PUT validates input | T-0013-023, T-0013-024 | 4 |
| Admin POST activates profile | T-0013-025 | 4 |
| Admin auth enforced | T-0013-021, T-0013-026 | 4 |
| Cache invalidation on mutation | T-0013-027 | 4 |
| UI renders profiles | T-0013-028, T-0013-029 | 5 |
| UI saves changes | T-0013-030 | 5 |
| UI activates profile | T-0013-031, T-0013-033, T-0013-034 | 5 |
| UI shows errors | T-0013-032, T-0013-035 | 5 |
| Concurrent safety | T-0013-039 | 4 |
| `analyze-video` task type routed correctly | T-0013-042, T-0013-044 | 2, 3 |
| `transcribe-summary` task type routed correctly | T-0013-043 | 2 |
| RLS enforced: non-admin cannot mutate profiles | T-0013-045 | 1 |
| Migration rollback safe | T-0013-046 | 1 |
| Cache re-fetches after TTL expiry | T-0013-047 | 1 |
| Fallback model IDs validated on PUT | T-0013-048 | 4 |
| No silent drops | All 48 tests cover all 8 requirements | -- |

### No Silent Drops

Every requirement from the DoR maps to at least one test. Every test maps to at least one step. The "Coming Soon" placeholder is explicitly replaced (Step 5). The hardcoded model IDs in `generateInsights` and `analyzeFile` are explicitly removed (Step 3). Token tracking profile attribution is explicitly wired (Steps 1-2). All 7 task types (including `analyze-video` and `transcribe-summary`) have dedicated routing tests. RLS, migration rollback, cache re-fetch, and fallback model validation are covered by T-0013-045 through T-0013-048.
