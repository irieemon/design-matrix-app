---
phase: 05-real-time-collaboration
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - api/invitations/create.ts
  - api/invitations/accept.ts
  - api/invitations/lookup.ts
  - api/_lib/invitationTokens.ts
  - api/__tests__/invitations.create.test.ts
  - api/__tests__/invitations.accept.test.ts
  - src/components/InviteCollaboratorModal.tsx
  - src/components/RolePicker.tsx
  - src/pages/InvitationAcceptPage.tsx
  - src/App.tsx
autonomous: true
requirements: [COLLAB-03, COLLAB-04]
must_haves:
  truths:
    - "Project owner can POST /api/invitations with {email, role} and receive an invite link"
    - "Invite recipient opens /invite#token=... and after signup is attached to project with correct role"
    - "Expired or reused tokens return a clear error and do not create a collaborator row"
    - "InviteCollaboratorModal posts to real backend, no more local-only state"
  artifacts:
    - path: api/invitations/create.ts
      provides: "POST endpoint — validates email, generates token, hashes, stores, sends EmailJS"
    - path: api/invitations/accept.ts
      provides: "POST endpoint — calls accept_invitation() RPC as authenticated user"
    - path: src/pages/InvitationAcceptPage.tsx
      provides: "Token landing page with signup/login handoff and final join call"
    - path: src/components/RolePicker.tsx
      provides: "Viewer/Editor segmented control"
  key_links:
    - from: InviteCollaboratorModal.tsx
      to: /api/invitations
      via: fetch POST with CSRF header
      pattern: "fetch\\('/api/invitations'"
    - from: InvitationAcceptPage.tsx
      to: accept_invitation RPC
      via: supabase.rpc('accept_invitation', { p_token })
      pattern: "rpc\\('accept_invitation'"
---

<objective>
Ship the invitation pipeline: backend endpoints to create / lookup / accept invitations, and wire the existing `InviteCollaboratorModal.tsx` to the real backend. Adds the invitation accept landing page that runs the signup → RPC flow safely (no getSession deadlock). Closes COLLAB-03 and COLLAB-04 end-to-end.

Purpose: Everything else in Phase 5 assumes collaborators exist on projects. This plan makes that real.
Output: Three Vercel function routes, a token hash utility, a RolePicker component, a wired invite modal, and an accept landing page added to the router.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/05-real-time-collaboration/05-CONTEXT.md
@.planning/phases/05-real-time-collaboration/05-RESEARCH.md
@.planning/phases/05-real-time-collaboration/05-UI-SPEC.md
@.planning/phases/05-real-time-collaboration/05-01-SUMMARY.md
@src/components/InviteCollaboratorModal.tsx
@api/auth.ts
@src/lib/authClient.ts
@src/utils/logger.ts

<interfaces>
From plan 01 (assumed landed):
- `invitationRepository.createInvitation({ projectId, email, role, tokenHash, expiresAt, invitedBy })` returns `{ id }`
- `invitationRepository.listPendingForProject(projectId)` returns pending rows
- `accept_invitation(p_token text)` Postgres function returns `(project_id uuid, role text)` via RPC

