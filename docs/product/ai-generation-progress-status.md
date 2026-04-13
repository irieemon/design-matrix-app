# Feature Spec: AI Generation Progress & Status System

**Author:** Robert (Product)
**Date:** 2026-04-13
**Status:** Draft
**Priority:** P0 (Pre-launch blocker)

---

## Definition of Readiness (DoR)

| Requirement | Source | Verified |
|---|---|---|
| 7 AI generation points audited with current UX gaps documented | Discovery conversation + codebase audit | Yes |
| Gold standard pattern identified in AIInsightsModal.tsx (lines 390-468) | Source code | Yes |
| Existing ToastContext confirmed at `src/contexts/ToastContext.tsx` with success/error/warning/info types | Source code | Yes |
| Backend quota system confirmed: `checkLimit()`, `trackAIUsage()`, `withQuotaCheck` middleware exist | `api/_lib/services/subscriptionService.ts`, `api/_lib/middleware/withQuotaCheck.ts` | Yes |
| Frontend tier limits confirmed at `src/lib/config/tierLimits.ts` (free: 5 ai_ideas/month) | Source code | Yes |
| Backend tier limits confirmed at `subscriptionService.ts:157,195` (free: 10 ai_ideas, 5 for roadmap/insights) | Source code | Yes |
| Quota enforcement gap: `api/ai.ts` (roadmap + insights actions) has NO checkLimit/trackAIUsage calls | Source code grep | Yes |
| Quota enforcement present: `api/_lib/ai/generateIdeas.ts` calls checkLimit + trackAIUsage | Source code | Yes |
| AbortController not currently used in any AI generation fetch | Source code grep | Yes |
| Retro risks | None found in retro-lessons for this feature area | N/A |

---

## 1. Problem Statement

Users initiating AI generation (roadmaps, insights, idea analysis) receive inconsistent and often absent feedback about operation progress. Three of seven generation points show only a spinner or disabled button with no progress indication, estimated time, or error recovery path. On mobile -- a primary brainstorming device -- this looks indistinguishable from a crash. Meanwhile, the roadmap and insights endpoints have zero quota enforcement, meaning free-tier users can generate unlimited AI content at full cost to the platform.

## 2. Who Is Affected

- **Free-tier users** -- encounter "frozen" UI on slow AI calls; no quota visibility leads to surprise cutoffs on ideas but unlimited roadmap/insights (inconsistent experience and unbounded AI cost)
- **Team/Enterprise users** -- same UX gaps on roadmap and project idea generation
- **Mobile brainstormers** -- most impacted; small screens amplify the "is it working?" anxiety
- **Platform economics** -- unmetered roadmap/insights generation is a direct cost leak

## 3. Business Value

| Value Driver | Impact |
|---|---|
| Reduce perceived AI failures | Users who think generation "crashed" abandon the feature and churn |
| Enforce AI cost controls | Roadmap + insights have zero quota gates -- free users can generate unlimited expensive AI calls |
| Increase upgrade conversion | Visible quota usage ("3 of 5 used") creates natural upgrade moments |
| Mobile retention | Brainstorming on phones is a stated key use case; broken UX here blocks adoption |
| Launch readiness | Freemium model requires functional quota enforcement before public access |

### KPIs

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| AI generation abandonment rate (user closes modal before completion) | Unknown (no tracking) | < 10% | Analytics event on modal close during generation |
| Support tickets mentioning "frozen" or "stuck" AI | Assumed non-zero | 0 in first month | Support ticket audit |
| Free-tier AI cost per user per month | Unbounded (roadmap/insights unmetered) | Capped at tier limit value | `ai_usage_tracking` table aggregate |
| Free-to-Team upgrade rate | Current baseline | +15% lift within 60 days | Stripe subscription events correlated with quota-exhausted events |

## 4. User Stories

### US-1: Consistent progress feedback
**As a** user generating AI content,
**I want** a clear progress overlay showing stage, percentage, and estimated time,
**so that** I know the operation is working and how long to wait.

### US-2: Cancel in-flight generation
**As a** user who changed their mind or has been waiting too long,
**I want** to cancel an AI generation in progress,
**so that** I can return to my work without waiting for completion or reloading the page.

### US-3: Post-completion confirmation
**As a** user whose AI generation just finished,
**I want** a brief toast notification confirming success,
**so that** I know the results are ready when the modal closes.

