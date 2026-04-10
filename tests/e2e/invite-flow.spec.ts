/**
 * Invite Flow — E2E Tests
 * Phase 05.5 Quality Debt Closure
 *
 * Tests the end-to-end invitation flow:
 *   Owner invites collaborator → collaborator accepts → collaborator sees the project.
 *
 * PREREQUISITES (all required before removing test.skip):
 *   1. Dev server running: npm run dev
 *   2. Live Supabase project with:
 *      - `project_invitations` table (Phase 05.3 migration applied)
 *      - `project_collaborators` table (Phase 05.3 migration applied)
 *      - `accept_invitation` RPC (Phase 05.3 migration applied)
 *      - Email delivery configured OR `SKIP_EMAIL=true` env var set
 *   3. Two test user accounts configured in environment:
 *      E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD  — project owner
 *      E2E_INVITEE_EMAIL, E2E_INVITEE_PASSWORD — collaborator to be invited
 *   4. A project owned by the owner user:
 *      E2E_PROJECT_ID — UUID of the test project
 *   5. Remove test.skip from each test case
 *
 * To run locally once prerequisites are met:
 *   npx playwright test tests/e2e/invite-flow.spec.ts
 *
 * Reference: Phase 05.3 manual 7-step verification flow.
 * Template: tests/e2e/project-realtime-matrix.spec.ts (two-browser pattern).
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Environment config — must be set for live runs
// ---------------------------------------------------------------------------

const SKIP_LIVE = !process.env['CI_SUPABASE'];

const OWNER_EMAIL = process.env['E2E_OWNER_EMAIL'] ?? 'owner@example.com'
const OWNER_PASSWORD = process.env['E2E_OWNER_PASSWORD'] ?? 'password-owner'
const INVITEE_EMAIL = process.env['E2E_INVITEE_EMAIL'] ?? 'invitee@example.com'
const INVITEE_PASSWORD = process.env['E2E_INVITEE_PASSWORD'] ?? 'password-invitee'
const PROJECT_ID = process.env['E2E_PROJECT_ID'] ?? 'test-project-id'
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3003'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/`)
  await page.waitForSelector('[type="email"]', { timeout: 10_000 })
  await page.fill('[type="email"]', email)
  await page.fill('[type="password"]', password)
  await page.click('[type="submit"]')
  // Wait for redirect away from the auth screen
  await page.waitForFunction(
    () => !document.querySelector('[type="submit"]') || document.querySelector('[data-testid="main-app"]'),
    { timeout: 15_000 }
  )
}

async function signUp(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/`)
  await page.waitForSelector('[type="email"]', { timeout: 10_000 })
  // Switch to sign-up mode if a toggle exists
  const signUpButton = page.getByRole('button', { name: /sign up/i })
  if (await signUpButton.isVisible()) {
    await signUpButton.click()
  }
  await page.fill('[type="email"]', email)
  await page.fill('[type="password"]', password)
  await page.click('[type="submit"]')
  await page.waitForFunction(
    () => !document.querySelector('[type="submit"]') || document.querySelector('[data-testid="main-app"]'),
    { timeout: 15_000 }
  )
}

async function navigateToProject(page: Page, projectId: string): Promise<void> {
  await page.goto(`${BASE_URL}/?project=${projectId}`)
  await page.waitForLoadState('networkidle', { timeout: 15_000 })
}

async function getAuthHeadersFromPage(page: Page): Promise<{ Authorization: string }> {
  const token = await page.evaluate(() => {
    try {
      const key = Object.keys(localStorage).find((k) => k.startsWith('sb-'))
      if (!key) return ''
      const parsed = JSON.parse(localStorage.getItem(key) ?? '{}')
      return parsed?.access_token ?? ''
    } catch {
      return ''
    }
  })
  return { Authorization: `Bearer ${token}` }
}

// ---------------------------------------------------------------------------
// T-055-100: Owner can send an invitation
// ---------------------------------------------------------------------------

test('T-055-100: owner sends invitation and receives inviteUrl', async ({ browser }: { browser: Browser }) => {
  test.skip(SKIP_LIVE, 'Requires live Supabase (set CI_SUPABASE=true)');
  // Step 1: Owner signs in
  const ownerCtx: BrowserContext = await browser.newContext()
  const ownerPage: Page = await ownerCtx.newPage()

  try {
    await signIn(ownerPage, OWNER_EMAIL, OWNER_PASSWORD)
    await navigateToProject(ownerPage, PROJECT_ID)

    // Step 2: Owner opens the invite modal
    const inviteButton = ownerPage.getByRole('button', { name: /invite/i })
    await expect(inviteButton).toBeVisible({ timeout: 10_000 })
    await inviteButton.click()

    // Step 3: Owner enters invitee email and submits
    await ownerPage.fill('[id="invite-email"]', INVITEE_EMAIL)
    // Select editor role (default)
    const sendButton = ownerPage.getByRole('button', { name: /send invite/i })
    await expect(sendButton).toBeVisible({ timeout: 5_000 })
    await sendButton.click()

    // Step 4: Assert success feedback appears
    const successText = ownerPage.getByText(new RegExp(`Invite sent to ${INVITEE_EMAIL}`, 'i'))
    await expect(successText).toBeVisible({ timeout: 10_000 })
  } finally {
    await ownerCtx.close()
  }
})

// ---------------------------------------------------------------------------
// T-055-101: Invitee accepts via invite URL and sees the project
// ---------------------------------------------------------------------------

test('T-055-101: invitee accepts invitation via URL and sees project in list', async ({ browser }: { browser: Browser }) => {
  test.skip(SKIP_LIVE, 'Requires live Supabase (set CI_SUPABASE=true)');
  // This test requires the invite URL from the API response.
  // In a live run, obtain it by intercepting the network response from
  // POST /api/invitations/create, or by querying the database directly.
  //
  // Pattern: owner creates invite via API, extracts inviteUrl, invitee opens it.

  const ownerCtx: BrowserContext = await browser.newContext()
  const inviteeCtx: BrowserContext = await browser.newContext()
  const ownerPage: Page = await ownerCtx.newPage()
  const inviteePage: Page = await inviteeCtx.newPage()

  let inviteUrl: string | null = null

  try {
    // --- Owner: sign in and create invitation via API ---
    await signIn(ownerPage, OWNER_EMAIL, OWNER_PASSWORD)
    const headers = await getAuthHeadersFromPage(ownerPage)

    // Get CSRF token from cookie
    const cookies = await ownerCtx.cookies()
    const csrfCookie = cookies.find((c) => c.name === 'csrf_token')
    const csrfHeader = csrfCookie ? { 'X-CSRF-Token': csrfCookie.value } : {}

    // POST to create invitation, capture inviteUrl from response
    const createResponse = await ownerPage.evaluate(
      async ({ projectId, email, headersJson, csrfJson }) => {
        const authHeaders = JSON.parse(headersJson) as Record<string, string>
        const csrfHeaders = JSON.parse(csrfJson) as Record<string, string>
        const res = await fetch('/api/invitations/create', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
            ...csrfHeaders,
          },
          body: JSON.stringify({ projectId, email, role: 'editor' }),
        })
        return res.ok ? res.json() : null
      },
      {
        projectId: PROJECT_ID,
        email: INVITEE_EMAIL,
        headersJson: JSON.stringify(headers),
        csrfJson: JSON.stringify(csrfHeader),
      }
    )

    expect(createResponse).not.toBeNull()
    expect(createResponse.inviteUrl).toBeTruthy()
    inviteUrl = createResponse.inviteUrl as string

    // --- Invitee: open invite URL ---
    // The invite URL format is: {base}/invite#token={rawToken}
    await inviteePage.goto(inviteUrl)
    await inviteePage.waitForLoadState('domcontentloaded')

    // Step 5: Invitee signs up / signs in if not already authenticated
    // The InvitationAcceptPage renders AuthScreen when not authenticated.
    const authForm = inviteePage.locator('[type="email"]')
    if (await authForm.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await signUp(inviteePage, INVITEE_EMAIL, INVITEE_PASSWORD)
      // After auth, the page auto-accepts the invitation and redirects.
    }

    // Step 6: Wait for redirect to the project (InvitationAcceptPage redirects to /?project=<id>)
    await inviteePage.waitForURL(new RegExp(`project=${PROJECT_ID}`), { timeout: 15_000 })

    // Step 7: Assert invitee sees the project
    await inviteePage.waitForLoadState('networkidle')
    // The project name should appear somewhere in the UI
    const projectContent = inviteePage.getByText(/project/i)
    await expect(projectContent).toBeVisible({ timeout: 10_000 })
  } finally {
    await ownerCtx.close()
    await inviteeCtx.close()
  }
})

// ---------------------------------------------------------------------------
// T-055-102: Expired/invalid invite URL shows error state
// ---------------------------------------------------------------------------

test('T-055-102: expired or invalid invite token shows unavailable state', async ({ page }: { page: Page }) => {
  test.skip(SKIP_LIVE, 'Requires live Supabase (set CI_SUPABASE=true)');
  // Use a well-formed but non-existent token to hit the invalid state.
  const fakeToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  await page.goto(`${BASE_URL}/invite#token=${fakeToken}`)
  await page.waitForLoadState('domcontentloaded')

  // InvitationAcceptPage shows "Invitation unavailable" for invalid tokens.
  const errorHeading = page.getByText(/invitation unavailable/i)
  await expect(errorHeading).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// T-055-103: Accept endpoint requires authentication
// ---------------------------------------------------------------------------

test('T-055-103: POST /api/invitations/accept returns 401 without auth token', async ({ page }: { page: Page }) => {
  test.skip(SKIP_LIVE, 'Requires live Supabase (set CI_SUPABASE=true)');
  await page.goto(`${BASE_URL}/`)

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'fake-token' }),
    })
    return { status: res.status, body: await res.json() }
  })

  expect(response.status).toBe(401)
  expect(response.body.error?.code ?? response.body.error).toMatch(/UNAUTHORIZED/i)
})