Existing API patterns (read api/auth.ts and api/stripe.ts first):
- Vercel functions export default `async function handler(req, res)`
- CSRF middleware wraps POST endpoints (from Phase 1)
- Use `createAuthenticatedClientFromLocalStorage()` pattern OR the service-role client via env — NEVER `supabase.auth.getSession()` in accept flow (deadlock risk per MEMORY.md)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement /api/invitations create + lookup + accept + token util</name>
  <read_first>
    - api/auth.ts (handler shape, CSRF wrap, error response shape)
    - api/_lib/ (list existing utility modules, follow naming)
    - src/lib/repositories/invitationRepository.ts (from plan 01)
    - .planning/phases/05-real-time-collaboration/05-RESEARCH.md §"Invitation accept" and §"Common Pitfalls 6 and 7"
    - api/__tests__/invitations.create.test.ts and api/__tests__/invitations.accept.test.ts (stubs from plan 01 — replace describe.skip with real tests)
  </read_first>
  <files>
    api/invitations/create.ts,
    api/invitations/accept.ts,
    api/invitations/lookup.ts,
    api/_lib/invitationTokens.ts,
    api/__tests__/invitations.create.test.ts,
    api/__tests__/invitations.accept.test.ts
  </files>
  <behavior>
    invitationTokens.ts exports:
    - `generateToken(): string` — returns `crypto.randomUUID()`
    - `hashToken(raw: string): string` — returns `crypto.createHash('sha256').update(raw).digest('hex')`

    POST /api/invitations (create.ts):
    - Requires authenticated user (extract userId from session cookie via existing helper)
    - Body: `{ projectId: string, email: string, role: 'viewer' | 'editor' }`
    - Validates email via `validator.isEmail`, rejects with 400 if invalid
    - Validates caller owns the project (SELECT projects where id=projectId and user_id=caller) — 403 if not
    - Generates token, hashes it, expiresAt = now + 7 days
    - Calls `invitationRepository.createInvitation(...)` with service-role client
    - Returns `{ inviteUrl: '${APP_URL}/invite#token=${raw}', expiresAt }` (raw token in URL fragment per research)
    - Does NOT send email (email send handled client-side via existing EmailJS per D-08; endpoint returns the URL)
    - On duplicate email for same project: returns 200 with existing invite (idempotent) — do not leak existence to unauthed caller

    GET /api/invitations/lookup?token=... (lookup.ts):
    - Hashes query token, selects row where token_hash matches and not expired and not accepted
    - Returns `{ projectId, projectName, role, inviterName }` OR 404 `{ error: 'invalid_or_expired' }`
    - Does NOT require auth (pre-signup preview)

    POST /api/invitations/accept (accept.ts):
    - Requires authenticated user (caller must be signed in — the newly created account)
    - Body: `{ token: string }`
    - Creates authenticated supabase client using lock-free localStorage token read (per MEMORY.md feedback_supabase_auth_deadlock)
    - Calls `supabase.rpc('accept_invitation', { p_token: token })`
    - Returns `{ projectId, role }` on success, 400 `{ error: 'invalid_or_expired' }` on RPC failure
    - NEVER directly writes to project_collaborators — the RPC is the only path

    Test files:
    - invitations.create.test.ts: (a) valid body → 200 with inviteUrl; (b) invalid email → 400; (c) not project owner → 403; (d) missing body fields → 400
    - invitations.accept.test.ts: (a) valid token → 200 with projectId+role; (b) expired token (mock RPC throws) → 400; (c) missing auth → 401
  </behavior>
  <action>
    Create `api/_lib/invitationTokens.ts` with the two functions above using Node's built-in `crypto` module (no new dep).

    Create the three route files under `api/invitations/`. Use the exact handler shape, CSRF wrapping, and error-response format from `api/auth.ts` (read it first). For service-role access in create.ts, import the existing service-role Supabase client factory (search for `SUPABASE_SERVICE_ROLE_KEY` usage in `api/_lib/` to find the right import — do NOT create a new client).

    For accept.ts, create the authenticated client using the lock-free pattern: read the token from `localStorage.getItem('sb-...-auth-token')` via a server-side helper that accepts the token from the request's Authorization header (frontend sends it). Do NOT call `supabase.auth.getSession()` on either side — it deadlocks.

    The inviteUrl format MUST use a URL fragment (`#token=...`) not query string — query strings leak into server logs (RESEARCH anti-pattern).

    Replace the `describe.skip` stubs in `api/__tests__/invitations.create.test.ts` and `api/__tests__/invitations.accept.test.ts` with real vitest suites. Mock the repository module and the supabase client. Cover all cases listed in <behavior>.
  </action>
  <verify>
    <automated>npx vitest run api/__tests__/invitations.create.test.ts api/__tests__/invitations.accept.test.ts</automated>
  </verify>
  <done>All test cases pass (7+ tests). Grep confirms: no `getSession()` in accept.ts, `#token=` fragment in create.ts response, `createHash('sha256')` in invitationTokens.ts. CSRF middleware wraps both POST routes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Wire InviteCollaboratorModal + add RolePicker + InvitationAcceptPage</name>
  <read_first>
    - src/components/InviteCollaboratorModal.tsx (all 310 lines — understand existing local state + form before modifying)
    - src/App.tsx (current hash-route handling to understand where to add /invite handler)
    - src/components/auth/AuthScreen.tsx (signup/login flow to know what state to pass through)
    - .planning/phases/05-real-time-collaboration/05-UI-SPEC.md §"Copywriting Contract" and §"Interaction Contracts › Invitation modal"
    - .planning/phases/05-real-time-collaboration/05-RESEARCH.md §"Common Pitfalls 6 and 7"
  </read_first>
  <files>
    src/components/RolePicker.tsx,
    src/components/InviteCollaboratorModal.tsx,
    src/pages/InvitationAcceptPage.tsx,
    src/App.tsx
  </files>
  <behavior>
    RolePicker.tsx:
    - Segmented control with two options: "Viewer" and "Editor"
    - Props: `{ value: 'viewer' | 'editor'; onChange: (v) => void; disabled?: boolean }`
    - Default Editor (per UI-SPEC)
    - Uses graphite/canvas tokens only, selected pill gets brand.primary background with white text, unselected gets graphite.100
    - `aria-pressed` on each button, keyboard-navigable (arrow keys or tab)

    InviteCollaboratorModal.tsx wiring (modify existing):
    - Replace local-only submit handler with real `fetch('/api/invitations', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() }, body: JSON.stringify({ projectId, email, role }) })`
    - Add RolePicker between email input and Send invite button
    - On 200: show inline confirmation "Invite sent to {email}", clear email field, keep modal open (UI-SPEC: batch invites)
    - On 4xx: show UI-SPEC copy "Couldn't send invite. Check the email address and try again."
    - Use existing EmailJS client send with the returned inviteUrl as template variable (reuse existing EmailJS call in the modal — do not duplicate)
    - Button copy: "Send invite" (UI-SPEC exact)
    - Show inline spinner on button during request (not full-page loader)

    InvitationAcceptPage.tsx:
    - Mounts when hash matches `#token=...` on route `/invite`
    - Step 1: parse token from `window.location.hash`
    - Step 2: GET `/api/invitations/lookup?token=...` to preview project name and role
    - Step 3: if user is not authenticated (check existing auth context), render "Sign up or log in to join {projectName} as {role}" with signup/login form (reuse existing AuthScreen or handoff)
    - Step 4: after auth, POST `/api/invitations/accept` with the token
    - Step 5: on success, navigate to `/projects/{projectId}` and show "Joined {projectName}" toast
    - Error states use UI-SPEC copy: "This invite link is no longer valid. Ask the project owner for a new one."
    - NEVER calls `supabase.auth.getSession()` — use the same lock-free token read pattern as `useAuth.ts`

    App.tsx: add hash route detection for `/invite` → renders `<InvitationAcceptPage />` before main app bootstrap.
  </behavior>
  <action>
    Build RolePicker first — pure component, no side effects. Use Tailwind classes from `tailwind.config.js` Animated Lux tokens. `flex` row, `rounded-md` border, two `<button>` children.

    Modify InviteCollaboratorModal: locate the current submit handler, replace with the fetch call described. Locate the EmailJS send call (search for `emailjs.send` in the file) and adjust the template params to include `inviteUrl` from the API response. Keep the existing success/error UI hooks; just change the data source.

    Create InvitationAcceptPage as a new page component. For auth-state reading, use the existing `useAuth()` hook (do not create a new auth path). Handoff to signup: if `user` is null, render `<AuthScreen initialMode="signup" onSuccess={() => retryAccept()} />` or equivalent — read AuthScreen.tsx to find the actual prop shape.

    In App.tsx, find the current hash-handling block (the same place `#demo` and `#join` are detected) and add:
    ```
    if (window.location.pathname === '/invite' || window.location.hash.startsWith('#token=')) {
      return <InvitationAcceptPage />;
    }
    ```

    This is a checkpoint task because the end-to-end flow (invite → email → click → signup → join) requires a real human to verify. After implementation, pause for manual verification.
  </action>
  <what-built>
    - RolePicker component with Viewer/Editor toggle
    - InviteCollaboratorModal now calls real /api/invitations and shows success/error states
    - InvitationAcceptPage handles #token= landing, signup handoff, and RPC call
    - App.tsx routes /invite to the accept page
  </what-built>
  <how-to-verify>
    1. Run `npm run dev` and open a project you own in browser A
    2. Open InviteCollaboratorModal, enter a fresh email + select Editor, click "Send invite"
    3. Expect: inline success "Invite sent to {email}", form clears, modal stays open
    4. Open DevTools Network → confirm POST /api/invitations returned 200 with inviteUrl
    5. In browser B (incognito) open the inviteUrl
    6. Expect: InvitationAcceptPage shows project name and role "Editor"
    7. Sign up with the invited email; after signup expect redirect to the project
    8. Expect: new user can create ideas (editor perms) — confirm no "permission denied" toast
    9. Try the same inviteUrl again in browser C → expect "This invite link is no longer valid."
    10. Verify in Supabase Studio: project_collaborators has a new row with role='editor'
  </how-to-verify>
  <resume-signal>Type "approved" if all 10 steps pass, otherwise describe failures.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api/invitations | CSRF-protected POST, auth cookie required |