### US-4: Quota visibility in navigation
**As a** free-tier user,
**I want** to see my current AI usage ("3 of 5 used this month") in the navigation,
**so that** I can plan my usage and understand when I need to upgrade.

### US-5: Quota enforcement on all AI endpoints
**As a** platform operator,
**I want** every AI generation endpoint to check and track quota,
**so that** free-tier users cannot generate unlimited content at platform expense.

### US-6: Graceful quota exhaustion
**As a** user who has hit their monthly limit,
**I want** a clear message explaining the limit and how to upgrade,
**so that** I am not confused by a silent failure or cryptic error.

## 5. User Flow

### 5.1 Generation with Progress (Happy Path)

```
User clicks "Generate [Roadmap|Insights|Ideas]"
  |
  v
[Pre-check] Frontend calls GET /api/ai/quota-status?type={ai_ideas|ai_roadmap|ai_insights}
  |-- quota exhausted --> Show QuotaExhaustedModal (see 5.3)
  |-- quota available -->
  v
AIProgressOverlay renders inside the modal (modal stays open)
  |-- Progress bar animates 0-100% across stages
  |-- Stage text updates per operation type (see Section 7.1)
  |-- Estimated countdown ticks down
  |-- Cancel button visible
  |
  |-- [User clicks Cancel] --> AbortController.abort() --> fetch aborts
  |     --> Modal closes, no partial results, no toast
  |
  |-- [Generation completes] --> Progress hits 100%, "Complete!" stage
  |     --> Modal closes after 600ms delay
  |     --> Toast: "Roadmap generated successfully" (3s auto-dismiss)
  |
  |-- [Generation fails] --> Error state renders inside overlay
  |     --> "Retry" button + error message
  |     --> No toast (error visible in modal)
```

### 5.2 Quota Badge (Persistent)

```
Navigation renders AIQuotaBadge
  |
  v
On mount + after each generation: fetch quota status
  |-- Free tier, quota remaining: "3/5 AI" (neutral style)
  |-- Free tier, >= 80% used: "4/5 AI" (warning amber style)
  |-- Free tier, exhausted: "5/5 AI" (error red style + tooltip "Upgrade for unlimited")
  |-- Team/Enterprise: Badge hidden (unlimited)
```

### 5.3 Quota Exhausted

```
User clicks "Generate [anything]"
  |
  v
Frontend pre-check returns canUse: false
  |
  v
QuotaExhaustedModal renders:
  - "You've used all 5 AI generations this month"
  - "Resets on [1st of next month]"
  - [Upgrade to Team - $29/mo] button --> navigates to /pricing
  - [Close] button
  |
  (Generation button is NOT disabled -- the modal explains why it can't proceed.
   This avoids the "why is this greyed out?" confusion.)
```

## 6. Edge Cases

| Edge Case | Behavior |
|---|---|
| Network disconnects mid-generation | AbortController fires error event; overlay shows "Connection lost. Retry?" with retry button |
| User navigates away mid-generation (browser back, route change) | useEffect cleanup calls abort(); generation discarded silently; no orphaned requests |
| Concurrent generation attempts (double-click) | Button disabled immediately on first click; AbortController ref prevents duplicate fetches |
| Quota check says "available" but backend rejects (race condition: another tab used last quota) | Backend returns 402 with quota_exceeded; frontend catches and shows QuotaExhaustedModal |
| Server returns 500 during generation | Overlay shows "Something went wrong. Retry?" with retry button; logged to console |
| Generation takes longer than estimated time | Countdown reaches 0, shows "Almost done..." (current behavior in insights modal); progress bar continues at reduced speed |
| Modal unmount during generation | useEffect cleanup aborts fetch; no state updates on unmounted component |
| Demo user (isDemoUUID) | Skip quota check; show progress overlay normally; no quota badge |

## 7. Detailed Design

### 7.1 AIProgressOverlay Component

A shared, reusable component extracted from the existing AIInsightsModal pattern (lines 390-468).

**Location:** `src/components/ui/AIProgressOverlay.tsx`

**Props Interface:**

