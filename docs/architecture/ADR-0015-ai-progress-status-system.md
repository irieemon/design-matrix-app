# ADR-0015: AI Generation Progress & Status System

## Status

Proposed

## DoR -- Definition of Ready

| # | Requirement | Source | Status |
|---|---|---|---|
| R1 | Shared AIProgressOverlay extracted from AIInsightsModal gold standard (lines 390-468) | Feature spec S7.1, UX doc S2a | Ready |
| R2 | AIProgressOverlay wired into all 7 generation points (insights, roadmap, batch ideas, text, image, audio, video) | Feature spec AC-1, UX doc S7 | Ready |
| R3 | useAIGeneration hook with AbortController, progress simulation, cancel, error handling | Feature spec S7.4, UX doc S3d | Ready |
| R4 | Cancel aborts fetch via AbortController, closes modal, no partial results, no toast | Feature spec AC-2, UX doc S1b | Ready |
| R5 | Post-completion success toast via existing ToastContext (3s auto-dismiss) | Feature spec AC-3, UX doc S2b | Ready |
| R6 | AIQuotaBadge in sidebar footer (desktop) and MobileTopBar, free-tier only | Feature spec AC-4/AC-5, UX doc S2c | Ready |
| R7 | useAIQuota hook with 60s cache, refresh() on generation complete | Feature spec S7.3, UX doc note 2 for Cal | Ready |
| R8 | QuotaExhaustedModal with usage count, reset date, upgrade CTA | Feature spec AC-11, UX doc S2d | Ready |
| R9 | GET /api/ai/quota-status endpoint for frontend pre-check | Feature spec S10.1 | Ready |
| R10 | Roadmap endpoint enforces quota via checkLimit + trackAIUsage | Feature spec AC-7/AC-9, confirmed gap in generateRoadmap.ts | Ready |
| R11 | Insights endpoint enforces quota via checkLimit + trackAIUsage | Feature spec AC-8/AC-9, confirmed gap in generateInsights.ts | Ready |
| R12 | Free-tier limit standardized to 5/month (fix backend 10 -> 5) | Feature spec S10.3, AC-10 | Ready |
| R13 | Mobile progress overlay usable on 375px, cancel button 44x44px touch target | Feature spec AC-12, UX doc S2a mobile layout | Ready |
| R14 | Component unmount aborts in-flight generation, no state-update-on-unmounted warnings | Feature spec AC-13 | Ready |
| R15 | BaseAiService.fetchWithErrorHandling signal support for AbortController | Feature spec S7.4, constraint from research brief | Ready |
| R16 | Quota badge refreshes after generation without page reload | Feature spec AC-6 | Ready |
| R17 | ADR-0013 model profile routing continues to work | Constraint (existing ADR) | Ready |
| R18 | ADR-0014 auth hardening continues to work | Constraint (existing ADR) | Ready |
| R19 | Screen reader announcements per UX doc S5a | UX doc S5a, Feature spec NFR | Ready |
| R20 | Reduced motion support per UX doc S5d | UX doc S5d | Ready |

**Retro risks:**
- **Lesson 005 (Frontend Wiring Omission):** Steps are designed as vertical slices. Every step that creates a hook or component includes its primary consumer. Wiring Coverage section validates no orphan producers.
- **Lesson 001 (Sensitive Data):** useAIQuota returns quota counts only (public-safe). No user credentials or payment data exposed. checkLimit on backend returns limit status (auth-only, gated by withAuth middleware).

## Context

Users initiating AI generation (roadmaps, insights, idea analysis) receive inconsistent feedback about operation progress. Three of seven generation points show only a spinner or disabled button with no progress indication, estimated time, or error recovery path. On mobile -- the primary brainstorming device -- this is indistinguishable from a crash.

Simultaneously, `generateRoadmap.ts` and `generateInsights.ts` have zero quota enforcement: no `checkLimit()` call, no `trackAIUsage()` call. Free-tier users can generate unlimited roadmaps and insights at full AI cost to the platform. The backend free-tier limit is 10 for ideas vs. 5 for roadmap/insights (a pre-existing bug preserved per D-07 in ADR-0013), while the frontend `tierLimits.ts` shows 5. This inconsistency must be resolved to 5 for all types.

The AIInsightsModal (lines 390-468) contains a gold-standard progress UI pattern: animated sapphire progress bar, stage text, estimated time countdown, processing steps checklist, and stage dot indicators. This pattern is hardcoded inline. It needs to be extracted into a shared component and wired into all 7 generation points.

### What Exists Today

| System | Status | Location |
|---|---|---|
| Toast notifications | Working, sufficient | `src/contexts/ToastContext.tsx` |
| Modal system | Working, sufficient | `src/components/shared/Modal.tsx` (BaseModal) |
| Progress pattern (gold standard) | Hardcoded in AIInsightsModal | `src/components/AIInsightsModal.tsx:390-468` |
| Subscription/tier info | Working | `src/hooks/useSubscription.ts`, `src/lib/config/tierLimits.ts` |
| Backend quota check | Working for ideas only | `api/_lib/services/subscriptionService.ts` (checkLimit, trackAIUsage) |
| Quota middleware | Working for project/user limits | `api/_lib/middleware/withQuotaCheck.ts` |
| AbortController | Used in auth hooks, not in AI services | `useAuth.ts`, `ProfileService.ts` |
| BaseAiService | Fixed in ADR-0014 (credentials, 401 retry) | `src/lib/ai/services/BaseAiService.ts` |

### What Is Missing

1. **No shared progress component** -- each modal rolls its own or has nothing
2. **No AbortController in AI fetches** -- no cancel capability
3. **No quota enforcement on roadmap/insights endpoints** -- cost leak
4. **No frontend quota visibility** -- users have no idea how many generations remain
5. **No pre-check endpoint** -- frontend cannot check quota before initiating generation
6. **Backend/frontend limit mismatch** -- 10 vs 5 for free-tier ideas

## Decision

**Extract a shared progress system (hook + component), add AbortController support to BaseAiService, create a quota visibility layer, and enforce quota on all AI endpoints.**

### Decision 1: useAIGeneration hook -- standalone, not wrapping useAsyncOperation

**Decision: New standalone hook.** `useAsyncOperation` manages generic loading/error/success state but knows nothing about progress simulation, AbortController lifecycle, or stage transitions. Composing them would mean useAIGeneration wraps useAsyncOperation to get `{ loading, error }` and then adds its own progress/stage/cancel state on top -- two state machines for one operation, with synchronization risk (what if `loading` and `isGenerating` disagree?).

A standalone hook owns the full lifecycle: AbortController creation, fetch with signal, progress simulation via setInterval, stage transitions at percentage thresholds, error/cancel/completion handling. One state machine, one source of truth.

### Decision 2: useAIQuota -- separate hook, CustomEvent for cross-component refresh

**Decision: New `useAIQuota` hook with `window.dispatchEvent(new CustomEvent('ai-quota-changed'))` for refresh signaling.** The alternatives were:

- **React Context:** Overkill. Only two consumers (AIQuotaBadge in sidebar, useAIGeneration on completion). A context provider would wrap the entire app for two consumers.
- **Direct import:** useAIGeneration would need to import useAIQuota and call `refresh()` directly. This couples the generation hook to the quota hook.
- **CustomEvent:** useAIGeneration dispatches `ai-quota-changed` on success. useAIQuota listens for it. Zero coupling. Testable by dispatching the event manually.

### Decision 3: Quota pre-check is advisory; server is authoritative

**Decision: Frontend pre-check via `GET /api/ai/quota-status` is advisory.** If the pre-check says "available" but the server returns 402 mid-generation (race condition: another tab used last quota), the frontend catches 402 and shows QuotaExhaustedModal. No retry. No error styling -- this is a quota event, shown with sapphire (upsell) styling, not garnet (error).

