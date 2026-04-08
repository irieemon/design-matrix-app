# Phase 7: Mobile Polish & Video Analysis — Research

**Researched:** 2026-04-07
**Domain:** Mobile/responsive web (Track A) + client-side video frame extraction + vision API (Track B)
**Confidence:** HIGH for codebase state, MEDIUM for iOS Safari browser quirks (cited), HIGH for frame-extraction pattern

## Summary

Track A is mostly an **enable + debug** exercise: the 4 mobile brainstorm phase flags exist as fully written scaffolding in `src/lib/config.ts` read via `import.meta.env.VITE_MOBILE_BRAINSTORM_PHASE2..5` — they just need env-var allowlisting in `vite.config.ts` and manual QA against real devices. There is **no existing `useBreakpoint` / `useMobile` hook**, and Tailwind breakpoint classes are used inconsistently across pages. The mobile audit (D-02) must run first and drive the responsive-polish work list.

Track B requires a **non-trivial extension to the existing vision API**: `api/_lib/ai/analyzeImage.ts` currently accepts exactly one `imageUrl` per call. D-15 says "batch the 6 frames into a single vision call" — this batching does NOT exist today. You must either (a) extend `handleAnalyzeImage` to accept `imageUrls: string[]` and map them to multiple `{type:'image'}` content parts, or (b) add a new `handleAnalyzeVideo` handler alongside it. The AI SDK `generateText` messages format trivially supports multiple image content parts in one user message, so this is mechanically easy but it is new code, not a reuse.

**Primary recommendation:** Split the phase into three plan tracks: (1) **Mobile Audit + Flag Enablement** — produces `07-MOBILE-AUDIT.md` and flips the 4 flags behind QA; (2) **Mobile Polish** — critical-path responsive + touch work driven by the audit; (3) **Video Analysis** — new `handleAnalyzeVideo` action (or batched `analyzeImage`), client-side frame extraction hook, UI entry point mirroring image analysis.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mobile Philosophy (Track A)**
- **D-01:** Mobile is a companion experience, not a full copy. Every feature classified as mobile-native / mobile-view-only / desktop-only.
- **D-02:** Classification happens in the first wave as a documented audit in `07-MOBILE-AUDIT.md`.

**Mobile Brainstorm Flags (Track A)**
- **D-03:** Enable all 4 flags via env vars. Flip `VITE_MOBILE_BRAINSTORM_PHASE2..5=true` in `.env.local` and `.env.example`. Add all 4 to `vite.config.ts` dev API env-var allowlist (same lesson as Phase 05.2/06).
- **D-04:** Do NOT remove the flags — stay as config toggles for rollback.
- **D-05:** After enabling, manual test each phase. File bugs as plan-level tasks.

**Feature Classification (Track A, refined in MOBILE-AUDIT.md)**
- **D-06:** Initial classification — mobile-native: brainstorm join (QR), brainstorm submit, brainstorm results, project list, simple idea capture, auth. Mobile-view-only: project matrix, roadmap read-only, subscription dashboard. Desktop-only: AI Insights modal, admin, reports/analytics, roadmap editing, team collab mgmt, project settings, file analysis, PDF export.
- **D-07:** When mobile user hits desktop-only, show "Best on desktop" hint with email-me-the-link CTA. Non-blocking.
- **D-08:** Desktop-only features don't need to crash on mobile, but don't need responsive polish.

**Critical-Path Mobile Polish (Track A)**
- **D-09:** Critical paths: (1) auth, (2) projects list, (3) project matrix (view mode), (4) brainstorm session, (5) settings. Constraints: WCAG 2.1 AA 44x44px touch targets, no horizontal scroll on 375px+, readable without zoom, inputs avoid iOS zoom-on-focus. Test viewports: iPhone 14 Pro (393px), Galaxy S21 (360px), iPad mini (744px).

**Mobile-Specific Enhancements (Track A)**
- **D-10:** Add: bottom-sheet modals for brainstorm idea submit, pull-to-refresh on projects list, swipe-to-vote on brainstorm cards, haptic feedback via `navigator.vibrate()` on vote/submit.
- **D-11:** Claude's discretion — animation timing, gesture thresholds, haptics, empty-state copy.

**Video Analysis (Track B)**
- **D-12:** Client-side frame extraction via HTMLVideoElement + canvas. No ffmpeg, no WASM.
- **D-13:** Extract 6 frames per video, uniformly distributed. Tunable constant, not user input.
- **D-14:** Frame resolution: max 1024px long edge, JPEG quality 0.85. Target <300KB/frame, <2MB total.
- **D-15:** Reuse existing vision API. Batch 6 frames into a single vision call. Prompt asks for holistic summary + structured idea suggestions.
- **D-16:** Output shape: `{ summary: string, suggestedIdeas: IdeaCard[] }`. Same result UI as image analysis, labeled "Video analysis."
- **D-17:** Upload constraints: max 100 MB, max 5 min duration (checked after metadata), accepted `video/mp4`, `video/webm`, `video/quicktime`. If browser fails to decode, show "convert to MP4" error — no server fallback.
- **D-18:** Video file NEVER uploaded to server. Only extracted JPEG frames hit the vision API. No Supabase Storage.

**Video UX (Track B)**
- **D-19:** Entry point: "Upload video" button in existing file analysis / AI starter modal flow. Not a separate route.
- **D-20:** Multi-stage loader: "Extracting frames (2/6)…", "Analyzing video…", "Done". Expected <30s.
- **D-21:** Claude's discretion — copy, animations, empty/error states, retry UX.

### Claude's Discretion
- D-11 (mobile animation/gesture timings, haptic patterns, empty-state copy)
- D-21 (video UX copy, loader animations, error states, retry UX)
- Exact shape of `07-MOBILE-AUDIT.md` (table format is implied; specifics are open)