```typescript
interface AIProgressOverlayProps {
  /** Whether the overlay is visible */
  isActive: boolean;
  /** Current progress 0-100 */
  progress: number;
  /** Current named stage */
  stage: string;
  /** Estimated seconds remaining; 0 = "Almost done..." */
  estimatedSecondsRemaining: number;
  /** Ordered processing steps shown as checklist */
  processingSteps: string[];
  /** Ordered stage names for dot indicators */
  stageSequence: string[];
  /** Called when user clicks Cancel */
  onCancel: () => void;
  /** Whether cancel is available (disabled during final write phase) */
  cancelable?: boolean;
}
```

**Stage Configurations per Operation Type:**

| Operation | Stages (in order) | Est. Total Time | Steps |
|---|---|---|---|
| Insights | Analyzing Ideas, Synthesizing Insights, Optimizing Recommendations, Finalizing Report | 12s | Collecting idea data, Analyzing patterns, Generating recommendations, Formatting report |
| Roadmap | Loading Project Data, Planning Milestones, Sequencing Dependencies, Building Timeline | 10s | Reading project context, Identifying priorities, Ordering deliverables, Rendering roadmap |
| Project Ideas (batch) | Analyzing Project Context, Generating Ideas, Evaluating Feasibility, Formatting Results | 15s | Scanning project brief, Brainstorming concepts, Scoring viability, Preparing idea cards |
| Single Idea (text) | Processing Input, Analyzing Content, Generating Idea Card | 5s | Reading submission, Extracting themes, Building card |
| Single Idea (image) | Uploading Image, Analyzing Visual Content, Generating Idea Card | 8s | Transferring file, Running vision analysis, Building card |
| Single Idea (audio) | Processing Audio, Transcribing Content, Generating Idea Card | 10s | Decoding audio, Converting speech to text, Building card |
| Single Idea (video) | Extracting Frames, Analyzing Video Content, Generating Idea Card | 12s | Sampling key frames, Running multi-modal analysis, Building card |

**Visual Design:** Replicates the existing insights modal pattern exactly:
- Rounded container with `bg-canvas-secondary` background
- Animated sapphire progress bar with pulse overlay
- Stage text with icon (per current pattern)
- Estimated time countdown
- Processing steps checklist with animated dots
- Stage dot indicators at bottom
- Cancel button: ghost style, bottom-right of overlay, "Cancel" text with X icon

### 7.2 Toast Notifications (Post-Completion)

Uses the existing `ToastContext` (`src/contexts/ToastContext.tsx`). No new toast system needed.

| Event | Toast Call | Duration |
|---|---|---|
| Insights generated | `showSuccess("Insights generated successfully")` | 3000ms |
| Roadmap generated | `showSuccess("Roadmap generated successfully")` | 3000ms |
| Ideas generated (batch) | `showSuccess("${count} ideas generated")` | 3000ms |
| Single idea created | `showSuccess("Idea created")` | 3000ms |
| Generation failed (after modal closes) | `showError("Generation failed. Please try again.")` | 5000ms |
| Quota exhausted (after attempt) | `showWarning("Monthly AI limit reached. Upgrade for unlimited access.")` | 5000ms |

### 7.3 AIQuotaBadge Component

**Location:** `src/components/ui/AIQuotaBadge.tsx`

**Placement:** Inside the main navigation bar, near user profile/settings area.

**Props Interface:**

```typescript
interface AIQuotaBadgeProps {
  /** Compact mode for mobile nav */
  compact?: boolean;
}
```

**Behavior:**
- Fetches quota on mount via `GET /api/ai/quota-status?type=ai_ideas`
- Re-fetches after any AI generation completes (via a shared `useAIQuota` hook that exposes a `refresh()` method)
- Caches result for 60 seconds to avoid excessive API calls

**Display Rules:**

| Tier | Usage State | Display | Style |
|---|---|---|---|
| Free | 0-59% used | "2/5 AI" | `text-graphite-600 bg-graphite-100` (neutral) |
| Free | 60-79% used | "3/5 AI" | `text-graphite-600 bg-graphite-100` (neutral) |
| Free | 80-99% used | "4/5 AI" | `text-amber-700 bg-amber-50` (warning) |
| Free | 100% used | "5/5 AI" | `text-garnet-700 bg-garnet-50` (error) + tooltip "Upgrade for unlimited" |
| Team | Any | Hidden | -- |
| Enterprise | Any | Hidden | -- |

**Accessibility:** `aria-label="AI usage: 3 of 5 generations used this month"`. Warning/error states announced via `aria-live="polite"` region.

### 7.4 Cancel Mechanism