### Decision 4: AIProgressOverlay replaces modal content, not a portal overlay

**Decision: The overlay replaces the modal body content via a conditional render.** `{isGenerating ? <AIProgressOverlay ... /> : <NormalContent />}`. The modal header and close button remain visible. The close button (X) and Escape key trigger the same cancel flow as the Cancel button.

This avoids z-index layering issues and keeps the overlay within the modal's focus trap. Each of the 7 integration points adds one conditional. No higher-order wrapper needed -- the conditional is 3 lines per modal and crystal clear.

### Decision 5: AbortController signal threaded through BaseAiService

**Decision: Add optional `signal?: AbortSignal` parameter to `fetchWithErrorHandling()`.** The signal is passed directly to `fetch()`. useAIGeneration creates the AbortController and passes `controller.signal` through the AI service facade. When the user cancels, `controller.abort()` causes the fetch to reject with `AbortError`, which useAIGeneration catches and handles (reset state, close modal, no toast).

### Decision 6: Handler type signatures updated to AuthenticatedRequest

**Decision: Change `handleGenerateRoadmap` and `handleGenerateInsights` from `VercelRequest` to `AuthenticatedRequest`.** The compose middleware in `api/ai.ts` already runs `withAuth` which attaches `req.user`. The handlers' type signatures are wrong (they use `VercelRequest`), which is why they never accessed `req.user` for quota checks. Fixing the type enables `req.user!.id` for `checkLimit()` calls.

## Anti-Goals

1. **Anti-goal: Real-time server-sent progress events (SSE/WebSocket).** Reason: Client-side progress simulation is sufficient for v1. Server-side AI calls are single-request/single-response; there are no intermediate progress events to send. Adding SSE infrastructure for simulated progress is complexity without signal. Revisit: When streaming API responses (chunked generation) are implemented, real progress events become possible and valuable.

2. **Anti-goal: Per-operation-type quota limits (separate pools for ideas, roadmap, insights).** Reason: All AI types share a single monthly pool for v1. Separate pools add billing complexity and user confusion ("I have 3 idea credits but 0 roadmap credits?"). A single "5 AI generations" pool is simple and fair. Revisit: When analytics show users heavily skew toward one generation type, separate pools could optimize cost-per-type.

3. **Anti-goal: Background generation (user can navigate away, results appear later).** Reason: The feature spec explicitly scopes this out. Modal stays open during generation. Background generation requires a notification system, result storage, and a "pending results" UI -- significant scope. Revisit: When generation times exceed 30 seconds consistently, or when batch operations (generate 50 ideas) are introduced.

## Spec Challenge

**The spec assumes that simulated client-side progress (0-100% over an estimated time) will feel accurate enough to reduce abandonment.** If wrong, the design fails because the progress bar finishing at 95% and then sitting for 20 seconds while the server responds would feel worse than no progress at all. Mitigation: The deceleration curve (UX doc S3d) deliberately slows at 60%, crawls at 85%, and holds at 95%. The bar never hits 100% before the server responds. On actual completion, the bar jumps from wherever it is to 100% with a 500ms ease-out transition. Conservative time estimates (generous buffer) further reduce the chance of overtime.

**SPOF: The `GET /api/ai/quota-status` endpoint.** Failure mode: If the endpoint is down or slow, the AIQuotaBadge shows a loading skeleton indefinitely and pre-checks before generation fail. Graceful degradation: (1) AIQuotaBadge shows "-- AI" in muted style on fetch failure and silently retries after 60s. (2) Generate buttons remain enabled -- quota check runs server-side at generation time (server is authoritative). A failed pre-check does not block generation. The user may see a QuotaExhaustedModal after clicking Generate if they are actually over quota, which is acceptable degradation.

## Alternatives Considered

### A: Extend useAsyncOperation with progress/cancel support

Add `progress`, `stage`, `cancel()`, and `AbortSignal` to the existing `useAsyncOperation` hook.

**Rejected because:** useAsyncOperation is used by many non-AI features (general async state management). Adding AI-specific progress simulation, stage transitions, and AbortController lifecycle would bloat the generic hook. Consumers that do not need progress would carry dead code. Violates single-responsibility.

### B: Per-endpoint quota middleware (extend withQuotaCheck for AI types)

Extend `withQuotaCheck.ts` to handle `'ai_ideas' | 'ai_roadmap' | 'ai_insights'` resource types and apply it in `api/ai.ts` compose chain.

**Rejected because:** The AI router (`api/ai.ts`) dispatches to handlers by action query param, not by endpoint path. `withQuotaCheck` runs before dispatch and cannot know which action is being called. Quota check needs to happen inside each handler after action dispatch, using the handler-specific `limitType`. The existing pattern in `generateIdeas.ts` (inline checkLimit call) is the right approach.

### C: React Context for quota state

Wrap the app in an `AIQuotaProvider` context that fetches and caches quota status.