| invited user → accept_invitation RPC | Runs under the newly-authenticated user's JWT |
| URL fragment → InvitationAcceptPage | Token lives only in fragment, never query string |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-08 | Spoofing | /api/invitations/create | mitigate | CSRF middleware (Phase 1) + auth cookie check + project ownership verification before DB write |
| T-05-09 | Information Disclosure | lookup endpoint | mitigate | Returns only projectName/role/inviterName; never echoes email or other invites; constant response shape on invalid token |
| T-05-10 | Tampering | accept flow race | mitigate | accept_invitation() SECURITY DEFINER function is atomic; no direct writes to project_collaborators from API |
| T-05-11 | Replay | single-use token | mitigate | Function sets accepted_at on success; subsequent calls fail the `accepted_at is null` check |
| T-05-12 | Information Disclosure | token in URL | mitigate | URL fragment (#token=) never sent to server logs; lookup uses POST body? No — lookup uses GET query but that's the read-only preview, acceptable since hash compare still required |
| T-05-13 | DoS | Auth getSession deadlock | mitigate | Accept page uses lock-free localStorage token read (MEMORY.md pattern), never calls getSession() |
| T-05-14 | Elevation | Viewer/editor role tamper | mitigate | Role stored in DB at invite creation by owner only; RLS on project_collaborators rejects non-owner role writes |
</threat_model>

<verification>
- `npx vitest run api/__tests__/invitations.*.test.ts` all green
- Manual 10-step verification in Task 2 passes
- grep: no `getSession()` in api/invitations/ or src/pages/InvitationAcceptPage.tsx
- grep: `X-CSRF-Token` header present in InviteCollaboratorModal fetch call
</verification>

<success_criteria>
- Project owner can invite a user by email with a chosen role
- Invited user can open the link, sign up, and land in the project with the right role
- Expired/reused tokens fail with UI-SPEC copy
- No regressions in existing auth or modal behavior
</success_criteria>

<output>
After completion, create `.planning/phases/05-real-time-collaboration/05-02-SUMMARY.md` documenting the three API routes, the hash-route change in App.tsx, and any deviations from plan.
</output>