**Pattern:** Each AI generation call wraps its `fetch()` with an `AbortController`.

```typescript
// Hook: useAIGeneration (new shared hook)
// Location: src/hooks/useAIGeneration.ts

interface UseAIGenerationReturn<T> {
  execute: (url: string, body: unknown) => Promise<T>;
  cancel: () => void;
  isGenerating: boolean;
  progress: number;
  stage: string;
  estimatedSecondsRemaining: number;
  processingSteps: string[];
  error: string | null;
}
```

**Lifecycle:**
1. `execute()` creates a new `AbortController`, stores ref
2. `fetch()` receives `{ signal: controller.signal }`
3. Simulated progress ticks via `setInterval` (100ms) based on estimated total time
4. Stage transitions at percentage thresholds (e.g., 25%, 50%, 75%, 90%)
5. On response success: jump to 100%, set "Complete!" stage
6. `cancel()` calls `controller.abort()`, resets all state
7. `useEffect` cleanup calls `cancel()` on unmount

**Cancel = Discard:** No partial results are shown or saved. Modal closes. No toast on cancel.

### 7.5 QuotaExhaustedModal Component

**Location:** `src/components/ui/QuotaExhaustedModal.tsx`

**Renders when:** Pre-check returns `canUse: false` after user clicks a generate button.

**Content:**
- Heading: "Monthly AI Limit Reached"
- Body: "You've used all {limit} AI generations this month. Your limit resets on {first of next month}."
- Primary CTA: "Upgrade to Team -- $29/mo" (links to /pricing or opens Stripe checkout)
- Secondary: "Close" button
- Visual: Sapphire illustration/icon, not a red error (this is an upsell moment, not a failure)

## 8. Acceptance Criteria

### AC-1: Shared progress overlay renders for all 7 generation points
- **Given** a user triggers any of the 7 AI generation types
- **When** the API call is in flight
- **Then** the AIProgressOverlay displays inside the modal with: animated progress bar, stage text, estimated time countdown, processing steps checklist, and stage dot indicators
- **Measured by:** Manual test matrix covering all 7 generation points; Playwright e2e for at least roadmap, insights, and single idea (text)

### AC-2: Cancel aborts generation and discards results
- **Given** a user is viewing the progress overlay during generation
- **When** they click "Cancel"
- **Then** the fetch is aborted via AbortController, the modal closes, no partial results are saved, and no toast appears
- **Measured by:** Network tab confirms aborted request; no new rows in DB after cancel

### AC-3: Post-completion toast displays
- **Given** a generation completes successfully
- **When** the modal closes
- **Then** a success toast appears in the top-right corner for 3 seconds with the operation-specific message
- **Measured by:** Toast visible in Playwright screenshot; auto-dismisses within 3.5s

### AC-4: Navigation quota badge shows accurate usage for free-tier users
- **Given** a free-tier user is logged in
- **When** they view any page with the main navigation
- **Then** the AIQuotaBadge displays "{used}/{limit} AI" with correct styling per usage threshold
- **Measured by:** Component test with mock quota responses at 0%, 50%, 80%, 100% usage

### AC-5: Quota badge hidden for paid tiers
- **Given** a Team or Enterprise user is logged in
- **Then** the AIQuotaBadge is not rendered
- **Measured by:** Component test asserting badge not in DOM for team/enterprise tiers

### AC-6: Quota badge refreshes after generation
- **Given** a free-tier user generates AI content
- **When** generation completes
- **Then** the badge value increments without page reload
- **Measured by:** Integration test: generate idea, assert badge updates from "2/5" to "3/5"

### AC-7: Roadmap endpoint enforces quota
- **Given** a free-tier user with 5/5 AI usage
- **When** they call `POST /api/ai?action=generate-roadmap`
- **Then** the API returns 402 with `quota_exceeded` error code
- **Measured by:** API integration test with usage at limit

### AC-8: Insights endpoint enforces quota
- **Given** a free-tier user with 5/5 AI usage
- **When** they call `POST /api/ai?action=generate-insights`
- **Then** the API returns 402 with `quota_exceeded` error code
- **Measured by:** API integration test with usage at limit

### AC-9: All AI endpoints track usage after successful generation
- **Given** a successful AI generation of any type
- **Then** a row is inserted into `ai_usage_tracking` with the correct `usage_type`
- **Measured by:** DB assertion in integration tests for each generation type

