/**
 * Project Realtime Matrix — E2E Tests
 * Phase 05.4b Wave 3, Unit 3.6
 *
 * Tests T-054B-300..305 (6 tests)
 *
 * PREREQUISITE: These tests require a running dev server (`npm run dev`) and
 * an active Supabase project with Realtime enabled. They also require two test
 * user accounts configured in the environment.
 *
 * All tests are skipped (test.skip) because the CI environment does not have
 * a live Supabase connection or two-user test fixtures set up. To run locally:
 *   1. Start dev server: npm run dev
 *   2. Configure E2E_USER_A_EMAIL, E2E_USER_A_PASSWORD,
 *      E2E_USER_B_EMAIL, E2E_USER_B_PASSWORD, E2E_PROJECT_URL in .env.test
 *   3. Remove the test.skip calls and run: npx playwright test tests/e2e/project-realtime-matrix.spec.ts
 *
 * Test structure is complete and production-ready — only the skip guards
 * need removal when the environment is available.
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Environment config — must be set for live runs
// ---------------------------------------------------------------------------

const SKIP_LIVE = !process.env['CI_SUPABASE'];

const USER_A_EMAIL = process.env['E2E_USER_A_EMAIL'] ?? 'user-a@example.com'
const USER_A_PASSWORD = process.env['E2E_USER_A_PASSWORD'] ?? 'password-a'
const USER_B_EMAIL = process.env['E2E_USER_B_EMAIL'] ?? 'user-b@example.com'
const USER_B_PASSWORD = process.env['E2E_USER_B_PASSWORD'] ?? 'password-b'
const PROJECT_URL = process.env['E2E_PROJECT_URL'] ?? 'http://localhost:3003/?project=test-project-id'
const MATRIX_FULLSCREEN_SELECTOR = '[data-testid="fullscreen-view"]'
const PRESENCE_STACK_SELECTOR = '[data-testid="project-presence-stack"]'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('http://localhost:3003/')
  await page.waitForSelector('[data-testid="auth-submit-button"]', { timeout: 10_000 })
  await page.fill('[type="email"]', email)
  await page.fill('[type="password"]', password)
  await page.click('[data-testid="auth-submit-button"]')
  await page.waitForSelector('[data-testid="auth-submit-button"]', {
    state: 'detached',
    timeout: 20_000
  })
  await page.waitForSelector('#main-content', { timeout: 10_000 })
}

async function enterFullscreenMatrix(page: Page): Promise<void> {
  await page.goto(PROJECT_URL)
  await page.waitForSelector('[data-testid="enter-fullscreen"]', { timeout: 10_000 })
  await page.click('[data-testid="enter-fullscreen"]')
  await page.waitForSelector(MATRIX_FULLSCREEN_SELECTOR, { timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// T-054B-300: Two browsers see each other in presence stack
// ---------------------------------------------------------------------------

test('T-054B-300: two browsers see each other in presence stack', async ({ browser }: { browser: Browser }) => {
  test.skip(SKIP_LIVE, 'Requires live Supabase (set CI_SUPABASE=true)');
  // Arrange: two browser contexts, each signed in as different users
  const ctxA: BrowserContext = await browser.newContext()
  const ctxB: BrowserContext = await browser.newContext()
  const pageA: Page = await ctxA.newPage()
  const pageB: Page = await ctxB.newPage()

  try {
    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD)
    await signIn(pageB, USER_B_EMAIL, USER_B_PASSWORD)

    await enterFullscreenMatrix(pageA)
    await enterFullscreenMatrix(pageB)

    // Assert: both avatars visible in both viewports within 5s
    await expect(
      pageA.locator(PRESENCE_STACK_SELECTOR).locator('[data-testid^="presence-avatar-"]')
    ).toHaveCount(2, { timeout: 5_000 })

    await expect(
      pageB.locator(PRESENCE_STACK_SELECTOR).locator('[data-testid^="presence-avatar-"]')
    ).toHaveCount(2, { timeout: 5_000 })
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})

// ---------------------------------------------------------------------------
// T-054B-301: Cursor appears in browser B when A moves mouse
// ---------------------------------------------------------------------------

test('T-054B-301: cursor appears in browser B when A moves mouse', async ({ browser }: { browser: Browser }) => {
  test.skip(SKIP_LIVE, 'Requires live Supabase (set CI_SUPABASE=true)');
  const ctxA: BrowserContext = await browser.newContext()
  const ctxB: BrowserContext = await browser.newContext()
  const pageA: Page = await ctxA.newPage()
  const pageB: Page = await ctxB.newPage()

  try {
    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD)
    await signIn(pageB, USER_B_EMAIL, USER_B_PASSWORD)
    await enterFullscreenMatrix(pageA)
    await enterFullscreenMatrix(pageB)

    // Act: move mouse across matrix canvas in browser A
    const matrixA = pageA.locator('[data-testid="design-matrix"]')
    const box = await matrixA.boundingBox()
    if (!box) throw new Error('Matrix canvas not found')

    await pageA.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3)
    await pageA.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await pageA.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4)

    // Assert: browser B sees exactly one live cursor for user A within 3s
    await expect(
      pageB.locator('[data-testid^="live-cursor-"]')
    ).toHaveCount(1, { timeout: 3_000 })
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})

// ---------------------------------------------------------------------------
// T-054B-302: Drag starts lock overlay in browser B
// ---------------------------------------------------------------------------

test('T-054B-302: drag starts lock overlay in browser B', async ({ browser }: { browser: Browser }) => {
  test.skip(SKIP_LIVE, 'Requires live Supabase (set CI_SUPABASE=true)');
  const ctxA: BrowserContext = await browser.newContext()
  const ctxB: BrowserContext = await browser.newContext()
  const pageA: Page = await ctxA.newPage()
  const pageB: Page = await ctxB.newPage()

  try {
    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD)
    await signIn(pageB, USER_B_EMAIL, USER_B_PASSWORD)
    await enterFullscreenMatrix(pageA)
    await enterFullscreenMatrix(pageB)

    // Get first idea card in browser A
    const firstCard = pageA.locator('[data-testid^="idea-card-"]').first()
    const ideaId = (await firstCard.getAttribute('data-testid'))?.replace('idea-card-', '')
    if (!ideaId) throw new Error('No idea cards found')

    const cardBox = await firstCard.boundingBox()
    if (!cardBox) throw new Error('Card bounding box not found')

    // Act: begin drag in browser A (don't release)
    await pageA.mouse.move(
      cardBox.x + cardBox.width / 2,
      cardBox.y + cardBox.height / 2
    )
    await pageA.mouse.down()
    await pageA.mouse.move(
      cardBox.x + cardBox.width / 2 + 20,
      cardBox.y + cardBox.height / 2 + 20,
      { steps: 5 }
    )

    // Assert: browser B sees lock overlay for that card
    await expect(
      pageB.locator(`[data-testid="locked-card-overlay-${ideaId}"]`)
    ).toBeVisible({ timeout: 3_000 })

    // Cleanup: release drag
    await pageA.mouse.up()
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})

// ---------------------------------------------------------------------------
// T-054B-303: Drop propagates position in browser B within 2s
// ---------------------------------------------------------------------------

test('T-054B-303: drop propagates position in browser B within 2s', async ({ browser }: { browser: Browser }) => {
  test.skip(SKIP_LIVE, 'Requires live Supabase (set CI_SUPABASE=true)');
  const ctxA: BrowserContext = await browser.newContext()
  const ctxB: BrowserContext = await browser.newContext()
  const pageA: Page = await ctxA.newPage()
  const pageB: Page = await ctxB.newPage()

  try {
    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD)
    await signIn(pageB, USER_B_EMAIL, USER_B_PASSWORD)
    await enterFullscreenMatrix(pageA)
    await enterFullscreenMatrix(pageB)

    const firstCard = pageA.locator('[data-testid^="idea-card-"]').first()
    const ideaId = (await firstCard.getAttribute('data-testid'))?.replace('idea-card-', '')
    if (!ideaId) throw new Error('No idea cards found')

    // Record initial position in browser B
    const cardInB = pageB.locator(`[data-testid="idea-card-${ideaId}"]`)
    const initialLeft = await cardInB.evaluate((el) => (el as HTMLElement).style.left)

    // Act: drag card to new position in browser A
    const matrixA = pageA.locator('[data-testid="design-matrix"]')
    const matrixBox = await matrixA.boundingBox()
    if (!matrixBox) throw new Error('Matrix not found')

    const cardBox = await firstCard.boundingBox()
    if (!cardBox) throw new Error('Card not found')

    await firstCard.dragTo(matrixA, {
      targetPosition: {
        x: matrixBox.width * 0.7,
        y: matrixBox.height * 0.3,
      },
    })

    // Assert: position in browser B updates within 2s
    await expect(async () => {
      const newLeft = await cardInB.evaluate((el) => (el as HTMLElement).style.left)
      expect(newLeft).not.toBe(initialLeft)
    }).toPass({ timeout: 2_000 })
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})

// ---------------------------------------------------------------------------
// T-054B-304: Disconnect shows reconnecting badge
// ---------------------------------------------------------------------------

test('T-054B-304: disconnect shows reconnecting badge (Playwright route block)', async ({ browser }: { browser: Browser }) => {
  test.skip(SKIP_LIVE, 'Requires live Supabase (set CI_SUPABASE=true)');
  const ctxA: BrowserContext = await browser.newContext()
  const pageA: Page = await ctxA.newPage()

  try {
    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD)
    await enterFullscreenMatrix(pageA)

    // Block WebSocket connections to simulate disconnect
    await pageA.route('wss://**', (route) => route.abort())
    await pageA.route('ws://**', (route) => route.abort())

    // Assert: reconnecting badge appears within 1.5s of silence
    await expect(
      pageA.getByRole('status', { name: /Reconnecting/i })
    ).toBeVisible({ timeout: 3_000 })
  } finally {
    await pageA.unroute('wss://**')
    await pageA.unroute('ws://**')
    await ctxA.close()
  }
})

// ---------------------------------------------------------------------------
// T-054B-305: Reconnect shows recovery toast
// ---------------------------------------------------------------------------

test('T-054B-305: reconnect shows recovery toast', async ({ browser }: { browser: Browser }) => {
  test.skip(SKIP_LIVE, 'Requires live Supabase (set CI_SUPABASE=true)');
  const ctxA: BrowserContext = await browser.newContext()
  const pageA: Page = await ctxA.newPage()

  try {
    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD)
    await enterFullscreenMatrix(pageA)

    // Block then restore WebSocket to simulate reconnect
    await pageA.route('wss://**', (route) => route.abort())
    await pageA.route('ws://**', (route) => route.abort())

    // Wait for reconnecting badge
    await expect(
      pageA.getByRole('status', { name: /Reconnecting/i })
    ).toBeVisible({ timeout: 3_000 })

    // Restore WebSocket connections
    await pageA.unroute('wss://**')
    await pageA.unroute('ws://**')

    // Assert: recovery toast appears within 5s
    await expect(
      pageA.getByRole('status', { name: /Back online/i })
    ).toBeVisible({ timeout: 5_000 })
  } finally {
    await ctxA.close()
  }
})