**Rejected because:** Only two consumers (AIQuotaBadge, useAIGeneration's post-completion refresh). A context provider wrapping the entire app tree for two consumers is disproportionate. CustomEvent achieves the same decoupling with zero component tree overhead.

## Consequences

### Positive
- All 7 AI generation points have consistent progress feedback
- Users can cancel in-flight generations (AbortController)
- Free-tier users see remaining quota in navigation
- Roadmap and insights endpoints enforce quota (cost leak closed)
- Frontend/backend limit mismatch fixed (5/month everywhere)
- Mobile brainstorming experience significantly improved

### Negative
- 7 modal files modified (conditional rendering for progress overlay) -- wide but shallow
- Progress simulation is approximate; real server time varies
- CustomEvent coupling is invisible to React DevTools (must know to look for it)

### Neutral
- Existing toast system unchanged
- Existing modal system unchanged
- ADR-0013 model profiles unaffected (no server-side model routing changes)
- ADR-0014 auth hardening preserved (BaseAiService changes are additive: optional signal parameter)

## Implementation Plan

### Step 1: Backend quota enforcement + limit fix + quota-status endpoint

**After this step, all AI endpoints enforce quota, free-tier limit is consistent at 5/month, and the frontend can pre-check quota.**

Files to modify:
- `api/_lib/ai/generateRoadmap.ts` -- add `checkLimit` before AI call, `trackAIUsage` after success, change type to `AuthenticatedRequest`
- `api/_lib/ai/generateInsights.ts` -- add `checkLimit` before AI call, `trackAIUsage` after success, change type to `AuthenticatedRequest`
- `api/_lib/services/subscriptionService.ts` -- fix free-tier limit from 10 to 5 (lines 157, 195)
- `api/ai.ts` -- add `quota-status` action to router switch, dispatch to new handler function

Files to create:
- `api/_lib/ai/quotaStatus.ts` -- `handleQuotaStatus(req, res)` handler: validates auth, calls `checkLimit()`, adds `resetsAt` field (first of next month), returns JSON

Acceptance criteria:
- `handleGenerateRoadmap` calls `checkLimit(req.user!.id, 'ai_roadmap')` before AI generation; returns 402 on quota exceeded
- `handleGenerateRoadmap` calls `trackAIUsage(req.user!.id, 'ai_roadmap')` after successful generation
- `handleGenerateInsights` calls `checkLimit(req.user!.id, 'ai_insights')` before AI generation; returns 402 on quota exceeded
- `handleGenerateInsights` calls `trackAIUsage(req.user!.id, 'ai_insights')` after successful generation
- `subscriptionService.ts` uses `const freeLimit = 5` (not `limitType === 'ai_ideas' ? 10 : 5`) at both lines 157 and 195
- `GET /api/ai?action=quota-status&type=ai_ideas` returns `{ canUse, current, limit, percentageUsed, isUnlimited, resetsAt }`
- 402 response shape matches spec: `{ error: { code: 'quota_exceeded', resource, limit, used, upgradeUrl } }`
- Existing `generateIdeas.ts` quota behavior unchanged (regression guard)

Complexity: Medium (5 files, 1 new handler)

### Step 2: useAIGeneration hook + AbortController signal in BaseAiService

**After this step, a reusable hook exists for AI generation with progress simulation, cancel, and error handling. BaseAiService supports AbortSignal.**

Files to modify:
- `src/lib/ai/services/BaseAiService.ts` -- add optional `signal?: AbortSignal` parameter to `fetchWithErrorHandling()`
- `src/lib/ai/AiServiceFacade.ts` -- thread `signal` parameter through all generation methods

Files to create:
- `src/hooks/useAIGeneration.ts` -- new hook: AbortController lifecycle, progress simulation (setInterval 100ms, deceleration curve per UX doc S3d), stage transitions at percentage thresholds, cancel(), isGenerating, progress, stage, estimatedSecondsRemaining, processingSteps, error
- `src/lib/ai/stageConfigs.ts` -- stage configuration constants per operation type (7 configs from feature spec S7.1)

Acceptance criteria:
- `fetchWithErrorHandling(endpoint, payload, isRetry, signal?)` passes `signal` to `fetch()` options
- `AiServiceFacade` methods accept optional `signal: AbortSignal` and pass through to service methods
- `useAIGeneration` hook returns `{ execute, cancel, isGenerating, progress, stage, estimatedSecondsRemaining, processingSteps, stageSequence, error, retry }`
- `execute()` creates AbortController, stores in ref, passes signal through facade
- `cancel()` calls `controller.abort()`, resets all state
- `useEffect` cleanup calls `cancel()` on unmount
- Progress simulation follows deceleration curve: 0-60% linear, 60-85% at 0.7x, 85-95% at 0.3x, holds at 95%
- Stage transitions at correct percentage thresholds based on stageConfig
- On server response: jumps to 100%, sets "Complete!" stage
- On AbortError: resets state silently (no error state, no toast)
- On server error (500): sets error state with message
- On 402 (quota exceeded): sets quotaExhausted state with response data
- Double-click prevention: `execute()` returns early if `isGenerating` is already true

Complexity: Medium (4 files, 2 new)

### Step 3: AIProgressOverlay + QuotaExhaustedModal components

**After this step, the shared progress UI and quota exhausted modal exist as reusable components with full accessibility and reduced-motion support.**

Files to create:
- `src/components/ui/AIProgressOverlay.tsx` -- extracted from AIInsightsModal gold standard pattern; props: `isActive, progress, stage, estimatedSecondsRemaining, processingSteps, stageSequence, onCancel, cancelable?, error?, onRetry?`; includes error state rendering (garnet bar, retry/close buttons); includes screen reader announcements via `aria-live`; supports `prefers-reduced-motion` via `motion-safe:` Tailwind variant
- `src/components/ui/QuotaExhaustedModal.tsx` -- uses BaseModal; sapphire styling; shows usage count, reset date (Intl.DateTimeFormat), upgrade CTA linking to /pricing; close button; focus management per UX doc S3e

Acceptance criteria:
- AIProgressOverlay renders progress bar (sapphire-600), stage text with icon, estimated time countdown, processing steps checklist, stage dot indicators (emerald completed, sapphire active, graphite pending)
- AIProgressOverlay error state: garnet bar, "Something went wrong", Retry + Close buttons
- AIProgressOverlay "overtime" state: countdown shows "Almost done..." when estimatedSecondsRemaining reaches 0
- Cancel button: ghost style, `aria-label="Cancel AI generation"`, meets 44x44px touch target on mobile (full-width on < 600px)
- Screen reader: `aria-live="polite"` for progress/stage changes, `aria-live="assertive"` for errors
- `prefers-reduced-motion`: pulse/bump animations disabled via `motion-safe:` variant
- QuotaExhaustedModal: heading "Monthly AI Limit Reached", body with limit count and reset date, "Upgrade to Team" CTA (sapphire-600 bg), "Close" ghost button
- QuotaExhaustedModal focus: Close button focused on mount (not upgrade, to avoid accidental purchase)
- WCAG 2.1 AA contrast ratios per UX doc S5c
- Both components render correctly at 375px mobile viewport

Complexity: Medium (2 new files, but substantial UI + accessibility requirements)

### Step 4: useAIQuota hook + AIQuotaBadge component + navigation wiring

**After this step, free-tier users see their AI usage in the sidebar and mobile top bar. The badge refreshes after each generation.**

Files to create:
- `src/hooks/useAIQuota.ts` -- fetches `GET /api/ai?action=quota-status&type=ai_ideas`, caches 60s, exposes `{ quota, isLoading, error, refresh }`, listens for `CustomEvent('ai-quota-changed')` to trigger refresh, returns null for team/enterprise (from useSubscription)
- `src/components/ui/AIQuotaBadge.tsx` -- displays `{used}/{limit} AI` pill; Sparkles icon in expanded mode; skeleton loading state; neutral/warning/exhausted/error styles per UX doc S2c; compact prop for collapsed sidebar/mobile; tooltip on exhausted hover; `animate-tally-bump` on count change; `aria-label` per usage state; hidden for team/enterprise

Files to modify:
- `src/components/Sidebar.tsx` -- add AIQuotaBadge in footer section (between user profile and admin button), both collapsed and expanded variants
- `src/components/mobile/MobileTopBar.tsx` -- add compact AIQuotaBadge between project selector and user avatar button

Acceptance criteria:
- useAIQuota fetches quota on mount, caches 60s, re-fetches on `ai-quota-changed` CustomEvent
- useAIQuota returns null (badge hidden) when subscription tier is team or enterprise
- AIQuotaBadge renders "3/5 AI" with correct style thresholds: 0-79% neutral, 80-99% amber, 100% garnet
- AIQuotaBadge shows skeleton pill during loading (`w-14 h-5 rounded-full bg-graphite-200 animate-shimmer`)
- AIQuotaBadge shows "-- AI" on fetch error with muted styling
- AIQuotaBadge hidden (not in DOM) for team/enterprise tiers
- Sidebar renders badge in footer (expanded: icon + text, collapsed: text only centered)
- MobileTopBar renders compact badge between project selector and user avatar
- Tooltip "Upgrade for unlimited" on exhausted badge hover/focus
- `aria-label` dynamically set per usage state per UX doc S2c
- `aria-live="polite"` region announces count changes (not on mount)
- `animate-tally-bump` plays on count change after generation

Complexity: Medium (4 files, 2 new + 2 modified)

### Step 5: Wire progress overlay into AIInsightsModal + ProjectRoadmap

**After this step, the two highest-value generation points (insights and roadmap) have the shared progress overlay with cancel, replacing the hardcoded progress in insights.**

Files to modify:
- `src/components/AIInsightsModal.tsx` -- replace inline progress UI (lines 390-468) with AIProgressOverlay; integrate useAIGeneration hook; add cancel button; dispatch `ai-quota-changed` on success; add quota pre-check; show QuotaExhaustedModal on exhausted; fire success toast on completion
- `src/components/ProjectRoadmap/ProjectRoadmap.tsx` -- add AIProgressOverlay inside roadmap generation flow; integrate useAIGeneration hook; add cancel button; dispatch `ai-quota-changed` on success; add quota pre-check; show QuotaExhaustedModal on exhausted; fire success toast on completion

Acceptance criteria:
- AIInsightsModal: inline progress (lines 390-468) replaced with `<AIProgressOverlay>` using insights stage config
- AIInsightsModal: useAIGeneration hook manages the generation lifecycle (progress, cancel, error)
- AIInsightsModal: Cancel button aborts fetch, closes modal, no partial results, no toast
- AIInsightsModal: Success toast "Insights generated successfully" (3s) after modal closes
- AIInsightsModal: Quota pre-check before generation; QuotaExhaustedModal on canUse: false
- ProjectRoadmap: AIProgressOverlay renders during roadmap generation with roadmap stage config
- ProjectRoadmap: Cancel button aborts fetch
- ProjectRoadmap: Success toast "Roadmap generated successfully" (3s)
- ProjectRoadmap: Quota pre-check; QuotaExhaustedModal on exhausted
- Both: `window.dispatchEvent(new CustomEvent('ai-quota-changed'))` on successful generation
- Both: 402 response mid-generation handled gracefully (QuotaExhaustedModal, not error state)
- Existing insights/roadmap functionality (caching, model selection, error handling) preserved

Complexity: Medium (2 files modified, but significant behavioral changes per file)

### Step 6: Wire progress overlay into AIIdeaModal + AIStarterModal

**After this step, all 7 generation points (text, image, audio, video from AIIdeaModal + batch from AIStarterModal) have the shared progress overlay.**

Files to modify:
- `src/components/AIIdeaModal.tsx` -- integrate useAIGeneration hook for all 4 input modes (text, image, audio, video); add AIProgressOverlay with per-mode stage config; add cancel button; dispatch `ai-quota-changed` on success; add quota pre-check; fire success toast "Idea created" (3s)
- `src/components/AIStarterModal.tsx` -- integrate useAIGeneration hook for batch idea generation; add AIProgressOverlay with batch ideas stage config; add cancel button; dispatch `ai-quota-changed` on success; add quota pre-check; fire success toast "{count} ideas generated" (3s)

Acceptance criteria:
- AIIdeaModal: AIProgressOverlay renders during each generation mode (text/image/audio/video) with the correct per-mode stage config
- AIIdeaModal: Cancel button aborts fetch for any mode
- AIIdeaModal: Success toast "Idea created" (3s) on completion
- AIIdeaModal: Quota pre-check; QuotaExhaustedModal on exhausted
- AIStarterModal: AIProgressOverlay renders during batch generation with batch ideas stage config
- AIStarterModal: Cancel button aborts fetch
- AIStarterModal: Success toast "{count} ideas generated" (3s) with dynamic count
- AIStarterModal: Quota pre-check; QuotaExhaustedModal on exhausted
- Both: `window.dispatchEvent(new CustomEvent('ai-quota-changed'))` on success
- Both: 402 mid-generation handled gracefully
- All existing idea creation functionality (file upload, audio recording, video processing, batch generation) preserved

Complexity: Medium (2 files modified, but multiple generation modes in AIIdeaModal)

## Test Specification

### Contract Boundaries

| Producer | Consumer | Shape | Contract Risk |
|---|---|---|---|
| `GET /api/ai?action=quota-status` | `useAIQuota` hook | `{ canUse, current, limit, percentageUsed, isUnlimited, resetsAt }` | High -- new endpoint, new consumer |
| `useAIGeneration` hook | AIProgressOverlay component | `{ progress, stage, estimatedSecondsRemaining, processingSteps, stageSequence }` | Medium -- many props, tight coupling |
| `useAIGeneration.execute()` | AiServiceFacade (via signal) | `AbortSignal` threaded to `fetch()` | High -- new parameter through 3 layers |
| `CustomEvent('ai-quota-changed')` | `useAIQuota.refresh()` | No payload (event name is contract) | Low -- fire-and-forget, no shape |
| `checkLimit()` in generateRoadmap/Insights | 402 response shape | `{ error: { code: 'quota_exceeded', resource, limit, used, upgradeUrl } }` | Medium -- must match frontend parsing |
| `subscriptionService.checkLimit` (limit=5) | `tierLimits.ts` (ai_ideas_per_month=5) | Both return 5 for free tier | Low after fix -- was the root inconsistency |
| `AiServiceFacade` methods (with signal) | `useAIGeneration.execute()` | All methods accept optional `signal: AbortSignal` | Medium -- additive parameter, all methods |
| `stageConfigs.ts` (7 configs) | `useAIGeneration` + AIProgressOverlay | `{ stages, steps, estimatedTime }` per operation type | Low -- static config, consumed by hook |

### Test Table

| ID | Category | Description | Step |
|---|---|---|---|
| T-0015-001 | unit | `handleQuotaStatus` returns correct shape `{ canUse, current, limit, percentageUsed, isUnlimited, resetsAt }` for free-tier user with 3/5 usage | 1 |
| T-0015-002 | unit | `handleQuotaStatus` returns `canUse: false` when usage equals limit (5/5) | 1 |
| T-0015-003 | unit | `handleQuotaStatus` returns `isUnlimited: true` for team-tier user | 1 |
| T-0015-004 | unit | `handleQuotaStatus` returns 401 when bearer token is missing | 1 |
| T-0015-005 | unit | `resetsAt` field is first day of next month in UTC ISO 8601 format | 1 |
| T-0015-006 | unit | `handleGenerateRoadmap` calls `checkLimit(userId, 'ai_roadmap')` before AI generation | 1 |
| T-0015-007 | unit | `handleGenerateRoadmap` returns 402 with `quota_exceeded` shape when `canUse: false` | 1 |
| T-0015-008 | unit | `handleGenerateRoadmap` calls `trackAIUsage(userId, 'ai_roadmap')` after successful generation | 1 |
| T-0015-009 | unit | `handleGenerateInsights` calls `checkLimit(userId, 'ai_insights')` before AI generation | 1 |
| T-0015-010 | unit | `handleGenerateInsights` returns 402 with `quota_exceeded` shape when `canUse: false` | 1 |
| T-0015-011 | unit | `handleGenerateInsights` calls `trackAIUsage(userId, 'ai_insights')` after successful generation | 1 |
| T-0015-012 | unit | `subscriptionService.checkAiLimit` returns `limit: 5` for free tier on `ai_ideas` (was 10, now 5) | 1 |
| T-0015-013 | unit | `subscriptionService.checkAiLimit` returns `limit: 5` for free tier on `ai_roadmap` (unchanged) | 1 |
| T-0015-014 | unit | `subscriptionService.checkAiLimit` returns `limit: 5` for free tier on `ai_insights` (unchanged) | 1 |
| T-0015-015 | regression | `handleGenerateIdeas` quota behavior unchanged (still calls checkLimit + trackAIUsage) | 1 |
| T-0015-016 | unit | `fetchWithErrorHandling` passes `signal` to `fetch()` options when provided | 2 |
| T-0015-017 | unit | `fetchWithErrorHandling` does not include `signal` in `fetch()` when not provided (backward compat) | 2 |
| T-0015-018 | unit | `AiServiceFacade.generateRoadmap()` accepts and passes `signal` to underlying service method | 2 |
| T-0015-019 | unit | `AiServiceFacade.generateInsights()` accepts and passes `signal` to underlying service method | 2 |
| T-0015-020 | unit | `AiServiceFacade.generateIdea()` accepts and passes `signal` to underlying service method | 2 |
| T-0015-021 | hook | `useAIGeneration.execute()` creates AbortController and passes signal through facade | 2 |
| T-0015-022 | hook | `useAIGeneration.cancel()` calls `controller.abort()` and resets isGenerating to false | 2 |
| T-0015-023 | hook | `useAIGeneration` useEffect cleanup calls `cancel()` on unmount | 2 |
| T-0015-024 | hook | `useAIGeneration.execute()` returns early (no-op) when `isGenerating` is already true (double-click prevention) | 2 |
| T-0015-025 | hook | Progress simulation follows deceleration curve: progress < 60 at 50% elapsed time, progress >= 55 at 70% elapsed time | 2 |
| T-0015-026 | hook | Progress holds at 95% and does not advance to 100% without server response | 2 |
| T-0015-027 | hook | On successful server response, progress jumps to 100% and stage becomes "Complete!" | 2 |
| T-0015-028 | hook | On AbortError (cancel), error is null and isGenerating is false (silent reset) | 2 |
| T-0015-029 | hook | On server 500 error, error message is set and isGenerating is false | 2 |
| T-0015-030 | hook | On server 402 (quota exceeded), quotaExhausted state is set with response data | 2 |
| T-0015-031 | hook | Stage transitions occur at correct percentage thresholds for a 4-stage config (25%, 50%, 75%, 90%) | 2 |
| T-0015-032 | unit | `stageConfigs.ts` exports 7 configurations matching feature spec S7.1 operation types | 2 |
| T-0015-033 | component | AIProgressOverlay renders progress bar with correct width percentage | 3 |
| T-0015-034 | component | AIProgressOverlay renders stage text matching current stage prop | 3 |
| T-0015-035 | component | AIProgressOverlay renders countdown "~N seconds remaining" when estimatedSecondsRemaining > 0 | 3 |
| T-0015-036 | component | AIProgressOverlay renders "Almost done..." when estimatedSecondsRemaining is 0 | 3 |
| T-0015-037 | component | AIProgressOverlay renders processing steps checklist with active step highlighted in sapphire | 3 |
| T-0015-038 | component | AIProgressOverlay renders stage dots: emerald for completed, sapphire for active, graphite for pending | 3 |
| T-0015-039 | component | AIProgressOverlay Cancel button calls onCancel when clicked | 3 |
| T-0015-040 | component | AIProgressOverlay Cancel button is disabled when `cancelable` prop is false | 3 |
| T-0015-041 | component | AIProgressOverlay error state: garnet bar, "Something went wrong", Retry and Close buttons rendered | 3 |
| T-0015-042 | component | AIProgressOverlay error state: Retry button calls onRetry, Close button calls onCancel | 3 |
| T-0015-043 | a11y | AIProgressOverlay has `aria-live="polite"` region that announces stage text | 3 |
| T-0015-044 | a11y | AIProgressOverlay error state has `aria-live="assertive"` announcement | 3 |
| T-0015-045 | a11y | AIProgressOverlay Cancel button has `aria-label="Cancel AI generation"` | 3 |
| T-0015-046 | a11y | AIProgressOverlay respects `prefers-reduced-motion`: pulse animation disabled when reduced motion active | 3 |
| T-0015-047 | component | QuotaExhaustedModal renders heading "Monthly AI Limit Reached" | 3 |
| T-0015-048 | component | QuotaExhaustedModal renders usage count and reset date in long format (e.g., "May 1, 2026") | 3 |
| T-0015-049 | component | QuotaExhaustedModal "Upgrade to Team" button navigates to /pricing | 3 |
| T-0015-050 | component | QuotaExhaustedModal "Close" button calls onClose | 3 |
| T-0015-051 | a11y | QuotaExhaustedModal focuses Close button on mount (not upgrade) | 3 |
| T-0015-052 | a11y | QuotaExhaustedModal has `role="dialog"` and `aria-labelledby` pointing to heading | 3 |
| T-0015-053 | hook | `useAIQuota` fetches quota on mount and returns `{ quota, isLoading, error, refresh }` | 4 |
| T-0015-054 | hook | `useAIQuota` caches result for 60 seconds (second call within 60s returns cached data, no fetch) | 4 |
| T-0015-055 | hook | `useAIQuota` re-fetches when `ai-quota-changed` CustomEvent is dispatched | 4 |
| T-0015-056 | hook | `useAIQuota` returns null quota for team/enterprise tier (badge hidden) | 4 |
| T-0015-057 | hook | `useAIQuota` returns error state on fetch failure (quota object has fallback shape) | 4 |
| T-0015-058 | component | AIQuotaBadge renders "3/5 AI" with neutral styling when usage < 80% | 4 |
| T-0015-059 | component | AIQuotaBadge renders "4/5 AI" with amber warning styling when usage 80-99% | 4 |
| T-0015-060 | component | AIQuotaBadge renders "5/5 AI" with garnet error styling when usage 100% | 4 |
| T-0015-061 | component | AIQuotaBadge renders skeleton pill during loading | 4 |
| T-0015-062 | component | AIQuotaBadge renders "-- AI" on fetch error | 4 |
| T-0015-063 | component | AIQuotaBadge is not rendered (null) for team tier | 4 |
| T-0015-064 | component | AIQuotaBadge is not rendered (null) for enterprise tier | 4 |
| T-0015-065 | component | AIQuotaBadge tooltip "Upgrade for unlimited" shown on hover when exhausted | 4 |
| T-0015-066 | a11y | AIQuotaBadge has correct `aria-label` per usage state (neutral, warning, exhausted) | 4 |
| T-0015-067 | a11y | AIQuotaBadge `aria-live="polite"` announces count change (not on mount) | 4 |
| T-0015-068 | component | Sidebar renders AIQuotaBadge in footer between user profile and admin button (expanded) | 4 |
| T-0015-069 | component | Sidebar renders compact AIQuotaBadge in collapsed mode (text only, no icon) | 4 |
| T-0015-070 | component | MobileTopBar renders compact AIQuotaBadge between project selector and user avatar | 4 |
| T-0015-071 | integration | AIInsightsModal replaces inline progress with AIProgressOverlay using insights stage config | 5 |
| T-0015-072 | integration | AIInsightsModal Cancel button aborts fetch and closes modal | 5 |
| T-0015-073 | integration | AIInsightsModal fires success toast "Insights generated successfully" (3s) after completion | 5 |
| T-0015-074 | integration | AIInsightsModal dispatches `ai-quota-changed` event on successful generation | 5 |
| T-0015-075 | integration | AIInsightsModal shows QuotaExhaustedModal when pre-check returns canUse: false | 5 |
| T-0015-076 | integration | AIInsightsModal handles 402 mid-generation by showing QuotaExhaustedModal (not error state) | 5 |
| T-0015-077 | integration | ProjectRoadmap renders AIProgressOverlay during generation with roadmap stage config | 5 |
| T-0015-078 | integration | ProjectRoadmap Cancel button aborts fetch | 5 |
| T-0015-079 | integration | ProjectRoadmap fires success toast "Roadmap generated successfully" (3s) | 5 |
| T-0015-080 | integration | ProjectRoadmap dispatches `ai-quota-changed` event on successful generation | 5 |
| T-0015-081 | integration | ProjectRoadmap shows QuotaExhaustedModal when pre-check returns canUse: false | 5 |
| T-0015-082 | regression | AIInsightsModal existing behavior preserved: caching, model selection, historical insights | 5 |
| T-0015-083 | regression | ProjectRoadmap existing behavior preserved: project-type-specific prompts, parsing | 5 |
| T-0015-084 | integration | AIIdeaModal renders AIProgressOverlay with text stage config during text idea generation | 6 |
| T-0015-085 | integration | AIIdeaModal renders AIProgressOverlay with image stage config during image idea generation | 6 |
| T-0015-086 | integration | AIIdeaModal renders AIProgressOverlay with audio stage config during audio idea generation | 6 |
| T-0015-087 | integration | AIIdeaModal renders AIProgressOverlay with video stage config during video idea generation | 6 |
| T-0015-088 | integration | AIIdeaModal Cancel button aborts fetch for any input mode | 6 |
| T-0015-089 | integration | AIIdeaModal fires success toast "Idea created" (3s) on completion | 6 |
| T-0015-090 | integration | AIIdeaModal dispatches `ai-quota-changed` on success | 6 |
| T-0015-091 | integration | AIIdeaModal shows QuotaExhaustedModal when pre-check returns canUse: false | 6 |
| T-0015-092 | integration | AIStarterModal renders AIProgressOverlay with batch ideas stage config | 6 |
| T-0015-093 | integration | AIStarterModal Cancel button aborts fetch | 6 |
| T-0015-094 | integration | AIStarterModal fires success toast "{count} ideas generated" with dynamic count | 6 |
| T-0015-095 | integration | AIStarterModal dispatches `ai-quota-changed` on success | 6 |
| T-0015-096 | integration | AIStarterModal shows QuotaExhaustedModal when pre-check returns canUse: false | 6 |
| T-0015-097 | regression | AIIdeaModal existing functionality preserved: file upload, audio recording, video processing | 6 |
| T-0015-098 | regression | AIStarterModal existing functionality preserved: batch generation, project context | 6 |
| T-0015-099 | build | `npm run type-check` passes after all steps | All |
| T-0015-100 | build | `npm run build` succeeds after all steps | All |
| T-0015-101 | build | `npm run lint` passes after all steps | All |
| T-0015-102 | e2e | Playwright: generate insights with progress overlay visible, verify completion toast | 5 |
| T-0015-103 | e2e | Playwright: generate roadmap with progress overlay visible, verify completion toast | 5 |
| T-0015-104 | e2e | Playwright: cancel generation mid-progress, verify modal closes with no toast | 5 |
| T-0015-105 | e2e | Playwright: quota badge visible for free-tier user, hidden for team-tier user | 4 |
| T-0015-106 | e2e | Playwright: mobile viewport (375px) -- progress overlay fully visible, cancel button meets touch target | 5 |
| T-0015-107 | a11y | Playwright + axe-core: AIProgressOverlay returns 0 critical/serious violations | 3 |
| T-0015-108 | a11y | Playwright + axe-core: AIQuotaBadge returns 0 critical/serious violations | 4 |
| T-0015-109 | a11y | Playwright + axe-core: QuotaExhaustedModal returns 0 critical/serious violations | 3 |

Failure path tests (T-0015-004, -007, -010, -028, -029, -030, -041, -042, -057, -062, -076) outnumber happy path tests proportionally. The core problem this ADR solves is failure-path UX.

## UX Coverage

| UX Surface | UX Doc Section | ADR Step |
|---|---|---|
| AIProgressOverlay (generating state) | S2a, states table "Generating (0-99%)" | Step 3 |
| AIProgressOverlay (complete state) | S2a, states table "Complete (100%)" | Step 3 |
| AIProgressOverlay (error state) | S2a, states table "Error" | Step 3 |
| AIProgressOverlay (overtime state) | S2a, states table "Overtime" | Step 3 |
| AIProgressOverlay (mobile layout, < 600px) | S2a, mobile layout paragraph | Step 3 |
| Progress deceleration curve | S3d, progress simulation strategy table | Step 2 (hook) |
| Cancel flow -- no confirmation | S3a | Step 2 (hook), Step 5-6 (wiring) |
| Modal close = cancel | S3b | Step 5-6 (wiring) |
| Double-click prevention | S3c | Step 2 (hook) |
| Focus management (cancel focused on mount) | S3e | Step 3 |
| Focus management (return focus on close) | S3e | Step 5-6 (wiring) |
| Post-completion toasts | S2b, copy contract table | Step 5-6 (wiring) |
| AIQuotaBadge (neutral, warning, exhausted, loading, error states) | S2c, states table | Step 4 |
| AIQuotaBadge desktop placement (sidebar footer) | S2c, desktop placement diagram | Step 4 |
| AIQuotaBadge mobile placement (top bar) | S2c, mobile placement diagram | Step 4 |
| AIQuotaBadge collapsed sidebar (text only) | S2c, collapsed sidebar diagram | Step 4 |
| AIQuotaBadge tally-bump animation on update | S2c, update animation paragraph | Step 4 |
| AIQuotaBadge tooltip on exhausted | S2c, states table "Exhausted hover" | Step 4 |
| QuotaExhaustedModal (layout, copy, CTA) | S2d, layout diagram + copy contract | Step 3 |
| QuotaExhaustedModal focus (Close button first) | S3e, focus management table | Step 3 |
| QuotaExhaustedModal button states (hover, focus, active) | S2d, states table | Step 3 |
| Stage text copy per operation type | S2a, copy contract tables (7 types) | Step 2 (stageConfigs.ts) |
| Processing steps copy per operation type | S2a, processing steps copy contract | Step 2 (stageConfigs.ts) |
| Error states (network loss, server error, quota race) | S4a, S4b, S4c | Step 3 (component), Step 5-6 (wiring) |
| Quota fetch failure (badge) | S4d | Step 4 |
| Screen reader announcements | S5a, all 7 events | Step 3, Step 4 |
| Keyboard navigation | S5b, all 4 component rows | Step 3, Step 4 |
| Contrast requirements (WCAG 2.1 AA) | S5c, all 7 element rows | Step 3, Step 4 |
| Reduced motion | S5d, all bullet points | Step 3 |
| Insights modal wiring | S7 (AIInsightsModal row: Modified) | Step 5 |
| Roadmap wiring | S7 (ProjectRoadmap row: Modified) | Step 5 |
| AIIdeaModal wiring (4 modes) | S7 (AIIdeaModal row: Modified) | Step 6 |
| AIStarterModal wiring | S7 (AIStarterModal row: Modified) | Step 6 |
| Sidebar wiring | S7 (Sidebar row: Modified) | Step 4 |
| MobileTopBar wiring | S7 (MobileTopBar row: Modified) | Step 4 |

No unmapped surfaces. Every UX doc surface maps to an ADR step.

## Contract Boundaries

| Producer | Consumer | Shape |
|---|---|---|
| `api/_lib/ai/quotaStatus.ts` (handleQuotaStatus) | `useAIQuota` hook via fetch | `{ canUse: boolean, current: number, limit: number, percentageUsed: number, isUnlimited: boolean, resetsAt: string }` |
| `useAIGeneration` hook | AIProgressOverlay component | `{ progress: number, stage: string, estimatedSecondsRemaining: number, processingSteps: string[], stageSequence: string[] }` |
| `useAIGeneration` hook | All 5 modal integrations (Step 5-6) | `{ execute, cancel, isGenerating, error, quotaExhausted, retry }` |
| `useAIGeneration` (on success) | `useAIQuota` (via CustomEvent) | `CustomEvent('ai-quota-changed')` -- no payload |
| `stageConfigs.ts` | `useAIGeneration` + AIProgressOverlay | `{ stages: string[], steps: string[], estimatedTotalSeconds: number }` per operation type |
| `BaseAiService.fetchWithErrorHandling(signal?)` | `useAIGeneration.execute()` via facade | `AbortSignal` passed to `fetch()` |
| `checkLimit()` in roadmap/insights handlers | Frontend 402 parsing | `{ error: { code: 'quota_exceeded', resource: string, limit: number, used: number, upgradeUrl: string } }` |
| `useAIQuota` hook | AIQuotaBadge component | `{ quota: { canUse, current, limit, percentageUsed, isUnlimited, resetsAt } | null, isLoading, error }` |

## Wiring Coverage

| Producer | Shape | Consumer | Step |
|---|---|---|---|
| `handleQuotaStatus` (new endpoint) | JSON response | `useAIQuota` hook | Step 1 (producer), Step 4 (consumer) |
| `checkLimit` in `generateRoadmap` | 402 JSON | `useAIGeneration` hook (quota error handling) | Step 1 (producer), Step 5 (consumer) |
| `checkLimit` in `generateInsights` | 402 JSON | `useAIGeneration` hook (quota error handling) | Step 1 (producer), Step 5 (consumer) |
| `subscriptionService` limit fix (5) | Consistent limit value | `tierLimits.ts` (already 5) | Step 1 (producer), pre-existing (consumer) |
| `BaseAiService.fetchWithErrorHandling(signal?)` | AbortSignal threading | `AiServiceFacade` methods | Step 2 (both producer and consumer) |
| `AiServiceFacade` methods (with signal) | Signal passthrough | `useAIGeneration.execute()` | Step 2 (both producer and consumer) |
| `useAIGeneration` hook | Progress/cancel/error state | AIProgressOverlay component | Step 2 (producer), Step 3 (consumer) |
| `stageConfigs.ts` | Stage config objects | `useAIGeneration` (via import) | Step 2 (both producer and consumer) |
| AIProgressOverlay component | Rendered UI | AIInsightsModal + ProjectRoadmap | Step 3 (producer), Step 5 (consumer) |
| AIProgressOverlay component | Rendered UI | AIIdeaModal + AIStarterModal | Step 3 (producer), Step 6 (consumer) |
| QuotaExhaustedModal component | Rendered UI | AIInsightsModal + ProjectRoadmap | Step 3 (producer), Step 5 (consumer) |
| QuotaExhaustedModal component | Rendered UI | AIIdeaModal + AIStarterModal | Step 3 (producer), Step 6 (consumer) |
| `useAIQuota` hook | Quota state | AIQuotaBadge component | Step 4 (both producer and consumer) |
| AIQuotaBadge component | Rendered UI | Sidebar + MobileTopBar | Step 4 (both producer and consumer) |
| `CustomEvent('ai-quota-changed')` | Event dispatch | `useAIQuota` listener | Step 5-6 (producer), Step 4 (consumer listener registered) |

**Note on cross-step consumers:** Steps 3-4 produce components consumed in Steps 5-6. This is intentional -- foundation components ship before integration. Each foundation step (3, 4) is independently testable via unit/component tests. The integration steps (5, 6) wire them into the existing modals.

No orphan producers. Every producer has a consumer in the same or a later step, with the consumer step explicitly identified.

## Data Sensitivity

| Method | Tag | Rationale |
|---|---|---|
| `handleQuotaStatus` | `auth-only` | Requires bearer token; returns user-specific usage counts |
| `checkLimit()` (in roadmap/insights handlers) | `auth-only` | Accesses user subscription and usage data |
| `trackAIUsage()` (in roadmap/insights handlers) | `auth-only` | Writes to ai_usage_tracking table |
| `useAIQuota.fetch()` | `auth-only` | Calls authenticated endpoint |
| `useAIQuota.quota` (returned data) | `public-safe` | Contains only usage counts (3/5), no PII, no credentials |
| `AIQuotaBadge` (rendered) | `public-safe` | Displays count only; no sensitive data in DOM |
| `useAIGeneration.execute()` | `auth-only` | Triggers authenticated AI endpoint call |
| `AIProgressOverlay` (rendered) | `public-safe` | Displays progress/stage text only; no user data |
| `QuotaExhaustedModal` (rendered) | `public-safe` | Displays limit count and generic reset date; no PII |
| `stageConfigs.ts` | `public-safe` | Static configuration; no runtime data |
| `BaseAiService.fetchWithErrorHandling(signal?)` | `auth-only` | Sends authenticated requests with credentials |

## Blast Radius

### Files Created (7)

| File | Step | Purpose |
|---|---|---|
| `api/_lib/ai/quotaStatus.ts` | 1 | Quota status endpoint handler |
| `src/hooks/useAIGeneration.ts` | 2 | Generation lifecycle hook |
| `src/lib/ai/stageConfigs.ts` | 2 | Stage configuration constants |
| `src/components/ui/AIProgressOverlay.tsx` | 3 | Shared progress UI component |
| `src/components/ui/QuotaExhaustedModal.tsx` | 3 | Quota exhausted modal |
| `src/hooks/useAIQuota.ts` | 4 | Quota fetching/caching hook |
| `src/components/ui/AIQuotaBadge.tsx` | 4 | Navigation quota badge |

### Files Modified (11)

| File | Step | Change |
|---|---|---|
| `api/_lib/ai/generateRoadmap.ts` | 1 | Add checkLimit + trackAIUsage, change type to AuthenticatedRequest |
| `api/_lib/ai/generateInsights.ts` | 1 | Add checkLimit + trackAIUsage, change type to AuthenticatedRequest |
| `api/_lib/services/subscriptionService.ts` | 1 | Fix free-tier limit from 10 to 5 (2 lines) |
| `api/ai.ts` | 1 | Add quota-status action to switch |
| `src/lib/ai/services/BaseAiService.ts` | 2 | Add optional signal parameter to fetchWithErrorHandling |
| `src/lib/ai/AiServiceFacade.ts` | 2 | Thread signal through generation methods |
| `src/components/Sidebar.tsx` | 4 | Add AIQuotaBadge in footer |
| `src/components/mobile/MobileTopBar.tsx` | 4 | Add compact AIQuotaBadge |
| `src/components/AIInsightsModal.tsx` | 5 | Replace inline progress with shared components |
| `src/components/ProjectRoadmap/ProjectRoadmap.tsx` | 5 | Wire progress overlay + quota |
| `src/components/AIIdeaModal.tsx` | 6 | Wire progress overlay + quota (4 modes) |
| `src/components/AIStarterModal.tsx` | 6 | Wire progress overlay + quota (batch) |

**Note:** Step 5 modifies 2 files. Step 6 modifies 2 files. No step exceeds 6 files total (create + modify). The widest step is Step 1 at 5 files (4 modify + 1 create) and Step 4 at 4 files (2 create + 2 modify).

### Files NOT Modified (verified safe)

| File | Why safe |
|---|---|
| `src/contexts/ToastContext.tsx` | Used as-is via `useToast()` -- no changes needed |
| `src/components/shared/Modal.tsx` | BaseModal used by QuotaExhaustedModal -- no changes needed |
| `src/hooks/shared/useAsyncOperation.ts` | Not extended; useAIGeneration is standalone |
| `src/hooks/useSubscription.ts` | Used by useAIQuota to check tier -- no changes needed |
| `src/lib/config/tierLimits.ts` | Already correct at 5; backend is the one being fixed |
| `api/_lib/middleware/withQuotaCheck.ts` | AI quota is inline in handlers, not middleware |
| `api/_lib/ai/generateIdeas.ts` | Already has checkLimit + trackAIUsage -- no changes |

### CI/CD Impact

- No build config changes
- No deployment config changes
- No new environment variables
- No new dependencies (uses existing Lucide icons, Tailwind tokens, AbortController browser API)

## Step Sizing Verification

| Step | Files (create + modify) | S1 Demoable | S2 Context-bounded | S3 Independently verifiable | S4 Revert-cheap | S5 Already small |
|---|---|---|---|---|---|---|
| 1 | 5 (1+4) | "After this step, roadmap and insights endpoints enforce quota and return 402 when exhausted; free-tier limit is 5 everywhere; frontend can pre-check quota" | 5 files, all backend | Yes -- mock checkLimit, assert 402 response shape | Yes -- revert 5 files | Yes |
| 2 | 4 (2+2) | "After this step, a reusable hook exists for AI generation with progress simulation and cancel; BaseAiService supports abort signals" | 4 files, all frontend lib/hooks | Yes -- hook unit tests with mocked fetch and timers | Yes -- revert 4 files | Yes |
| 3 | 2 (2+0) | "After this step, the shared progress overlay and quota modal exist as tested, accessible components" | 2 new component files | Yes -- component/a11y tests with static props | Yes -- delete 2 files | Yes |
| 4 | 4 (2+2) | "After this step, free-tier users see their AI quota in the sidebar and mobile nav bar" | 4 files, clear boundaries | Yes -- hook tests + component tests + visual integration | Yes -- revert 4 files | Yes |
| 5 | 2 (0+2) | "After this step, insights and roadmap generation show the shared progress overlay with cancel and quota checks" | 2 existing modal files | Yes -- integration tests with mocked services | Yes -- revert 2 files | Yes |
| 6 | 2 (0+2) | "After this step, all 7 AI generation points have consistent progress feedback and quota enforcement" | 2 existing modal files | Yes -- integration tests with mocked services | Yes -- revert 2 files | Yes |

All steps pass the 5-test sizing gate. No step exceeds 6 files.

## Notes for Colby

### Proven Pattern: Progress Simulation from AIInsightsModal

The gold standard is `AIInsightsModal.tsx` lines 390-468. Key implementation details to preserve in AIProgressOverlay:
- `rounded-2xl p-6 mb-6 bg-canvas-secondary` container
- `Sparkles` icon with `animate-spin text-sapphire-600`
- Progress bar: `rounded-full h-3 overflow-hidden bg-graphite-200` outer, `bg-sapphire-600 transition-all duration-500 ease-out` inner with `animate-pulse` white overlay
- Processing steps: `rounded-xl border p-4 bg-surface-primary border-hairline-default`
- Stage dots: `w-3 h-3 rounded-full` with `scale-125 animate-pulse bg-sapphire-500` (active), `bg-emerald-500` (completed), `bg-graphite-300` (pending)

Extract, do not rewrite. Parameterize what is hardcoded (stage names, step text, estimated time).

### AbortController Threading Pattern

The `signal` parameter threads through 3 layers:
1. `useAIGeneration.execute()` creates `new AbortController()`, stores in `useRef`
2. Calls `aiService.generateRoadmap(args, { signal: controller.signal })`
3. `AiServiceFacade.generateRoadmap()` passes signal to `RoadmapService.generateRoadmap()`
4. `RoadmapService` passes signal to `fetchWithErrorHandling(endpoint, payload, false, signal)`
5. `fetchWithErrorHandling` passes signal to `fetch()`: `fetch(url, { method: 'POST', headers, credentials: 'include', signal, body })`

The `signal` parameter is optional at every layer for backward compatibility. Omitting it preserves existing behavior.

### useEffect Cleanup for AbortController

```
useEffect(() => {
  return () => {
    if (controllerRef.current) {
      controllerRef.current.abort()
    }
  }
}, [])
```

This prevents state updates on unmounted components (React StrictMode double-mount safe). The AbortError catch in the fetch handler checks `signal.aborted` before setting state.

### CustomEvent Pattern for Quota Refresh

In `useAIGeneration` (on success):
```
window.dispatchEvent(new CustomEvent('ai-quota-changed'))
```

In `useAIQuota`:
```
useEffect(() => {
  const handler = () => refresh()
  window.addEventListener('ai-quota-changed', handler)
  return () => window.removeEventListener('ai-quota-changed', handler)
}, [refresh])
```

### Handler Type Signature Fix (Step 1)

Both `handleGenerateRoadmap` and `handleGenerateInsights` currently declare `req: VercelRequest` but receive `AuthenticatedRequest` at runtime (via the compose middleware chain `withAuth`). Change the type to `AuthenticatedRequest` and import it from the middleware:

```
import type { AuthenticatedRequest } from '../middleware/index.js'

export async function handleGenerateRoadmap(req: AuthenticatedRequest, res: VercelResponse) {
  const userId = req.user!.id
  const limitCheck = await checkLimit(userId, 'ai_roadmap')
  // ... same pattern as generateIdeas.ts
```

### Deceleration Curve Implementation (Step 2)

The progress simulation runs on a 100ms setInterval. At each tick, calculate the target progress based on elapsed time and the deceleration curve:

```
const elapsed = (now - startTime) / 1000
const ratio = elapsed / estimatedTotalSeconds

let target: number
if (ratio <= 0.6) target = ratio * 100                    // linear 0-60%
else if (ratio <= 0.85) target = 60 + (ratio - 0.6) * 100 * 0.7  // 60-77.5%
else if (ratio <= 0.95) target = 77.5 + (ratio - 0.85) * 100 * 0.3  // 77.5-80.5%
else target = Math.min(95, 80.5 + (ratio - 0.95) * 100 * 0.1)  // crawl to 95, hold

setProgress(Math.min(target, 95))
```

Stage transitions occur at percentage thresholds: for a 4-stage config, transitions at approximately 25%, 50%, 75%, and 90%.

### Free-Tier Limit Fix (Step 1)

In `subscriptionService.ts`, two locations to change:

Line ~157: `const freeLimit = limitType === 'ai_ideas' ? 10 : 5` -> `const freeLimit = 5`
Line ~195: `free: limitType === 'ai_ideas' ? 10 : 5,` -> `free: 5,`

This standardizes all AI limit types (ideas, roadmap, insights) to 5/month on free tier, matching `tierLimits.ts` line 33 (`ai_ideas_per_month: 5`).

## DoD -- Definition of Done

| DoR # | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Shared AIProgressOverlay extracted | Covered | Step 3, T-0015-033 through T-0015-046 |
| R2 | Wired into all 7 generation points | Covered | Steps 5-6, T-0015-071 through T-0015-098 |
| R3 | useAIGeneration hook with AbortController, progress, cancel | Covered | Step 2, T-0015-021 through T-0015-031 |
| R4 | Cancel aborts fetch, closes modal, no partial results | Covered | Step 2 (hook), Steps 5-6 (wiring), T-0015-022, T-0015-072, T-0015-088 |
| R5 | Post-completion success toast | Covered | Steps 5-6, T-0015-073, T-0015-079, T-0015-089, T-0015-094 |
| R6 | AIQuotaBadge in sidebar + mobile, free-tier only | Covered | Step 4, T-0015-058 through T-0015-070 |
| R7 | useAIQuota hook with 60s cache + refresh | Covered | Step 4, T-0015-053 through T-0015-057 |
| R8 | QuotaExhaustedModal with upgrade CTA | Covered | Step 3, T-0015-047 through T-0015-052 |
| R9 | GET /api/ai/quota-status endpoint | Covered | Step 1, T-0015-001 through T-0015-005 |
| R10 | Roadmap endpoint enforces quota | Covered | Step 1, T-0015-006 through T-0015-008 |
| R11 | Insights endpoint enforces quota | Covered | Step 1, T-0015-009 through T-0015-011 |
| R12 | Free-tier limit standardized to 5 | Covered | Step 1, T-0015-012 through T-0015-014 |
| R13 | Mobile progress overlay usable on 375px | Covered | Step 3 (component), T-0015-106 (e2e) |
| R14 | Unmount aborts generation, no warnings | Covered | Step 2, T-0015-023 |
| R15 | BaseAiService signal support | Covered | Step 2, T-0015-016, T-0015-017 |
| R16 | Quota badge refreshes after generation | Covered | Step 4 (listener), Steps 5-6 (dispatch), T-0015-055, T-0015-074, T-0015-080, T-0015-090, T-0015-095 |
| R17 | ADR-0013 model profiles unaffected | Covered | No server-side model routing changes; signal parameter is additive |
| R18 | ADR-0014 auth hardening unaffected | Covered | BaseAiService changes are additive (optional signal); credentials: 'include' preserved |
| R19 | Screen reader announcements | Covered | Step 3-4, T-0015-043, T-0015-044, T-0015-045, T-0015-066, T-0015-067 |
| R20 | Reduced motion support | Covered | Step 3, T-0015-046 |

No silent drops. All 20 DoR items map to implementation steps and test IDs.