### AC-10: Free-tier limit is 5/month across frontend and backend (consistency fix)
- **Given** the system is deployed
- **Then** `tierLimits.ts` reads `ai_ideas_per_month: 5` AND `subscriptionService.ts` uses `5` for all AI limit types on free tier
- **Measured by:** Unit test asserting both values match; grep-based lint check

### AC-11: Quota-exhausted modal shows upgrade path
- **Given** a free-tier user has exhausted their quota
- **When** they click any generate button
- **Then** a QuotaExhaustedModal renders with: usage count, reset date, and "Upgrade to Team" CTA
- **Measured by:** Playwright test with mocked exhausted quota response

### AC-12: Mobile progress overlay is usable
- **Given** a user on a mobile viewport (375px width)
- **When** AI generation is in progress
- **Then** the progress overlay is fully visible, not clipped, and the cancel button meets 44x44px touch target
- **Measured by:** Playwright mobile viewport screenshot; axe accessibility check on overlay

### AC-13: Component unmount aborts in-flight generation
- **Given** an AI generation is in progress
- **When** the component unmounts (navigation, modal close via escape)
- **Then** the AbortController fires, no state updates occur on the unmounted component, and no console warnings appear
- **Measured by:** React strict mode test; no "state update on unmounted component" warnings in console

## 9. Scope

### In Scope

- Extract shared `AIProgressOverlay` component from existing AIInsightsModal pattern
- Create `useAIGeneration` hook with progress simulation, cancel, and error handling
- Create `AIQuotaBadge` component for navigation
- Create `QuotaExhaustedModal` component
- Create `useAIQuota` hook for fetching and caching quota status
- Wire AIProgressOverlay into all 7 generation points
- Add `checkLimit` + `trackAIUsage` calls to roadmap and insights actions in `api/ai.ts`
- Fix free-tier limit inconsistency: standardize on 5/month for all AI types
- Add `GET /api/ai/quota-status` endpoint for frontend quota pre-check
- Post-completion toast notifications via existing ToastContext
- AbortController integration for all AI fetch calls
- Mobile-responsive progress overlay

### Out of Scope

- Background generation (user stays in modal until done -- per user decision)
- Partial results on cancel (cancel = full discard -- per user decision)
- Real-time server-sent progress (simulated client-side progress is sufficient for v1)
- Streaming API responses (future enhancement)
- Per-operation-type quota limits (all AI types share a single monthly pool for v1)
- Toast system rebuild (existing ToastContext is sufficient)
- Quota management admin UI
- Usage analytics dashboard for end users

## 10. API Contracts

### 10.1 New Endpoint: GET /api/ai/quota-status

**Purpose:** Frontend pre-check before initiating generation.

**Request:**
```
GET /api/ai/quota-status?type=ai_ideas
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "canUse": true,
  "current": 3,
  "limit": 5,
  "percentageUsed": 60,
  "isUnlimited": false,
  "resetsAt": "2026-05-01T00:00:00.000Z"
}
```

**Response (401):**
```json
{
  "error": { "code": "UNAUTHORIZED", "message": "Missing bearer token" }
}
```

**Notes:**
- Delegates to existing `checkLimit()` function
- Adds `resetsAt` field (first of next month, UTC) for frontend display
- `type` query param accepts: `ai_ideas`, `ai_roadmap`, `ai_insights`

### 10.2 Modified Endpoint: POST /api/ai (roadmap + insights actions)

**Change:** Add `checkLimit()` before processing and `trackAIUsage()` after success, matching the pattern already used in `generateIdeas.ts`.

**New 402 response on quota exceeded:**
```json
{
  "error": {
    "code": "quota_exceeded",
    "resource": "ai_roadmap",
    "limit": 5,
    "used": 5,
    "upgradeUrl": "/pricing"
  }
}
```

### 10.3 Backend Limit Fix

**Current state:** `subscriptionService.ts` line 157 and 195 set free-tier `ai_ideas` to 10, while `tierLimits.ts` line 33 sets `ai_ideas_per_month` to 5.

**Resolution:** Standardize on **5 per month** for all AI types on free tier.

**Rationale:** The frontend value (5) is what users see in pricing and subscription panels. The backend value (10) was never intentionally chosen -- the comment on line 146 calls it "a pre-existing bug, preserved per D-07." Now that we are explicitly addressing quota enforcement, this is the correct time to fix it. 5 generations per month is sufficient for free-tier evaluation while protecting AI costs.

