# Phase 7: Mobile Polish & Video Analysis - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Two substantive tracks delivered in the same phase:

**Track A — Mobile as a companion experience.** The mobile experience is not a shrunken copy of desktop. It is a **companion surface** optimized for what mobile does well (capture ideas on the go, join brainstorms via QR, vote, view results) while deferring complex authoring tasks to desktop. This phase enables the 4 already-scaffolded `MOBILE_BRAINSTORM_PHASE2..5` feature flags, explicitly decides per page/feature which experiences are mobile-native, which are desktop-only, and which are mobile-view-only, and delivers the responsive + touch polish needed on the critical user paths.

**Track B — Video analysis.** User uploads a video → client-side frame extraction via HTMLVideoElement + canvas → frames sent to the existing vision API → output is a text summary plus a list of extracted IdeaCard suggestions the user can add to their matrix (mirrors the existing image analysis UX).

**In scope:**
- Enable `VITE_MOBILE_BRAINSTORM_PHASE2/3/4/5` feature flags via env var + vite.config.ts allowlist
- Audit each flag's existing code as it surfaces in manual testing; fix bugs that block the companion experience
- Critical-path responsive polish: auth, projects list, matrix, brainstorm session, settings
- Mobile-specific enhancements on those critical paths (touch targets, bottom-sheet modals, pull-to-refresh where it makes sense, swipe gestures where they feel native)
- QR code join flow reliability on iOS Safari + Android Chrome
- Feature-by-feature companion-vs-desktop classification (see decisions D-04..D-08)
- Video upload UI + client-side frame extraction (HTMLVideoElement + canvas)
- Vision API integration for extracted frames (reuse existing vision endpoint, batch-send frames)
- Video analysis results UI (summary + IdeaCard suggestions, add to matrix)

**Out of scope:**
- Full responsive sweep of admin / reports / analytics / FAQ / pricing / button-test pages (these are desktop-primary per the companion model)
- Native iOS/Android apps — still a PWA
- Offline-first behavior for mobile (maybe future)
- Server-side ffmpeg (client-side only per D-10)
- FFmpeg.wasm (client-side HTMLVideoElement is sufficient)
- Video storage / playback library (frames are ephemeral, analyzed immediately, discarded after)
- Frame-by-frame annotations UI (summary + ideas only)
- Video length > 5 minutes or size > 100MB (client-side constraints — document limits in the upload UI)

</domain>

<decisions>
## Implementation Decisions

### Mobile Philosophy (Track A)
- **D-01:** **Mobile is a companion experience, not a full copy.** Every feature in the app gets classified as one of:
  - **Mobile-native** — first-class mobile experience, optimized layout + gestures
  - **Mobile-view-only** — readable/usable on mobile but not optimized; acceptable as-is
  - **Desktop-only** — complex authoring, data-dense views, admin; mobile users see a "best on desktop" hint if they navigate there
- **D-02:** Classification happens in the first wave of the phase as a documented audit; the audit result lives in a `MOBILE-AUDIT.md` deliverable alongside the plans so downstream work (responsive fixes) has a priority list.

### Mobile Brainstorm Flags (Track A)
- **D-03:** **Enable all 4 feature flags via env vars.** Flip `VITE_MOBILE_BRAINSTORM_PHASE2=true`, `PHASE3=true`, `PHASE4=true`, `PHASE5=true` in `.env.local` and in `.env.example` with empty defaults. Also add all 4 to `vite.config.ts` dev API env-var allowlist (same lesson as Phase 05.2/06).
- **D-04:** Do NOT remove the flags. They stay as config toggles so we can roll back individual phases if a specific one causes regressions.
- **D-05:** After enabling, manual test each phase's existing code against the companion experience classification. File bugs as plan-level tasks, not separate phases.