### Deferred Ideas (OUT OF SCOPE)
- Full responsive sweep of admin / reports / analytics / FAQ / pricing / button-test
- Native iOS/Android apps
- Offline-first mobile behavior
- Server-side ffmpeg or FFmpeg.wasm
- Video storage / playback library
- Frame-by-frame annotation UI
- Videos > 5 min or > 100 MB
- PWA install prompts / manifest tuning
- D-22: Any server-side video processing path

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **MOB-01** | Mobile brainstorm feature flag phases enabled and tested (phases 2-5) | Track A Plan 1 — `src/lib/config.ts` flags + `vite.config.ts` allowlist edit + manual QA against files in §Mobile Scaffolding Inventory |
| **MOB-03** | All pages responsive and usable on mobile viewports | Track A Plan 2 — audit-driven polish of critical paths from D-09; see §Mobile Feature Classification |
| **MOB-04** | Mobile brainstorm submit form optimized for touch | Track A Plan 2 — `MobileIdeaSubmitForm` already exists (imported at `src/pages/MobileJoinPage.tsx:15`), bottom-sheet per D-10 |
| **MOB-05** | Brainstorm join via QR code works reliably on mobile browsers | Track A Plan 1 QA — existing flow in `src/pages/MobileJoinPage.tsx` + `src/components/brainstorm/SessionQRCode.tsx`; no camera access required (user opens URL from QR scan on phone's native camera app — see §QR Join Flow) |
| **MM-05** | Upload video → frame-by-frame analysis via client extraction + vision API | Track B — full plan; see §Video Analysis Architecture |

---

## Project Constraints (from CLAUDE.md)

- **SMART MODE selection required** (SAFE for auth/realtime/matrix; FAST for bulk responsive sweeps and audit scan) — print the selected mode.
- **Never run `npm` with sudo.** Never bypass Supabase RLS.
- **Service-role key is backend-only.** Phase 6 lesson recurring: anon-singleton Supabase clients in Node API handlers fail RLS silently. For any new quota/subscription check in the video handler, thread the admin client explicitly (do not rely on the default singleton).
- **Touch targets: WCAG 2.1 AA 44x44px minimum** (`.claude/rules/frontend.md`). Touch and keyboard must both work. Focus indicators visible, never `outline: none` without replacement. `prefers-reduced-motion` respected — affects D-11 animation discretion.
- **No horizontal scroll on 375px+.** Text readable without zoom. Form inputs must avoid iOS Safari zoom-on-focus (requires `font-size ≥ 16px` on inputs — see §Common Pitfalls).
- **Mobile + desktop sync** is a top-level invariant per Smart Mode rules. Mobile brainstorm → desktop matrix must stay consistent.
- **GSD Workflow Enforcement:** all edits via a GSD command.

---

## Mobile Scaffolding Inventory (Track A)

Files referencing `MOBILE_BRAINSTORM_PHASE*` (verified via grep):

| File | Gated Phase | Role | Notes |
|---|---|---|---|
| `src/lib/config.ts` (lines 44-115) | 2/3/4/5 | Flag definitions | `import.meta.env.VITE_MOBILE_BRAINSTORM_PHASE2..5 === 'true'`. Build-time static replacement — **must rebuild** after flipping. Inline docs enumerate what each phase enables (Phase 2: realtime channels + presence; Phase 3: mobile UI polish + join/submit forms; Phase 4: facilitator desktop integration + QR activation in fullscreen matrix + blue pulse for mobile-submitted ideas; Phase 5: rate limiting + content moderation + session security + tests). |
| `src/pages/MobileJoinPage.tsx` | 2/3 | QR landing page | Phase 3 toggle at line 81 swaps basic UI for polished version. Already imports `MobileIdeaSubmitForm`. Validation states: loading / expired / invalid / success / error. Token parsed from `window.location.hash` via `#join/<uuid-token>` regex. |
| `src/components/brainstorm/SessionQRCode.tsx` | 4 | QR display (desktop facilitator side) | |
| `src/components/brainstorm/DesktopParticipantPanel.tsx` | 4 | Facilitator participant list | |
| `src/components/brainstorm/SessionControls.tsx` | 4 | Pause/resume/end | |
| `src/components/matrix/MatrixFullScreenView.tsx` | 4 | QR activation in fullscreen matrix | |
| `src/lib/services/ContentModerationService.ts` | 5 | Spam/profanity/length | |
| `src/lib/services/RateLimitService.ts` | 5 | 6 ideas/min per participant | |
| `src/lib/services/SessionSecurityService.ts` | 5 | Token + expiry + participant limits | |
| `src/lib/__tests__/phase5Regression.test.ts` | 5 | Regression suite | Run during enablement wave to confirm no regression. |

**Effort to enable each flag (estimated):**
- **PHASE2** (realtime infra) — **MEDIUM**. Realtime subscriptions + presence + optimistic updates. Never validated in prod. Expect reconnect loops or stale state bugs; Smart Mode mandates SAFE mode for any realtime debugging.
- **PHASE3** (mobile UI polish) — **LOW-MEDIUM**. UI-only toggle in `MobileJoinPage.tsx`. Fallback path preserved. Risk is visual/touch bugs on real devices.
- **PHASE4** (facilitator desktop integration) — **MEDIUM**. Integration into `MatrixFullScreenView` may conflict with existing matrix state. Test alongside Phase 05.4 (scoped realtime) — potential overlap.
- **PHASE5** (security + moderation + rate limiting) — **LOW**. Services are self-contained and already have a regression test suite. Enable last after 2/3/4 stabilize.

**Not inspected in detail but likely to need attention:** `MobileIdeaSubmitForm` (referenced at `src/pages/MobileJoinPage.tsx:15`) — verify the component exists at `src/components/MobileIdeaSubmitForm.tsx`, inspect its form-input font sizes (see Pitfalls §iOS zoom-on-focus), and touch target sizing for the submit button.

---

## QR Join Flow (Track A, MOB-05)

**Critical insight:** The QR flow does **NOT require the browser camera API (`getUserMedia`)**. Users scan with their phone's native camera app, which opens the URL in their default browser. The app only needs to handle the landing page at `#join/<uuid-token>`. This eliminates the iOS HTTPS-for-camera pitfall entirely for MOB-05.

**Current flow** (`src/pages/MobileJoinPage.tsx`):
1. Parse hash: `window.location.hash.match(/#join\/([a-f0-9-]+)/)` → token
2. `BrainstormSessionService.validateAccessToken({ accessToken })` → session or error
3. Determine expired vs invalid via `error.toLowerCase().includes('expired')`
4. `generateDeviceFingerprint()` from `src/lib/security/brainstormSecurity`
5. `BrainstormSessionService.joinSession({ sessionId, deviceFingerprint })` → participant
6. Render `<MobileIdeaSubmitForm session={...} participant={...} />`

**What to verify during QA (planner should script as explicit QA tasks):**
- Hash-based routing survives iOS Safari reload (hash changes don't trigger full reload)
- Token regex `[a-f0-9-]+` matches actual session token format — confirm by reading `BrainstormSessionService.validateAccessToken` signature
- Error messages for `expired` vs `invalid` — "Please request a new QR code" CTA is static; no retry button for expired state
- Device fingerprint generation works on Safari (some fingerprint techniques require canvas/webgl; may be blocked by Safari privacy settings — check `src/lib/security/brainstormSecurity.ts`)
- The polished UI uses Tailwind responsive classes throughout — verify on 360px width (Galaxy S21)

---

## Mobile Feature Classification Audit (Track A, D-02)

**Pages inventoried** (files verified via `ls`):

Under `src/components/pages/`:
- `ButtonTestPage.tsx` — **desktop-only** (dev/test page)
- `DataManagement.tsx` — **desktop-only** (admin/data admin)
- `FAQPage.tsx` — **mobile-view-only** (content, no authoring)
- `FormTestPage.tsx` — **desktop-only** (dev/test)
- `MatrixPage.tsx` — **mobile-view-only** per D-06 (matrix view, basic interaction only)
- `PricingPage.tsx` — **mobile-view-only** (content + CTA)
- `ProjectCollaboration.tsx` — **desktop-only** per D-06 (team mgmt)
- `ReportsAnalytics.tsx` — **desktop-only** per D-06 (data-dense)
- `SkeletonTestPage.tsx` — **desktop-only** (dev/test)
- `SubscriptionSuccessPage.tsx` — **mobile-view-only** (post-purchase landing)
- `UserSettings.tsx` — **mobile-native** per D-06 (subscription status is critical path)

Under `src/pages/`:
- `ComponentShowcase.tsx` — **desktop-only** (dev/test)
- `InvitationAcceptPage.tsx` — **mobile-native** (invitees may click email links on phone)
- `MobileJoinPage.tsx` — **mobile-native** (by definition)

**Other mobile-critical surfaces not in `pages/` directories** (need inclusion in audit):
- `src/components/app/AuthenticationFlow.tsx` — **mobile-native** per D-09
- `src/components/app/MainApp.tsx` + PageRouter — **mobile-native** (shell)
- `src/components/AIInsightsModal.tsx` — **desktop-only** per D-06
- `src/components/AIStarterModal.tsx` — hosts video upload entry point per D-19 → **mobile-native** for video sub-flow, desktop-only for the rest
- `src/components/brainstorm/*` (facilitator pieces) — **desktop-only** facilitator, **mobile-native** participant

**Planner guidance for `07-MOBILE-AUDIT.md`:** produce a single table — Page/Component | Classification | Rationale | Polish Priority (P0/P1/P2/skip) | Follow-up task. P0 = D-09 critical path. P1 = mobile-native not on critical path. P2 = mobile-view-only. skip = desktop-only (just add the D-07 "Best on desktop" hint).

---

## Responsive Patterns Already in Codebase

**No `useBreakpoint`/`useMobile`/`useMediaQuery` hook exists.** Verified via grep across `src/hooks/` — zero matches. This is a small gap: for the D-07 "Best on desktop" hint, you'll need either a new hook or inline `window.matchMedia('(max-width: 767px)')` checks. **Recommendation:** add `src/hooks/useBreakpoint.ts` as a Wave-0 task so the hint logic is DRY across pages.

**Tailwind breakpoint usage is inconsistent** — many files use `md:` and `sm:` but there is no enforced responsive-first convention. The audit should flag pages that use no responsive classes at all as P0/P1 candidates.

**Modal component** at `src/components/shared/Modal.tsx` is currently dirty-working-tree — D-10 calls for bottom-sheet modals on mobile. Two paths: (a) extend `Modal` with a `variant="bottom-sheet"` prop that's conditional on viewport; (b) build a new `BottomSheetModal` and swap it in at the mobile-native call sites (brainstorm idea submit specifically). Option (a) centralizes; option (b) is lower risk to existing desktop flows.

---

## Touch-Target Audit Method (Track A, D-09)

**Recommended approach (hybrid, low cost):**

1. **Static grep pass (FAST, cheap):** grep for `className=".*button.*"`, `<button`, `onClick=`, `role="button"` under `src/components/` limited to critical-path files. Flag any inline sizing (`w-6`, `h-6`, `p-1`) that resolves to <44px total hit area.
2. **Playwright visual + computed style audit (MEDIUM):** add a dedicated spec under `tests/e2e/mobile-touch-targets.spec.ts` that:
   - Visits each D-09 critical path (auth, projects list, matrix, brainstorm, settings)
   - Runs in `mobile-chrome` and `mobile-safari` projects (`Pixel 5`, `iPhone 12` — already configured in `playwright.base.config.ts:82-96`)
   - Evaluates `getBoundingClientRect()` for every interactive element matching `button, a, input[type=button], [role=button]`
   - Asserts `width >= 44 && height >= 44`
   - Outputs a list of failures as a CSV artifact for the polish-wave plan to consume
3. **Axe-playwright accessibility layer (already installed, `@axe-core/playwright` 4.10.2):** assert no a11y violations on the same routes; catches focus-visible and contrast issues for free.

**Avoid:** manual device testing as the primary gate — slow, inconsistent, and doesn't scale. Use it as a final spot-check after (1)-(3) are green.

---

## Mobile Testing Strategy

**What already exists:**
- `tests/e2e/mobile-brainstorm-flow.spec.ts` — existing mobile brainstorm E2E (unknown whether it runs against the flags-off default; worth inspecting in Wave 0)
- `browserProjects.mobileChrome` (Pixel 5) and `browserProjects.mobileSafari` (iPhone 12) already configured in `playwright.base.config.ts` but NOT in the default `projects` list — need to verify extending configs actually enumerate them
- `tests/e2e/accessibility-comprehensive.spec.ts` + `@axe-core/playwright`

**What needs adding:**
- A mobile-specific Playwright project list that activates all three viewports from D-09: iPhone 14 Pro (393px), Galaxy S21 (360px), iPad mini (744px). `devices['Pixel 5']` ≠ Galaxy S21 and `devices['iPhone 12']` ≠ iPhone 14 Pro — the D-09 viewports are explicit; either use custom viewport configs or accept the closest `devices[]` preset and document the delta.
- `tests/e2e/mobile-touch-targets.spec.ts` (see §Touch-Target Audit above)
- `tests/e2e/video-analysis.spec.ts` — happy path + oversized file + corrupted codec + over-5-min reject

---

## Video Analysis Architecture (Track B)

### Existing vision API path (verified, `api/_lib/ai/analyzeImage.ts`)

| Aspect | Current State |
|---|---|
| Endpoint | `POST /api/ai?action=analyze-image` → `handleAnalyzeImage` |
| Input | `{ imageUrl: string, projectContext?, analysisType? }` — **single image only** |
| Auth | `compose(withUserRateLimit, withCSRF, withAuth)` — 20 req/hr per user |
| Provider | `selectModel({ task: 'analyze-image', hasVision: true })` + `getModel(gatewayModelId)` + `generateText()` |
| Content shape | `messages: [{ role: 'user', content: [{type:'text', text: prompt}, {type:'image', image: imageUrl}] }]` |
| Output | `{ analysis: { type, description, extractedText, insights, relevance } }` — **NOT `{summary, suggestedIdeas[]}`** |
| Batch support | **NONE.** Accepts exactly one `imageUrl`. |
| Quota enforcement | Not wrapped in `withQuotaCheck` (only `generate-ideas` is, per `api/ai.ts:44`). Video path should follow the `ai_ideas` pattern if billing counts it. |

**Critical gap vs CONTEXT.md D-15 assumption:** D-15 says "reuse existing vision API, batch the 6 extracted frames into a single vision call." The existing handler does not accept multiple images. The planner MUST pick one of:

**Option A — extend `handleAnalyzeImage` (smaller diff, riskier):**
- Accept `imageUrls: string[]` (or `images: Array<{dataUrl, order}>`) alongside legacy `imageUrl`
- Map to multiple `{type:'image'}` content parts in the same user message — AI SDK `generateText` supports this natively
- Add a branch on an `analysisType: 'video_summary'` to return the `{summary, suggestedIdeas}` shape instead of the existing `{description, insights, ...}`
- Risk: image-analysis regression if the existing callers rely on the old output shape

**Option B — new `handleAnalyzeVideo` handler (recommended):**
- New file `api/_lib/ai/analyzeVideo.ts` alongside `analyzeImage.ts`
- New action route in `api/ai.ts:42-71` switch: `case 'analyze-video': return handleAnalyzeVideo(req, res)`
- Input: `{ frames: string[] /* data URIs or object URLs */, projectContext? }`
- Prompt: explicit "holistic summary of video content from these uniformly-sampled frames" + "return JSON `{summary, suggestedIdeas: IdeaCard[]}`"
- Output: `{ summary, suggestedIdeas }` mirroring `IdeaCard` from `src/types/index.ts`
- Wrap in `withQuotaCheck('ai_ideas', ...)` since video analysis consumes AI budget
- Reuse `selectModel({task:'analyze-video' /* or 'analyze-image' */, hasVision:true})` — the model router (`modelRouter.ts`) may need a new `'analyze-video'` task key; simplest first pass is to reuse `'analyze-image'`

**Option B is strongly recommended:** cleaner separation, no regression risk, fits the existing handler-per-action convention, and keeps the 6-frame batching semantics explicit.

### Vision API cost/latency estimate for 6 frames (MEDIUM confidence, [ASSUMED])

**[ASSUMED]** 6 frames × ~1024px JPEG q=0.85 ≈ 1.5-2 MB total payload. With GPT-4o-class vision, expect:
- Input tokens: 6 × ~750 image tokens + ~400 prompt = **~4,900 tokens**
- Output tokens: ~500-800 (summary + 3-5 suggested ideas)
- Cost: **~$0.02-0.04 per video** at GPT-4o pricing
- Latency: **10-25 seconds** end-to-end (vision is slower than text)

**Implication for D-20 loader:** "Done in <30s" budget is tight but feasible. Plan should include a fallback loader state "Still analyzing… large videos take up to a minute."

**[ASSUMED]** These numbers assume GPT-4o via AI Gateway — verify the actual selected model in `modelRouter.ts` during planning and update the estimate. If the router selects a slower/cheaper model, latency may exceed 30s consistently.

### Client-side frame extraction (canonical pattern)

The async seeking gotcha from CONTEXT.md §specifics is real. Canonical implementation:

```typescript
// Source: MDN — HTMLMediaElement.seeked event
// https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event
// Verified: HTMLMediaElement.seeked fires when the seek operation completes and
// currentTime has been updated. Drawing before this event fires yields the old frame.

async function extractFrames(
  file: File,
  count: number = 6,
  maxLongEdge: number = 1024,
  quality: number = 0.85
): Promise<Blob[]> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true  // iOS Safari: required or playback/decode blocked
  video.preload = 'metadata'
  video.src = URL.createObjectURL(file)

  try {
    // Wait for duration to be known
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Failed to load video metadata'))
    })

    // Enforce D-17 duration constraint AFTER metadata loads
    if (video.duration > 5 * 60) {
      throw new Error('Video exceeds 5 minute limit')
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const frames: Blob[] = []

    for (let i = 0; i < count; i++) {
      // Uniform distribution, skip the last 5% to avoid black frames at EOF
      const t = (video.duration * (i + 0.5)) / count

      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked, { once: true })
        video.onerror = () => reject(new Error(`Seek failed at ${t}s`))
        video.currentTime = t
      })

      // Scale to max long edge
      const scale = Math.min(1, maxLongEdge / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
          'image/jpeg',
          quality
        )
      })
      frames.push(blob)
    }

    return frames
  } finally {
    URL.revokeObjectURL(video.src)
    video.src = ''
    video.load()
  }
}
```

**iOS Safari quirks** [CITED: MDN HTMLMediaElement.playsInline, WebKit blog on autoplay policies]:
- `playsInline` is REQUIRED or Safari puts video in fullscreen on metadata load
- `muted` is REQUIRED for autoplay (not strictly needed for metadata/seek, but defensive)
- User gesture REQUIRED — extraction must start from a click/tap handler, not a `useEffect`
- Canvas reads from a cross-origin video are tainted — not an issue here since we use a blob URL from a local file, but document it for any future remote-URL path

**Cleanup:** `URL.revokeObjectURL` + clear `video.src` + `load()` prevents memory leaks on retry flows.

### Upload constraint enforcement (D-17)

- **Size check:** `file.size > 100 * 1024 * 1024` → reject synchronously before creating the object URL
- **Type check:** `['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)` → reject if not in list. Some browsers report empty `file.type` for .mov → fall back to extension check
- **Duration check:** CAN ONLY RUN AFTER `loadedmetadata` fires. Reject inside the extraction flow, not at upload time
- **Codec failure detection:** `video.onerror` or `video.error.code === MEDIA_ERR_SRC_NOT_SUPPORTED` → show the "convert to MP4" message. Do NOT silently fall back

### Frame → vision API transport

Frames are `Blob` objects. For transport to the API:
- Convert each to a data URI: `await blobToDataUrl(blob)` — simple, fits in JSON body
- 6 × ~300KB base64 → ~2.4 MB request body. Under Vercel's 4.5 MB serverless function body limit **with margin**, but close. If the video is higher-detail and frames compress poorly, you may blow the limit.
- **Safer alternative (MM-07 pattern):** mirror Phase 3's image-upload path — upload frames directly to Supabase Storage, pass URLs to the API. More complex, eliminates the 4.5 MB risk, adds storage cleanup responsibility.
- **Recommendation for first version:** data URIs, with a client-side guardrail that recomputes total payload size after extraction and rejects with "Video too complex — try shorter or lower resolution" if >4 MB. Defer the Supabase Storage path to Phase 8 if users hit the limit.

### Output shape and IdeaCard mapping

`src/types/index.ts` exports `IdeaCard`. The vision prompt must return structured JSON:

```json
{
  "summary": "A 2-3 paragraph holistic summary of the video content based on the sampled frames...",
  "suggestedIdeas": [
    { "content": "Idea title", "details": "Longer description", "priority": "high" | "medium" | "low" }
  ]
}
```

Use AI SDK's `generateObject` with a Zod schema instead of `generateText` + parse. `generateObject` enforces the shape server-side and avoids the JSON-parsing dance in `analyzeImage.ts:91-103`. [CITED: AI SDK docs, `generateObject` with schema]

---

## Env Vars to Add to vite.config.ts Allowlist

The 4 `VITE_MOBILE_BRAINSTORM_PHASE*` vars are frontend-only and use `import.meta.env` directly — Vite replaces them at build time **without** needing to appear in the `envVars` object in `vite.config.ts:78-93`. That object is only for **backend API handlers running in the dev middleware's SSR context** (the `process.env` bridge on lines 78-101). Frontend vars are never touched by that section.

**Verification:** grep for `RESEND_*` vs `VITE_STRIPE_*` in vite.config.ts — `VITE_STRIPE_PRICE_ID_TEAM` IS listed (line 88) because it's also read server-side by the webhook handler. Mobile brainstorm flags are purely client-side, so they don't need to be in that allowlist.

**BUT:** Phase 5.2/6 lessons suggested the allowlist should be comprehensive. Erring on the side of caution: **add them anyway** so a future refactor that moves any mobile flag check into an API handler doesn't introduce a silent "flag always off" bug. Cost is zero, safety is real.

| Env var | Frontend? | Backend? | Action |
|---|---|---|---|
| `VITE_MOBILE_BRAINSTORM_PHASE2` | yes | no | Add to `.env.local`, `.env.example`. Optional in vite.config.ts allowlist (recommended for future-proofing). |
| `VITE_MOBILE_BRAINSTORM_PHASE3` | yes | no | Same |
| `VITE_MOBILE_BRAINSTORM_PHASE4` | yes | no | Same |
| `VITE_MOBILE_BRAINSTORM_PHASE5` | yes | no | Same |
| (no new backend env vars for video analysis) | — | — | Reuses existing `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` via AI SDK |

---

## Runtime State Inventory

Phase 7 is additive (new features) + flag enablement, not a rename/refactor. No runtime state to migrate.

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | None — no DB schema changes | None |
| Live service config | None — no external service rename | None |
| OS-registered state | None | None |
| Secrets/env vars | 4 new `VITE_MOBILE_BRAINSTORM_PHASE*` (dev-only, added to `.env.local` and `.env.example`); production Vercel env vars must also be set | Add to Vercel dashboard before deploy |
| Build artifacts | Flag flip requires a **rebuild** — `import.meta.env` is static replacement, not runtime. Hot module reload may not pick up env changes — restart dev server | Document in plan |

---

## Common Pitfalls

### Pitfall 1: iOS Safari zoom-on-focus for form inputs
**What goes wrong:** Any `<input>` with computed font-size < 16px triggers a zoom animation on focus in iOS Safari, breaking the mobile layout and feeling broken.
**Why it happens:** iOS accessibility feature to ensure text is readable.
**How to avoid:** Force `font-size: 16px` (or `text-base` in Tailwind) on all input/select/textarea elements in mobile-native flows. Add an ESLint rule or audit pass during polish wave.
**Warning signs:** Page "jumps" when user taps an input on iPhone.

### Pitfall 2: HTMLVideoElement seek-then-draw race (called out in CONTEXT.md §specifics)
**What goes wrong:** Drawing to canvas immediately after setting `currentTime` captures the OLD frame.
**Why it happens:** Seeking is asynchronous — the `seeked` event fires when the new frame is actually ready.
**How to avoid:** Always `await` the `seeked` event via `video.addEventListener('seeked', ...)` before `ctx.drawImage()`. See canonical pattern above.
**Warning signs:** All 6 frames look identical, or all look like the first frame.

### Pitfall 3: iOS Safari video without `playsInline`
**What goes wrong:** Setting `.src` on a `<video>` element makes iOS fullscreen it immediately, breaking the hidden-extraction pattern.
**How to avoid:** Always set `playsInline = true` and `muted = true` before setting `.src`. And trigger from a user gesture (click/tap handler), not `useEffect`.

### Pitfall 4: Feature flag build-time replacement (NOT runtime)
**What goes wrong:** Flipping `VITE_MOBILE_BRAINSTORM_PHASE3=true` in `.env.local` without restarting Vite → flag stays false.
**How to avoid:** Document in plan — full `npm run dev` restart required after any env var flip. Same for production — requires redeploy.

### Pitfall 5: Supabase anon-client in serverless handlers fails RLS silently (Phase 6 lesson)
**What goes wrong:** If video analysis ends up writing to the DB (e.g., usage tracking via quota middleware), anon-singleton will be blocked by RLS without a clear error.
**How to avoid:** Use `withQuotaCheck('ai_ideas', ...)` on the new video endpoint — the middleware already threads the admin client correctly per Phase 6 hotfixes.

### Pitfall 6: Vercel 4.5 MB request body limit
**What goes wrong:** 6 large frames as data URIs exceed 4.5 MB → serverless function rejects with a cryptic error.
**How to avoid:** Client-side size guardrail after extraction; reduce quality to 0.75 and re-encode if over budget; fall back to MM-07 Supabase Storage pattern in a future iteration.

### Pitfall 7: Device fingerprint canvas/webgl blocked by Safari privacy
**What goes wrong:** `generateDeviceFingerprint()` in `src/lib/security/brainstormSecurity.ts` may use canvas fingerprinting, which Safari's Intelligent Tracking Prevention neutralizes.
**How to avoid:** Inspect the fingerprint implementation during QA; have a fallback that uses user-agent + timestamp when canvas returns the Safari stub.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Viewport detection | Custom resize listener | `window.matchMedia('(max-width: 767px)')` inside a new `src/hooks/useBreakpoint.ts` | matchMedia has native debouncing, no reflow |
| Touch-target audit | Manual visual inspection | Playwright `getBoundingClientRect` + axe-playwright | Deterministic, reruns in CI |
| Video frame extraction | ffmpeg / WASM | HTMLVideoElement + canvas (per D-12) | Zero build cost, works on every modern browser |
| JSON schema validation for vision response | Custom parsing + try/catch | AI SDK `generateObject` with Zod schema | Type-safe, no parse errors |
| Bottom-sheet gesture physics | Raw touch events | [Vaul](https://vaul.emilkowal.ski/) or Framer Motion drag (already uses `@dnd-kit` but that's not for sheets) | Gesture physics are harder than they look |
| Pull-to-refresh | Raw touchstart/touchmove | Existing library or native `overscroll-behavior` CSS + a minimal indicator | Jank-free scroll interception is hard |
| Haptic feedback | Custom wrapper | `navigator.vibrate(50)` directly (per D-10) | 1-line API, no library needed |
| QR code scanning | In-app camera with getUserMedia | **Nothing** — users scan with their phone's native camera app; we only handle the landing URL | Eliminates HTTPS + permission prompts entirely |

---

## Code Examples

### Detect mobile in React (new `useBreakpoint` hook)

```typescript
// src/hooks/useBreakpoint.ts
// Source: MDN Window.matchMedia
import { useEffect, useState } from 'react'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 767px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}
```

### "Best on desktop" hint component (D-07)

```tsx
// src/components/shared/DesktopOnlyHint.tsx
import { useIsMobile } from '@/hooks/useBreakpoint'

export function DesktopOnlyHint({ featureName }: { featureName: string }) {
  const isMobile = useIsMobile()
  if (!isMobile) return null

  const emailLink = `mailto:?subject=Open on desktop&body=${encodeURIComponent(window.location.href)}`

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 m-4" role="status">
      <p className="text-sm text-amber-900">
        <strong>Best on desktop.</strong> {featureName} is optimized for larger screens.
      </p>
      <a
        href={emailLink}
        className="mt-2 inline-block text-sm text-amber-900 underline min-h-[44px] py-2"
      >
        Email this link to myself
      </a>
    </div>
  )
}
```

### Video handler skeleton (Option B)

```typescript
// api/_lib/ai/analyzeVideo.ts
// Source: AI SDK docs on generateObject + vision content parts
import { generateObject } from 'ai'
import { z } from 'zod'
import { selectModel } from './modelRouter.js'
import { getModel } from './providers.js'
import type { VercelResponse } from '@vercel/node'
import type { AuthenticatedRequest } from '../middleware/index.js'

const VideoAnalysisSchema = z.object({
  summary: z.string(),
  suggestedIdeas: z.array(z.object({
    content: z.string(),
    details: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })),
})

export async function handleAnalyzeVideo(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const { frames, projectContext } = req.body as {
      frames: string[]  // data URIs
      projectContext?: { projectName?: string; projectType?: string; description?: string }
    }

    if (!Array.isArray(frames) || frames.length === 0 || frames.length > 12) {
      return res.status(400).json({ error: 'frames must be an array of 1-12 data URIs' })
    }

    const selection = selectModel({
      task: 'analyze-image',  // reuse until modelRouter gains analyze-video
      hasVision: true,
      hasAudio: false,
      userTier: 'free',
    })

    const prompt = buildVideoPrompt(projectContext)

    const { object } = await generateObject({
      model: getModel(selection.gatewayModelId),
      schema: VideoAnalysisSchema,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...frames.map((frame) => ({ type: 'image' as const, image: frame })),
        ],
      }],
      maxOutputTokens: selection.maxOutputTokens,
      temperature: selection.temperature,
    })

    return res.status(200).json(object)
  } catch (error) {
    console.error('Video analysis error:', error)
    return res.status(500).json({ error: 'Failed to analyze video' })
  }
}

function buildVideoPrompt(ctx?: { projectName?: string; projectType?: string; description?: string }): string {
  const project = ctx?.projectName
    ? `\n\nPROJECT CONTEXT:\n- Project: ${ctx.projectName}\n- Type: ${ctx.projectType ?? 'General'}\n- Description: ${ctx.description ?? ''}`
    : ''

  return `You are analyzing a video through 6 uniformly-sampled frames. Provide a holistic summary of what the video depicts across these frames — treat them as a coherent sequence, not isolated images. Then suggest 3-5 actionable ideas relevant to the project context.${project}

Return valid JSON matching the schema: { summary, suggestedIdeas: [{content, details, priority}] }.`
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Raw OpenAI `fetch()` to chat/completions | AI SDK v6 `generateText` / `generateObject` | Phase 2 (complete) | Video handler inherits this — use `generateObject` with Zod, not manual JSON.parse |
| `api/ai.ts` monolith | Handler-per-action under `api/_lib/ai/` | Phase 2 (complete) | Add `analyzeVideo.ts` as a peer of `analyzeImage.ts` |
| ffmpeg.wasm multi-thread for video | HTMLVideoElement + canvas (D-12) | Phase 7 (this) | Zero build cost; single-thread ffmpeg.wasm is explicitly out of scope per REQUIREMENTS.md line 118 |
| Multi-GoTrueClient anon-singleton for DB writes in Node handlers | Service-role admin client threaded explicitly | Phase 6 hotfix | Any new quota/usage write must follow this |

**Deprecated/outdated:**
- Don't reach for ffmpeg.wasm — REQUIREMENTS.md explicitly rules out the multi-threaded variant (CORS conflicts with Stripe scripts); single-thread is too slow to matter; and D-12 locks in HTMLVideoElement.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 3.2.4 (unit/component) + Playwright 1.55.0 (E2E) + `@axe-core/playwright` 4.10.2 (a11y) |
| Config file | `vitest.config.ts`, `playwright.config.ts` → `playwright.base.config.ts` |
| Quick run command | `npx vitest run src/path/to/file.test.ts` |
| Full suite command | `npm run test:run && npm run test:functional` |
| Mobile E2E command | `npx playwright test tests/e2e/mobile-brainstorm-flow.spec.ts --project=mobile-chrome` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| MOB-01 | All 4 phase flags enable without errors; `phase5Regression` suite green | unit/integration | `npx vitest run src/lib/__tests__/phase5Regression.test.ts` | ✅ |
| MOB-01 | Mobile brainstorm E2E flow end-to-end | E2E | `npx playwright test tests/e2e/mobile-brainstorm-flow.spec.ts` | ✅ (needs audit — may predate flag enablement) |
| MOB-03 | No horizontal scroll at 360/393/744px on critical paths | E2E visual | `npx playwright test tests/e2e/mobile-responsive.spec.ts` | ❌ Wave 0 |
| MOB-03 | Touch targets ≥ 44×44px on critical paths | E2E a11y | `npx playwright test tests/e2e/mobile-touch-targets.spec.ts` | ❌ Wave 0 |
| MOB-04 | Mobile brainstorm submit form keyboard + touch | E2E | Extend `mobile-brainstorm-flow.spec.ts` | ⚠️ partial |
| MOB-05 | QR join hash flow validates token + joins session | E2E | `npx playwright test tests/e2e/mobile-join-qr.spec.ts` | ❌ Wave 0 |
| MM-05 | Upload valid .mp4 → receive summary + suggestedIdeas | integration (mock AI) | `npx vitest run src/lib/video/__tests__/videoFrameExtractor.test.ts` | ❌ Wave 0 |
| MM-05 | Reject oversized (>100MB), overlong (>5min), unsupported codec | unit | Same file | ❌ Wave 0 |
| MM-05 | End-to-end video upload → UI renders suggestedIdeas | E2E | `npx playwright test tests/e2e/video-analysis.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run <relevant test file>` — sub-second feedback
- **Per wave merge:** `npm run test:run && npm run test:functional` — all unit + functional E2E
- **Phase gate:** full suite green + manual QA on iPhone + Android device for MOB-05 + MM-05 smoke

### Wave 0 Gaps

- [ ] `src/hooks/useBreakpoint.ts` — new hook (no existing hook in codebase)
- [ ] `src/components/shared/DesktopOnlyHint.tsx` — new component for D-07
- [ ] `src/lib/video/videoFrameExtractor.ts` + `__tests__/videoFrameExtractor.test.ts` — new module with HTMLVideoElement pattern
- [ ] `api/_lib/ai/analyzeVideo.ts` + `__tests__/analyzeVideo.test.ts` — new handler (Option B)
- [ ] `tests/e2e/mobile-touch-targets.spec.ts` — Playwright touch-target audit spec
- [ ] `tests/e2e/mobile-responsive.spec.ts` — horizontal-scroll + viewport audit
- [ ] `tests/e2e/mobile-join-qr.spec.ts` — QR flow E2E (may already be covered by `mobile-brainstorm-flow.spec.ts` — verify in Wave 0)
- [ ] `tests/e2e/video-analysis.spec.ts` — happy path + error paths
- [ ] Playwright project config update — add iPhone 14 Pro (393px), Galaxy S21 (360px), iPad mini (744px) viewport projects (custom, since `devices[]` presets don't match)
- [ ] `MobileIdeaSubmitForm` — verify file exists, inspect font-size (iOS zoom-on-focus) and submit button size (44×44px min)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Reuses existing `withAuth` middleware on `/api/ai` — no new auth surface |
| V3 Session Management | yes | Mobile join token validation already in `BrainstormSessionService.validateAccessToken` — verify expiry enforcement during QA |
| V4 Access Control | yes | Video analysis endpoint must be behind `withAuth` + `withCSRF` + `withUserRateLimit` (inherited from `api/ai.ts:74-78` compose) |
| V5 Input Validation | yes | Frame count ≤ 12, frame size ≤ 4 MB total, data-URI format check, projectContext schema; use Zod |
| V6 Cryptography | no | No new crypto |
| V12 File Upload | yes | Size (100 MB), duration (5 min), MIME type (`video/mp4` `video/webm` `video/quicktime`), rejected on client before any network call — no server upload |

### Known Threat Patterns for {React SPA + Vercel serverless + AI Gateway}

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Prompt injection via video content (text in frames instructs model to exfiltrate) | Tampering/Info Disclosure | System prompt explicitly scopes model to summary + idea suggestions; use `generateObject` with Zod schema to constrain output shape |
| Vercel 4.5 MB body limit DoS via oversized frames | DoS | Client-side size guardrail + server-side body size check |
| Rate-limit bypass via multiple video uploads | DoS | `withUserRateLimit({ windowMs: 1hr, maxRequests: 20 })` already applied via `api/ai.ts` compose; video is 1 call per upload, so this is sufficient |
| Content moderation bypass in mobile brainstorm idea submission | Tampering | `ContentModerationService` is already gated behind PHASE5 flag — enablement wave is the control point |
| Stale `FEATURE_FLAGS` value in SSR-loaded API handler due to build-time static replacement | Spoofing | Flags are frontend-only; API handlers don't read them. But if ever extended, thread explicitly via request body, not `import.meta.env` at the handler |
| iOS Safari device fingerprint degraded → duplicate participant tracking | Tampering | Fallback fingerprint generation; server-side rate limiting per session, not per fingerprint |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `withUserRateLimit: 20 req/hr` is sufficient for video analysis use | Security Domain, Video Analysis | If users legitimately upload >20 videos/hr, they'll hit a rate-limit wall. Low risk at launch; monitor. |
| A2 | GPT-4o-class vision model selected by `selectModel({task:'analyze-image', hasVision:true})` | Video Analysis §cost/latency | Latency/cost estimate off by 2-5x if a cheaper slower model is selected. Verify in `modelRouter.ts` during planning. |
| A3 | 6 frames at 1024px JPEG q=0.85 fits under Vercel's 4.5 MB body limit with margin | Video Analysis §transport | May blow limit on high-detail footage. Mitigation: client-side size guardrail + fallback to Supabase Storage upload path. |
| A4 | `devices['Pixel 5']` and `devices['iPhone 12']` in Playwright are acceptable approximations of D-09's Galaxy S21 and iPhone 14 Pro | Mobile Testing Strategy | Viewport deltas may mask real bugs. Mitigation: use custom `viewport:{width, height}` configs explicitly. |
| A5 | The existing `mobile-brainstorm-flow.spec.ts` does not depend on the PHASE flags being on | Mobile Testing Strategy §what exists | If the test predates flags-on mode, it may already be broken in the flags-on configuration. Wave 0 task: run it with flags on and triage. |
| A6 | `MobileIdeaSubmitForm` component exists at `src/components/MobileIdeaSubmitForm.tsx` (imported at `MobileJoinPage.tsx:15`) | Mobile Scaffolding Inventory | If the import is dangling, Phase 3 enablement will crash. Wave 0 task: `ls` verify. |
| A7 | `generateDeviceFingerprint` in `src/lib/security/brainstormSecurity.ts` works on iOS Safari 17+ | QR Join Flow | If it silently fails, all iOS participants get the same fingerprint. Verify during QA. |
| A8 | D-07's "email me the link" CTA uses `mailto:` and that's acceptable UX (vs a server-side email dispatch via Resend) | Code Examples | `mailto:` opens the user's email app which may not be configured. Acceptable for v1 per "non-blocking" framing in D-07. |
| A9 | Quota enforcement via `withQuotaCheck('ai_ideas', ...)` is the right bucket for video analysis | Video Analysis §Option B | Could justify a new `ai_video` bucket with different limits. Defer to CONTEXT.md silence on this — reuse `ai_ideas` and revisit if it leaks budget. |
| A10 | Vision API cost of ~$0.02-0.04 per video is acceptable at free tier | Video Analysis §cost/latency | If free-tier users upload aggressively, this blows the AI budget. Free tier should rely on existing `withQuotaCheck` limits. |

---

## Open Questions

1. **Does `mobile-brainstorm-flow.spec.ts` run with PHASE flags on?** — may need env setup in the test runner (`VITE_MOBILE_BRAINSTORM_PHASE3=true npx playwright test ...`) since Vite build-time replacement means the dev server must be started with the env var set.
   - Recommendation: Wave 0 QA task — run with flags on; triage failures as bugs for the enablement plan.
2. **Does `modelRouter.ts` have an `analyze-video` task key or should the video handler reuse `analyze-image`?** — worth grepping in planning wave.
   - Recommendation: reuse `analyze-image` in v1; add `analyze-video` as a separate key in a follow-up if latency/cost diverges enough to warrant different routing.
3. **Does `generateDeviceFingerprint()` degrade gracefully on iOS Safari?** — affects MOB-05 reliability.
   - Recommendation: Wave 0 inspection task.
4. **Option A vs Option B for the analyzeImage/analyzeVideo split** — lean B, but the planner should confirm by checking how many callers the current `handleAnalyzeImage` has and whether its response shape is load-bearing downstream.
5. **Where does the "email me the link" CTA actually dispatch?** — `mailto:` is the pragmatic v1, but Resend (Phase 05.2) is already wired and could send a proper transactional email. Decision deferred to plan-level; `mailto:` is acceptable.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node 22.19.0 | All | ✓ (per `.nvmrc`) | 22.19.0 | — |
| Vite 5.0.8 | Dev + build | ✓ | 5.0.8 | — |
| Playwright 1.55.0 | Mobile E2E | ✓ | 1.55.0 | — |
| `@axe-core/playwright` 4.10.2 | Touch-target a11y audit | ✓ | 4.10.2 | — |
| AI SDK v6 + AI Gateway | Video vision call | ✓ (Phase 2 complete) | v6 | — |
| Real iPhone (physical) | MM-05 + MOB-05 smoke test | ✗ (unknown to agent) | — | Playwright `mobile-safari` project + ngrok tunnel (`indistinctly-blackish-tien.ngrok-free.dev` already allowlisted in `vite.config.ts:195`) |
| Real Android phone | MOB-05 smoke test | ✗ (unknown) | — | Playwright `mobile-chrome` project |

**Missing dependencies with no fallback:** none blocking — Playwright mobile emulation covers the automated gate. Physical device QA is recommended final smoke but not a hard dep.

---

## Sources

### Primary (HIGH confidence — verified in codebase or Context7/docs)
- `src/lib/config.ts:44-115` — FEATURE_FLAGS definitions
- `src/pages/MobileJoinPage.tsx` — full QR join flow
- `api/_lib/ai/analyzeImage.ts` — existing vision handler (verified does NOT batch)
- `api/ai.ts` — router + auth compose
- `vite.config.ts:78-93` — backend env var allowlist (verified mobile flags are frontend-only, listing optional)
- `playwright.base.config.ts:82-96` — mobile browser project definitions
- `.planning/REQUIREMENTS.md` — MOB-01/03/04/05, MM-05, out-of-scope ffmpeg.wasm multi-thread note
- `.planning/phases/07-mobile-polish-video-analysis/07-CONTEXT.md` — D-01..D-22

### Secondary (MEDIUM confidence — MDN / vendor docs, training-derived but cross-verified)
- MDN `HTMLMediaElement.seeked` event semantics [CITED]
- MDN `HTMLMediaElement.playsInline` iOS Safari requirement [CITED]
- MDN `Window.matchMedia` hook pattern [CITED]
- AI SDK `generateObject` with Zod schema pattern [CITED: ai-sdk.dev docs]

### Tertiary (LOW confidence — ASSUMED training knowledge, flagged)
- GPT-4o vision token cost/latency estimates (A2, A10)
- Total payload size prediction for 6 scaled JPEG frames (A3)
- iOS Safari Intelligent Tracking Prevention effect on canvas fingerprinting (Pitfall 7)

---

## Metadata

**Confidence breakdown:**
- Mobile scaffolding inventory: **HIGH** — grep-verified file list, inline-doc-verified flag semantics
- Mobile feature classification: **HIGH** for pages/ directory contents, **MEDIUM** for initial classification tags (planner should refine in audit)
- QR flow analysis: **HIGH** — full file read, no browser-camera API involved
- Video frame extraction pattern: **HIGH** — canonical MDN-grounded pattern, verified seek semantics
- Vision API integration path: **HIGH** — existing handler read end-to-end; gap vs D-15 assumption is definitive
- Cost/latency estimates: **LOW** — training-derived, flagged as [ASSUMED] A2/A10
- iOS Safari quirks: **MEDIUM** — cited from MDN but not re-verified against current Safari release

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (30 days — HTMLVideoElement + AI SDK patterns are stable; mobile Safari quirks change slowly)

---

## RESEARCH COMPLETE