**Change:** In `subscriptionService.ts`, replace:
```typescript
const freeLimit = limitType === 'ai_ideas' ? 10 : 5
// and
free: limitType === 'ai_ideas' ? 10 : 5,
```
with:
```typescript
const freeLimit = 5
// and
free: 5,
```

## 11. Non-Functional Requirements

| NFR | Requirement |
|---|---|
| Performance | AIProgressOverlay adds < 5ms to render cycle; progress tick interval (100ms) must not cause jank on mobile |
| Accessibility | All overlay text readable by screen readers; cancel button has `aria-label`; progress announced via `aria-live="polite"`; quota badge uses semantic `aria-label`; meets WCAG 2.1 AA contrast |
| Mobile | Overlay fully visible on 375px viewport; cancel button meets 44x44px touch target; no horizontal scroll |
| Bundle size | AIProgressOverlay < 3KB gzipped; no new dependencies (uses existing Lucide icons + Tailwind) |
| Error recovery | Failed generation shows retry button; network loss detected and communicated; no orphaned server-side work on cancel |
| Quota consistency | Frontend and backend limits must be derived from a single source of truth (backend `checkLimit` is authoritative; frontend `tierLimits.ts` used for display only) |

## 12. Dependencies

| Dependency | Type | Risk |
|---|---|---|
| Existing ToastContext (`src/contexts/ToastContext.tsx`) | Internal, exists | Low -- already functional, no changes needed |
| Existing `checkLimit` / `trackAIUsage` in subscriptionService | Internal, exists | Low -- proven pattern from idea generation |
| `api/ai.ts` action dispatch architecture | Internal, exists | Low -- adding quota calls to existing switch cases |
| AIInsightsModal progress pattern | Internal, exists | Low -- extracting, not rewriting |
| AbortController browser API | Platform | None -- supported in all target browsers (ES2020) |
| Navigation component (for badge placement) | Internal, exists | Low -- adding a small component to existing nav |

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Simulated progress feels inaccurate (operation finishes much faster/slower than estimate) | Medium | Low | Progress jumps to 100% on actual completion; estimates are conservative; "Almost done..." fallback at 0s |
| Free-tier limit reduction (10 to 5 for ideas) upsets existing users | Low | Medium | Only affects users who were unknowingly getting 2x the intended limit; communicate in changelog |
| Quota pre-check race condition (check passes, backend rejects) | Low | Low | Backend is authoritative; frontend handles 402 gracefully with QuotaExhaustedModal |
| AbortController does not stop server-side OpenAI call (server continues processing after client abort) | High | Low | Server-side abort is a future enhancement; client abort prevents UI hang and is the immediate UX win |

---

## Definition of Done (DoD)

| Criterion | Verification Method |
|---|---|
| AIProgressOverlay component extracted and renders for all 7 generation types | Manual test matrix + Playwright e2e (AC-1) |
| Cancel button aborts fetch and closes modal cleanly | Playwright test + network assertion (AC-2) |
| Success toast displays after generation completes | Playwright screenshot (AC-3) |
| AIQuotaBadge renders correctly for free tier at 0%, 50%, 80%, 100% usage | Component unit tests (AC-4) |
| AIQuotaBadge hidden for Team/Enterprise | Component unit test (AC-5) |
| Badge refreshes after generation without page reload | Integration test (AC-6) |
| Roadmap endpoint returns 402 when quota exhausted | API integration test (AC-7) |
| Insights endpoint returns 402 when quota exhausted | API integration test (AC-8) |
| All AI endpoints insert usage tracking rows on success | DB assertion tests (AC-9) |
| Free-tier limit is 5/month in both frontend config and backend service | Unit test + grep lint (AC-10) |
| QuotaExhaustedModal shows limit, reset date, and upgrade CTA | Playwright test (AC-11) |
| Progress overlay usable on 375px mobile viewport | Playwright mobile screenshot + axe audit (AC-12) |
| No "state update on unmounted" warnings on navigation during generation | React strict mode test (AC-13) |
| No new TypeScript errors (`npm run type-check` passes) | CI |
| No new ESLint violations (`npm run lint` passes) | CI |
| Existing test suite passes (`npm run test:run`) | CI |
| Accessibility: axe-core returns 0 critical/serious violations on overlay and badge | Playwright axe audit |