### Feature Classification (Track A — pending audit, initial guess)
- **D-06 (initial classification, refined in MOBILE-AUDIT.md):**
  - Mobile-native: brainstorm join (QR code), brainstorm idea submission, brainstorm results view, basic project list (read-only), simple idea capture (add to matrix from mobile), authentication
  - Mobile-view-only: project matrix (view + basic idea interaction, drag/drop acceptable but not highlighted), roadmap read-only view, subscription/billing dashboard (read-only)
  - Desktop-only: AI Insights modal, admin portal, reports/analytics, roadmap editing, team collaboration management, project settings, file analysis, PDF export
- **D-07:** When a mobile user navigates to a desktop-only feature, show a small "Best on desktop — open on your computer" hint with a CTA to email themselves the link. Non-blocking — they can still view if they want.
- **D-08:** Desktop-only features don't need to crash on mobile, but they don't need responsive polish either. The hint replaces the effort of making them mobile-friendly.

### Critical-Path Mobile Polish (Track A)
- **D-09:** Critical paths for responsive + touch polish:
  1. Authentication (sign in, sign up, magic link flow)
  2. Projects list
  3. Project matrix (view mode — companion to desktop authoring)
  4. Brainstorm session (join, submit idea, vote, view results)
  5. Settings (subscription status, upgrade CTA)
  - Constraints: WCAG 2.1 AA touch targets (44x44px min), no horizontal scroll on 375px+ viewport, readable text without zoom, form inputs avoid iOS Safari zoom-on-focus.
  - Testing targets: iPhone 14 Pro width (393px), Samsung Galaxy S21 width (360px), iPad mini (744px).

### Mobile-Specific Enhancements (Track A)
- **D-10:** Add targeted mobile-native enhancements only on critical paths:
  - Bottom-sheet modals for idea submission on brainstorm (replaces center-dialog)
  - Pull-to-refresh on projects list
  - Swipe-to-vote on brainstorm idea cards (where semantically appropriate)
  - Haptic feedback via `navigator.vibrate()` on vote/submit (optional, best-effort)
- **D-11:** Claude's Discretion: exact animation timing, gesture thresholds, haptic patterns, empty-state copy.

### Video Analysis (Track B)
- **D-12:** **Client-side frame extraction using HTMLVideoElement + canvas.** No ffmpeg, no WASM. Upload file into a hidden `<video>` element, seek to N uniformly-distributed timestamps, draw each to a canvas, export to JPEG blob. Zero server cost, works on any device with a modern browser.
- **D-13:** Extract **6 frames per video** by default (uniformly distributed across duration). Tunable constant, not a user input. 6 is enough for vision to identify content, cheap enough to fit in a single prompt.
- **D-14:** Frame resolution: scale to max 1024px on the long edge, JPEG quality 0.85. Keeps payload under ~300KB per frame, under ~2MB total for 6 frames.
- **D-15:** **Reuse existing vision API path** (same endpoint as image analysis). Batch the 6 extracted frames into a single vision call, prompt explicitly asks for "holistic summary of the video content based on these sampled frames" + "extracted idea suggestions in structured format".
- **D-16:** **Output shape mirrors image analysis:** `{ summary: string, suggestedIdeas: IdeaCard[] }`. Same result UI component as image analysis, just labeled "Video analysis" instead of "Image analysis".
- **D-17:** Upload constraints documented in the UI:
  - Max file size: 100 MB
  - Max duration: 5 minutes (checked after metadata loads; reject with clear error)
  - Accepted formats: `video/mp4`, `video/webm`, `video/quicktime`
  - If the browser fails to decode the video (codec issue), show a clear error suggesting "convert to MP4 and try again" — do NOT fall back to server-side processing
- **D-18:** Video file is never uploaded to the server. Only the extracted JPEG frames reach the vision API. No storage in Supabase Storage.

### Video UX (Track B)
- **D-19:** Entry point: add "Upload video" button to the existing file analysis / AI starter modal flow — same location as image upload. Not a separate route.
- **D-20:** While extracting frames + calling vision, show a multi-stage loader: "Extracting frames (2/6)…", "Analyzing video…", "Done". Total expected time <30s for typical videos.
- **D-21:** Claude's Discretion: exact copy, loader animations, empty/error states, retry UX.

