# Codebase Concerns

**Analysis Date:** 2025-02-14

## Tech Debt

**Authentication State Management Complexity:**
- Issue: `useAuth` hook contains multiple workarounds for Supabase session timeout issues. Multiple fallback layers including localStorage direct reading, emergency timeouts (5s), and degraded-mode user creation.
- Files: `src/hooks/useAuth.ts` (627 lines), `src/lib/supabase.ts`
- Impact: Auth initialization is fragile and requires careful timeout coordination. If timeouts change, the entire auth flow can hang. Multiple entry points for state initialization create race conditions.
- Fix approach: Extract auth session management into a dedicated service with clear responsibilities: session retrieval, timeout handling, and fallback logic. Create a single source of truth for session state.

**Optimistic Update Race Condition:**
- Issue: Delete operations in `useOptimisticUpdates` have a critical race condition between UI state and baseData sync. The hook attempts to fix this by immediately updating baseData on delete, but the pattern is fragile.
- Files: `src/hooks/useOptimisticUpdates.ts` (lines 68-77), `src/components/DesignMatrix.tsx`
- Impact: Deleted items can reappear when other state changes trigger the baseData sync useEffect. This has historically caused the "deleted cards reappearing on collapse/expand" bug (git commit af77a9a).
- Fix approach: Consolidate optimistic update state into a single state machine that prevents conflicting updates. Use a version number or timestamp to arbitrate conflicts. Consider using `useTransition` for coordinated async updates.

**Realtime Connection Fallback Not Tested:**
- Issue: `useBrainstormRealtime` has an `onConnectionFailed` callback that should trigger polling fallback, but there's no mechanism in place to verify this path works under network failures.
- Files: `src/hooks/useBrainstormRealtime.ts` (lines 172-175), `src/lib/realtime/BrainstormRealtimeManager.ts`
- Impact: If WebSocket connection fails in production, the app silently falls back to polling. No E2E test validates this recovery path.
- Fix approach: Add integration test that simulates network partition → connection failure → polling activation. Verify realtime and polling stay consistent.

## Known Bugs

**Supabase getSession() Can Hang Indefinitely:**
- Symptoms: Loading screen never disappears; user is stuck on auth page. Occurs during page refresh or on initial load when Supabase is slow.
- Files: `src/hooks/useAuth.ts` (lines 479-483), `src/utils/promiseUtils.ts`
- Trigger: Network latency > timeout OR Supabase service degradation
- Workaround: 5-second emergency timeout in useAuth forces completion with degraded user profile (no full profile loaded). User is authenticated but with basic data only.
- Current mitigation: Code comments document this is a known Supabase limitation (lines 494-495, 522). Timeout is set to 5s (line 443).

**Modal Centering Fragility:**
- Symptoms: Modal not centered on initial render; requires page reload to fix. Modal position shifts during animations.
- Files: `src/components/shared/Modal.tsx`, related CSS in `tailwind.config.js`
- Trigger: Recent CSS changes (commits 2872b8a, b88220e, 563cac1) addressed wildcard selectors and CSS revert statements that conflicted with centering.
- Workaround: Use pure inline styles with React Portal and fixed positioning instead of CSS Grid or Flexbox.
- Current status: Fixed as of commit 563cac1, but the pattern is brittle. Any new global CSS could rebreak it.

**Delete Button Clipping in Parent Wrapper:**
- Symptoms: Delete button on idea cards gets clipped by parent container's overflow hidden.
- Files: `src/components/matrix/OptimizedIdeaCard.tsx`, related fixes in commits a615840, 176260f, fd40cc8, bd6e233
- Trigger: Parent container has `overflow: hidden` to constrain card size, but delete button positioned absolutely extends beyond bounds.
- Current mitigation: Recent commits adjusted z-index, padding, and parent wrapper structure to allow button overflow.

## Security Considerations