### Canonical deferred
- **D-22:** Server-side video processing, ffmpeg, real-time transcoding, video playback, longer videos, larger files — all deferred. If users complain, we add server-side in a future phase, but client-side covers the core value.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — MOB-01, MOB-03, MOB-04, MOB-05, MM-05
- `.planning/ROADMAP.md` §"Phase 7: Mobile Polish & Video Analysis"

### Existing mobile scaffolding (Track A)
- `src/lib/config.ts` lines 59-115 — `FEATURE_FLAGS.MOBILE_BRAINSTORM_PHASE2..5` definitions with inline docs of what each phase enables
- `src/pages/MobileJoinPage.tsx` — QR join landing page (Phase 1 scaffolding, stable)
- `src/components/brainstorm/SessionQRCode.tsx` — QR code display component
- `src/components/brainstorm/DesktopParticipantPanel.tsx` — facilitator participant list
- `src/components/brainstorm/SessionControls.tsx` — facilitator pause/resume/end
- `src/components/brainstorm/PresenceIndicators.tsx` — presence avatar stack
- `src/components/matrix/MatrixFullScreenView.tsx` — fullscreen matrix that integrates QR code activation (Phase 4 flag)
- `src/lib/services/ContentModerationService.ts` — Phase 5 content moderation
- `src/lib/services/RateLimitService.ts` — Phase 5 rate limiting
- `src/lib/services/SessionSecurityService.ts` — Phase 5 session security
- `src/lib/__tests__/phase5Regression.test.ts` — Phase 5 regression test suite

### Existing image analysis (Track B — pattern to mirror)
- `src/components/AIInsightsModal.tsx` — existing AI analysis UI
- `api/ai.ts` — AI endpoint router (likely has an image analysis action to reuse for video frames)
- `src/lib/ai/` — any existing services for AI prompt building
- `src/types/index.ts` — `IdeaCard` type (video analysis returns these as suggestedIdeas)

### Mobile testing
- Playwright config may need mobile viewports added
- `tests/e2e/` — existing E2E suite, add mobile-flagged tests

### Project-level
- `design-matrix-app/CLAUDE.md` — mobile + responsive requirements, Supabase invariants
- Phase 5.3 / Phase 6 lesson: any new env var MUST be added to vite.config.ts dev allowlist
- `.claude/rules/frontend.md` — touch target + responsive rules

</canonical_refs>

<specifics>
## Specific Ideas

- The mobile brainstorm phase 2-5 scaffolding exists but has NEVER been enabled in production. Enabling it will almost certainly surface bugs — budget one wave of plans specifically for "enable + fix" cycles per mobile phase flag.
- For the audit deliverable: go page by page in `src/components/pages/` and `src/pages/`, classify each as mobile-native/view-only/desktop-only, and record in `07-MOBILE-AUDIT.md`. The audit is the single source of truth that drives the responsive-polish work list.
- HTMLVideoElement seeking is ASYNCHRONOUS — must await the `seeked` event before drawing to canvas. Classic beginner bug: drawing immediately after setting `currentTime` draws the OLD frame. Document this in the plan.
- iOS Safari blocks video playback/metadata unless the element has `playsInline` and the user has interacted with the page. The extraction flow must trigger after a tap/click, not on mount.
- The vision API path used for image analysis likely already accepts multiple images in a single call — confirm during research/planning and batch the 6 frames rather than making 6 sequential calls.

</specifics>

<deferred>
## Deferred Ideas

- Full responsive sweep of admin/reports/analytics/FAQ/pricing/button-test pages (desktop-only per D-06)
- Native iOS/Android apps (still a PWA)
- Offline-first mobile behavior
- Server-side ffmpeg / FFmpeg.wasm
- Video storage / playback library
- Frame-by-frame annotation UI with timeline
- Videos > 5 min or > 100 MB
- Mobile-specific admin portal
- PWA install prompts / manifest tuning (nice-to-have)

</deferred>

---

*Phase: 07-mobile-polish-video-analysis*
*Context gathered: 2026-04-08 via /gsd-discuss-phase (inline)*