**Service Role Key Exposure Risk:**
- Risk: `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to frontend. Code includes guards (line 71 in vite.config.ts) to ensure it's backend-only.
- Files: `vite.config.ts`, `api/_lib/middleware/withAuth.ts`, `.env` (not committed)
- Current mitigation: Environment variable isolation at build time. Service role key only used in Node.js backend API routes. Frontend receives anon key only.
- Recommendations: Add build-time validation to catch any accidental imports of service role key in frontend bundles. Audit all `api/**` files monthly to ensure no service role key is used there.

**CSRF Protection Gap:**
- Risk: State-changing operations (DELETE, POST) in API routes could be vulnerable to CSRF if cookies are used for auth.
- Files: `api/_lib/middleware/withCSRF.ts`, `api/_lib/middleware/withAuth.ts`
- Current mitigation: CSRF middleware exists and should be applied to all state-changing routes, but enforcement is inconsistent across endpoints.
- Recommendations: Create a wrapper middleware that enforces CSRF on POST/PUT/DELETE/PATCH. Audit all `api/**/*.ts` files to verify CSRF middleware is applied to all state-changing routes.

**Rate Limiting Incomplete:**
- Risk: API endpoints are not rate-limited, allowing brute force attacks on auth endpoints (login, signup) and expensive operations (PDF generation, AI requests).
- Files: `api/_lib/middleware/withRateLimit.ts` exists but usage is unclear
- Current mitigation: `express-rate-limit` package is in dependencies but implementation is partial.
- Recommendations: Apply rate limiting middleware to all auth endpoints, AI endpoints, and expensive operations. Set different limits for different users (logged-in vs anonymous).

**localStorage for Session Token:**
- Risk: Session tokens stored in `localStorage` are vulnerable to XSS. Any compromised script can steal tokens.
- Files: `src/hooks/useAuth.ts` (lines 300-310, 370-381), `src/lib/config.ts` (SUPABASE_STORAGE_KEY)
- Current mitigation: Code includes logic to clear localStorage on logout (lines 407-408, 425-426). Vite config includes basic CSP headers.
- Recommendations: Migrate to httpOnly cookies for token storage (backend-only read/write). This is partially done in `api/_lib/middleware/cookies.ts` but frontend still reads from localStorage.

## Performance Bottlenecks

**Idea Matrix Auto-Positioning Inefficient:**
- Problem: When ideas are stacked at the same position, the matrix calculates positions for all ideas on every load. No caching of calculated positions.
- Files: `src/lib/matrix/coordinates.ts`, `src/components/DesignMatrix.tsx`
- Cause: `normalizedToPixel()` and coordinate conversion functions run on every render. No memoization.
- Improvement path: Cache normalized-to-pixel conversions. Memoize position calculations. Only recalculate when dimensions change. Track calculated positions in the idea object to avoid repeated math.

**ProfileService Queries Not Optimized:**
- Problem: User profile loaded on every login without checking cache. Two parallel requests (profile + project check) both hit database.
- Files: `src/hooks/useAuth.ts` (lines 215-218), `src/services/ProfileService.ts`
- Cause: No request deduplication. If two tabs open simultaneously, both load profiles.
- Improvement path: Add request-level deduplication using a Promise cache keyed by userId. Only one in-flight profile request at a time.

**Batch Position Update Delay:**
- Problem: Position updates batched with 100ms delay (line 83 in `useOptimizedMatrix.ts`). During fast dragging, this creates lag between UI and database state.
- Files: `src/hooks/useOptimizedMatrix.ts` (line 83)
- Cause: Batch window too long. Needs to balance between request volume and perceived responsiveness.
- Improvement path: Reduce batch window to 50ms or implement smart batching that flushes on drag end instead of time-based. Profile real users to find optimal window.

**PDF Generation Blocks Main Thread:**
- Problem: `RoadmapPdfGenerator.ts` (1377 lines) and `GraphicalInsightsPdfGenerator.ts` (920 lines) are large, complex transformations that run on main thread.
- Files: `src/lib/pdf/generators/RoadmapPdfGenerator.ts`, `src/lib/pdf/generators/GraphicalInsightsPdfGenerator.ts`
- Cause: PDF generation is CPU-intensive but runs synchronously.
- Improvement path: Move PDF generation to Web Worker. Use `pdfjs-dist` worker thread API for rendering. Add progress feedback during generation.

## Fragile Areas

**ErrorBoundary Recovery Logic:**
- Files: `src/components/ErrorBoundary.tsx`
- Why fragile: Automatic retry mechanism (lines 58-60, 82-96) uses pattern matching on error messages. If Supabase or webpack changes error message format, retry stops working. No unit test for retry behavior.
- Safe modification: Add integration test that simulates chunk load failure and verifies retry triggers. Extract error detection patterns into testable functions. Document expected error message formats as part of release notes.
- Test coverage: No unit tests for ErrorBoundary retry logic. E2E tests don't cover network-induced chunk load failures.

**Modal State Coordination:**
- Files: `src/components/FeatureDetailModal.tsx` (967 lines), `src/components/EditIdeaModal.tsx`, multiple modal components
- Why fragile: Each modal manages local edit state (`editedFeature`, `newUserStory`) separately. Parent component state and modal state can diverge if async operations are interrupted. Modal close/reopen creates stale closures.
- Safe modification: Extract modal form state into a context provider or custom hook. Use `useCallback` with exhaustive deps to prevent stale closures. Add `ref` to track mounted state.
- Test coverage: `FeatureDetailModal.test.tsx` tests happy path but missing tests for state recovery after async failures.

**Brainstorm Session Participant Tracking:**
- Files: `src/lib/realtime/BrainstormRealtimeManager.ts` (lines 142-149), `src/hooks/useBrainstormRealtime.ts` (lines 155-167)
- Why fragile: Participant state tracked in both the realtime manager and hook component state. When participant disconnects, both must be updated. If one update fails silently, they can become out of sync.
- Safe modification: Make BrainstormRealtimeManager the single source of truth. Hook should read from manager, not maintain duplicate state. Implement cross-check on every state update to detect divergence.
- Test coverage: No test validates that participant state stays in sync across realtime updates, disconnections, and UI re-renders.

**Optimistic Delete with Fallback:**
- Files: `src/hooks/useOptimisticUpdates.ts` (lines 73-77), `src/components/DeleteConfirmModal.tsx`
- Why fragile: Race condition between optimistic delete (removes from both optimisticData and baseData) and realtime subscription (inserts idea back if delete fails server-side). If network is slow, user sees delete succeed but item reappears.
- Safe modification: Store optimistic updates with server request status. Don't remove from baseData immediately. Only remove when server confirms. Add visual indicator for in-flight operations.
- Test coverage: No E2E test covers delete failure recovery. Unit test assumes delete always succeeds.

## Scaling Limits

**Realtime Channel Limit:**
- Current capacity: Each session has 3 channels (ideas, participants, presence). Code tracks channels in a Map (line 26 in BrainstormRealtimeManager.ts).
- Limit: Supabase realtime has a per-connection limit (typically 100 channels). With 30+ concurrent sessions, limit could be approached.
- Scaling path: Implement channel pooling. Reuse channels across sessions using message filtering. Or migrate to a dedicated WebSocket server for brainstorm sessions.

**Database Query Performance at Scale:**
- Current capacity: Project queries use `.select('id', { count: 'exact', head: true })` for fast existence checks (useAuth.ts line 100-104). Index on owner_id + created_at assumed.
- Limit: At 100k+ projects per user, even existence checks become slow. No pagination for idea lists.
- Scaling path: Implement cursor-based pagination for idea lists. Add materialized view for project counts. Cache project existence for 1 hour per user.

**Frontend Bundle Size:**
- Current capacity: Build produces multiple chunks (vendor, ui, pdf). PDF libraries alone add ~500KB.
- Limit: Large bundles delay first paint. PDF generation requires jspdf + pdfmake + html2canvas simultaneously.
- Scaling path: Lazy-load PDF libraries only when user opens PDF export modal. Implement progressive JPEG export as lighter alternative. Monitor with `npm run build:check`.

## Dependencies at Risk

**Supabase v2 Realtime API Fragility:**
- Risk: `@supabase/supabase-js@^2.57.2` realtime API has known issues with connection recovery. Multiple `onAuthStateChange` listeners can cause race conditions.
- Impact: Auth state can become inconsistent. Realtime subscriptions may not resubscribe on network recovery.
- Migration plan: Monitor Supabase v3 release (planned for early 2025). Upgrade incrementally. Add integration tests before upgrading to catch breaking changes.

**Stripe SDK Integration:**
- Risk: `@stripe/stripe-js@^5.3.0` requires careful handling of publishable key. If key is rotated, old code paths still work but create errors in logs.
- Impact: Payment failures for users with cached old key. Webhook signature mismatches if secret rotated.
- Migration plan: Implement version pinning for Stripe SDK. Add webhook signature verification tests. Monitor Stripe API changelog for deprecations.

**PDF Generation Libraries Complexity:**
- Risk: Three PDF libraries used (jspdf, pdfmake, html2canvas). Each has different API and dependencies. Risk of breaking changes or maintenance issues.
- Impact: PDF export could break with minor library updates. No integration tests validate PDF output.
- Migration plan: Consolidate on single PDF library (e.g., jsPDF for most, html2canvas for complex layouts). Remove unused libraries. Add visual regression tests for PDF output.

## Missing Critical Features

**No Offline Support:**
- Problem: All operations require network. No service worker or offline cache. If user loses connection during brainstorm, ideas are not saved locally.
- Blocks: Use cases requiring mobile connectivity (coffee shop brainstorms, commute scenarios).
- Impact: Poor UX on unreliable networks. Brainstorm sessions can be lost.
- Recommendation: Implement offline-first architecture with IndexedDB for local storage. Sync on reconnect. Document limitations.

**No Backup/Export:**
- Problem: No automatic data backup. User can export to PDF but no automated daily backups.
- Blocks: Compliance use cases requiring audit trails. Data preservation for deleted projects.
- Impact: Data loss is permanent if user deletes project by mistake.
- Recommendation: Implement point-in-time recovery using Supabase backups. Add manual project export (JSON) before deletion.

**No Search/Filtering:**
- Problem: No ability to search ideas by text or filter by tags/priority across projects.
- Blocks: Users with 100+ ideas cannot find specific ideas quickly.
- Impact: Scalability issue for power users.
- Recommendation: Add full-text search using Supabase search. Implement faceted filtering UI. Consider Elasticsearch if FTS becomes bottleneck.

## Test Coverage Gaps

**Auth Refresh Scenarios Not Fully Tested:**
- What's not tested: Page refresh with valid session → user stays logged in without loading screen. Session expiration → auto-refresh → logged in state preserved.
- Files: `src/hooks/__tests__/useAuth.test.ts` (if exists), `src/__tests__/auth-uuid-integration.test.ts`
- Risk: Auth state can become inconsistent if refresh logic breaks. Multiple bug fixes (commits 636cd19, 9569a9c) indicate this is fragile.
- Priority: High - Core user experience depends on this.

**Realtime Connection Failure Fallback:**
- What's not tested: WebSocket fails → polling activates → ideas still sync correctly. Polling and realtime don't duplicate or lose updates.
- Files: `src/hooks/__tests__/useBrainstormRealtime.test.ts` (if exists)
- Risk: Silent data loss if fallback doesn't work. User thinks session is live when actually polling.
- Priority: High - Data integrity depends on this.

**Modal State Management Consistency:**
- What's not tested: Open modal → make edits → close without saving → reopen → state is clean (no stale edits). Multiple modal instances don't interfere.
- Files: All modal component tests
- Risk: Stale state in modals can cause data corruption or unexpected edits.
- Priority: Medium - Affects data integrity but limited to users who rapidly open/close modals.

**Optimistic Update Reversion:**
- What's not tested: Create idea (optimistic) → server fails → optimistic reverts → baseData matches original. Delete idea (optimistic) → collapse/expand → item doesn't reappear.
- Files: `src/hooks/__tests__/useOptimisticUpdates.test.ts` (if exists)
- Risk: Data divergence between UI and server. Deleted items reappear (historical bug).
- Priority: High - Critical data integrity issue.

**Error Boundary Network Failures:**
- What's not tested: Chunk load fails → retry activates → succeeds on 2nd attempt. Network error triggers retry loop but respects max retries.
- Files: `src/components/__tests__/ErrorBoundary.test.tsx`
- Risk: Users stuck in error state or infinite retry loop.
- Priority: Medium - Affects UX but rare in production.

---

*Concerns audit: 2025-02-14*
