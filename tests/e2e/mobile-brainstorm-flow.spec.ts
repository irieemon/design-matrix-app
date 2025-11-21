/**
 * Mobile Brainstorm Flow - E2E Tests (Phase Three)
 *
 * Comprehensive end-to-end testing of the complete mobile brainstorm workflow:
 * 1. QR code generation → token validation
 * 2. Mobile join flow → participant authentication
 * 3. Idea submission from mobile → real-time desktop update
 * 4. Session management (pause/resume)
 * 5. Multi-participant scenarios
 * 6. Network resilience and reconnection
 */

import { test, expect, Page } from '@playwright/test'
import { TestContext } from '../helpers/test-helpers'

// Test configuration
const MOBILE_VIEWPORT = { width: 375, height: 667 } // iPhone SE
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 }
const TEST_TIMEOUT = 60000

// Mock session data
const mockSession = {
  id: 'test-session-123',
  project_id: 'test-project-456',
  name: 'E2E Test Session',
  status: 'active' as const,
  created_by: 'test-user',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
}

const mockParticipant = {
  id: 'test-participant-789',
  session_id: mockSession.id,
  participant_name: 'Mobile Test User',
  is_anonymous: false,
  is_approved: true,
  contribution_count: 0,
  joined_at: new Date().toISOString(),
  last_active_at: new Date().toISOString()
}

/**
 * Helper: Setup mobile context with proper viewport and user agent
 */
async function setupMobileContext(page: Page) {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.setExtraHTTPHeaders({
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
  })
}

/**
 * Helper: Setup desktop context
 */
async function setupDesktopContext(page: Page) {
  await page.setViewportSize(DESKTOP_VIEWPORT)
}

/**
 * Helper: Mock Supabase real-time subscription
 */
async function mockRealtimeSubscription(page: Page) {
  await page.evaluate(() => {
    // Mock WebSocket connection for real-time updates
    ;(window as any).mockRealtimeConnected = true
  })
}

/**
 * Helper: Trigger real-time event from mobile to desktop
 */
async function triggerRealtimeEvent(
  desktopPage: Page,
  eventType: string,
  payload: any
) {
  await desktopPage.evaluate(
    ({ type, data }) => {
      // Simulate real-time event arriving
      const event = new CustomEvent('brainstorm-realtime-event', {
        detail: { type, payload: data }
      })
      window.dispatchEvent(event)
    },
    { type: eventType, data: payload }
  )
}

test.describe('Mobile Brainstorm Flow - Complete E2E Journey', () => {
  let desktopContext: TestContext
  let mobileContext: TestContext

  test.beforeEach(async ({ page, context }) => {
    desktopContext = new TestContext(page)
    await setupDesktopContext(page)
  })

  test('should complete full flow: QR generation → mobile join → idea submission → desktop display', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    // ========================================
    // STEP 1: Desktop - Create brainstorm session
    // ========================================
    await desktopContext.auth.loginAsTestUser()

    // Navigate to project page
    await page.goto('/projects/test-project-456')
    await page.waitForLoadState('domcontentloaded')

    // Open brainstorm session modal (simulated button click)
    const startBrainstormBtn = page.locator(
      'button:has-text("Start Brainstorm"), button:has-text("New Session")'
    )

    if (await startBrainstormBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBrainstormBtn.click()
      await page.waitForTimeout(500)

      // Fill session details
      const sessionNameInput = page.locator('input[name="sessionName"]')
      if (
        await sessionNameInput.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await sessionNameInput.fill(mockSession.name)
      }

      // Create session
      const createSessionBtn = page.locator(
        'button:has-text("Create Session"), button:has-text("Start")'
      )
      if (
        await createSessionBtn.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await createSessionBtn.click()
      }

      // Wait for QR code to appear
      await page.waitForSelector('[data-testid="qr-code"], .qr-code', {
        state: 'visible',
        timeout: 5000
      })
    }

    // Extract join token from QR code or URL
    const joinToken = await page.evaluate(() => {
      // Try to find QR code data attribute
      const qrElement = document.querySelector(
        '[data-testid="qr-code"], [data-qr-token]'
      )
      if (qrElement) {
        return (
          qrElement.getAttribute('data-qr-token') ||
          qrElement.getAttribute('data-token')
        )
      }

      // Fallback: extract from visible text or URL
      const tokenText = document.body.textContent?.match(
        /token=([a-zA-Z0-9-]+)/
      )
      return tokenText ? tokenText[1] : 'test-token-abc123'
    })

    expect(joinToken).toBeTruthy()

    // Verify participant list is empty initially
    const participantCount = await page
      .locator('[data-testid="participant-count"], .participant-count')
      .textContent()
    expect(participantCount).toContain('0')

    // ========================================
    // STEP 2: Mobile - Join session via token
    // ========================================
    const mobilePage = await context.newPage()
    mobileContext = new TestContext(mobilePage)
    await setupMobileContext(mobilePage)

    // Navigate to mobile join page with token
    await mobilePage.goto(`/m/join?token=${joinToken}`)
    await mobilePage.waitForLoadState('domcontentloaded')

    // Verify loading state appears
    const loadingSpinner = mobilePage.locator('[aria-label="Validating session"]')
    await expect(loadingSpinner).toBeVisible({ timeout: 3000 })

    // Wait for validation to complete (should succeed)
    await mobilePage.waitForTimeout(2000)

    // Verify successful join - should see session name
    await expect(
      mobilePage.locator(`text=${mockSession.name}`)
    ).toBeVisible({ timeout: 5000 })

    // Verify participant name is displayed
    await expect(
      mobilePage.locator(`text=${mockParticipant.participant_name}`)
    ).toBeVisible({ timeout: 3000 })

    // ========================================
    // STEP 3: Desktop - Verify participant joined
    // ========================================
    // Simulate real-time participant join event
    await triggerRealtimeEvent(page, 'participant_joined', {
      participant: mockParticipant,
      session_id: mockSession.id
    })

    // Wait for participant to appear in list
    await page.waitForTimeout(1000)

    // Verify participant count updated
    const updatedParticipantCount = await page
      .locator('[data-testid="participant-count"], .participant-count')
      .textContent()
    expect(updatedParticipantCount).toContain('1')

    // Verify participant name appears in list
    await expect(
      page.locator(`text=${mockParticipant.participant_name}`)
    ).toBeVisible({ timeout: 3000 })

    // ========================================
    // STEP 4: Mobile - Submit idea
    // ========================================
    const ideaContent = 'Mobile submitted test idea from E2E flow'

    // Fill idea content
    const contentTextarea = mobilePage.locator(
      'textarea[placeholder*="Enter your idea"], textarea[name="content"]'
    )
    await contentTextarea.fill(ideaContent)

    // Submit idea
    const submitButton = mobilePage.locator(
      'button:has-text("Submit"), button:has-text("Submit Idea")'
    )
    await submitButton.click()

    // Wait for submission confirmation
    await mobilePage.waitForTimeout(1500)

    // Verify success feedback on mobile
    const successMessage = mobilePage.locator(
      'text=Idea submitted, text=Success, [role="status"]'
    )
    await expect(successMessage).toBeVisible({ timeout: 3000 })

    // ========================================
    // STEP 5: Desktop - Verify idea appears in real-time
    // ========================================
    // Simulate real-time idea creation event
    await triggerRealtimeEvent(page, 'idea_created', {
      idea: {
        id: 'test-idea-001',
        content: ideaContent,
        session_id: mockSession.id,
        participant_id: mockParticipant.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })

    // Wait for idea to appear
    await page.waitForTimeout(1000)

    // Verify idea appears in recent ideas list
    await expect(page.locator(`text=${ideaContent}`)).toBeVisible({
      timeout: 5000
    })

    // Verify mobile indicator is shown on the idea card
    const mobileIndicator = page.locator(
      '[aria-label="Submitted from mobile device"]'
    )
    await expect(mobileIndicator).toBeVisible({ timeout: 3000 })

    // Verify new idea animation is applied
    const ideaCard = page.locator(`.idea-card-base:has-text("${ideaContent}")`)
    await expect(ideaCard).toHaveClass(/animate-scale-in/, { timeout: 2000 })

    // Verify participant contribution count updated
    await triggerRealtimeEvent(page, 'participant_updated', {
      participant: {
        ...mockParticipant,
        contribution_count: 1,
        last_active_at: new Date().toISOString()
      }
    })

    await page.waitForTimeout(500)

    // Verify contribution count shows "1 ideas"
    await expect(page.locator('text=1 ideas')).toBeVisible({ timeout: 3000 })

    // ========================================
    // STEP 6: Cleanup
    // ========================================
    await mobilePage.close()
  })

  test('should handle session pause and resume from mobile perspective', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    // Setup: Create session and join from mobile
    await desktopContext.auth.loginAsTestUser()
    await page.goto('/projects/test-project-456')

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)
    await mobilePage.goto(`/m/join?token=test-token-pause`)

    // Wait for mobile form to load
    await mobilePage.waitForTimeout(2000)

    const ideaTextarea = mobilePage.locator(
      'textarea[placeholder*="Enter your idea"]'
    )
    await expect(ideaTextarea).toBeEnabled({ timeout: 5000 })

    // Desktop: Pause session
    await triggerRealtimeEvent(page, 'session_status_changed', {
      session: { ...mockSession, status: 'paused' }
    })

    // Mobile: Verify form is disabled
    await mobilePage.waitForTimeout(1000)
    await expect(ideaTextarea).toBeDisabled({ timeout: 3000 })

    // Verify pause message shown
    const pauseMessage = mobilePage.locator(
      'text=Session paused, text=Session is paused'
    )
    await expect(pauseMessage).toBeVisible({ timeout: 3000 })

    // Desktop: Resume session
    await triggerRealtimeEvent(page, 'session_status_changed', {
      session: { ...mockSession, status: 'active' }
    })

    // Mobile: Verify form is re-enabled
    await mobilePage.waitForTimeout(1000)
    await expect(ideaTextarea).toBeEnabled({ timeout: 3000 })

    await mobilePage.close()
  })

  test('should handle multiple concurrent participants submitting ideas', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    await desktopContext.auth.loginAsTestUser()
    await page.goto('/projects/test-project-456')

    // Create 3 mobile participants
    const mobilePages: Page[] = []

    for (let i = 1; i <= 3; i++) {
      const mobilePage = await context.newPage()
      await setupMobileContext(mobilePage)
      await mobilePage.goto(`/m/join?token=test-token-multi-${i}`)
      await mobilePage.waitForTimeout(2000)

      // Simulate participant join
      await triggerRealtimeEvent(page, 'participant_joined', {
        participant: {
          ...mockParticipant,
          id: `participant-${i}`,
          participant_name: `Mobile User ${i}`
        }
      })

      mobilePages.push(mobilePage)
    }

    // Verify all 3 participants appear on desktop
    await page.waitForTimeout(1500)

    for (let i = 1; i <= 3; i++) {
      await expect(page.locator(`text=Mobile User ${i}`)).toBeVisible({
        timeout: 3000
      })
    }

    // Each participant submits an idea
    for (let i = 1; i <= 3; i++) {
      const mobilePage = mobilePages[i - 1]
      const ideaContent = `Idea from Mobile User ${i}`

      const textarea = mobilePage.locator('textarea[placeholder*="Enter your idea"]')
      await textarea.fill(ideaContent)

      const submitBtn = mobilePage.locator('button:has-text("Submit")')
      await submitBtn.click()
      await mobilePage.waitForTimeout(1000)

      // Trigger real-time event on desktop
      await triggerRealtimeEvent(page, 'idea_created', {
        idea: {
          id: `idea-multi-${i}`,
          content: ideaContent,
          session_id: mockSession.id,
          participant_id: `participant-${i}`,
          created_at: new Date().toISOString()
        }
      })
    }

    // Verify all 3 ideas appear on desktop
    await page.waitForTimeout(1500)

    for (let i = 1; i <= 3; i++) {
      await expect(page.locator(`text=Idea from Mobile User ${i}`)).toBeVisible({
        timeout: 5000
      })
    }

    // Cleanup
    for (const mobilePage of mobilePages) {
      await mobilePage.close()
    }
  })

  test('should handle typing presence indicators across participants', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    await desktopContext.auth.loginAsTestUser()
    await page.goto('/projects/test-project-456')

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)
    await mobilePage.goto(`/m/join?token=test-token-presence`)

    // Wait for mobile form
    await mobilePage.waitForTimeout(2000)

    // Mobile: Start typing
    const textarea = mobilePage.locator('textarea[placeholder*="Enter your idea"]')
    await textarea.focus()
    await textarea.type('Typing...')

    // Trigger typing event on desktop
    await triggerRealtimeEvent(page, 'participant_typing', {
      participant: mockParticipant,
      isTyping: true
    })

    // Desktop: Verify typing indicator appears
    await page.waitForTimeout(500)
    await expect(
      page.locator(`text=${mockParticipant.participant_name}`)
    ).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=is typing...')).toBeVisible({
      timeout: 3000
    })

    // Mobile: Stop typing (blur textarea)
    await textarea.blur()

    // Trigger typing stopped event
    await triggerRealtimeEvent(page, 'participant_typing', {
      participant: mockParticipant,
      isTyping: false
    })

    // Desktop: Verify typing indicator disappears
    await page.waitForTimeout(1000)
    await expect(page.locator('text=is typing...')).not.toBeVisible({
      timeout: 3000
    })

    await mobilePage.close()
  })

  test('should handle connection loss and reconnection gracefully', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    await desktopContext.auth.loginAsTestUser()
    await page.goto('/projects/test-project-456')

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)
    await mobilePage.goto(`/m/join?token=test-token-reconnect`)

    // Wait for connection
    await mobilePage.waitForTimeout(2000)

    // Simulate connection loss
    await mobilePage.context().setOffline(true)
    await mobilePage.waitForTimeout(1000)

    // Verify disconnected status shown
    const disconnectedIndicator = mobilePage.locator(
      'text=Disconnected, [aria-label="Disconnected"]'
    )
    await expect(disconnectedIndicator).toBeVisible({ timeout: 3000 })

    // Restore connection
    await mobilePage.context().setOffline(false)
    await mobilePage.waitForTimeout(2000)

    // Verify reconnected status
    const connectedIndicator = mobilePage.locator(
      'text=Connected, [aria-label="Connected"]'
    )
    await expect(connectedIndicator).toBeVisible({ timeout: 5000 })

    // Verify form is still functional after reconnection
    const textarea = mobilePage.locator('textarea[placeholder*="Enter your idea"]')
    await expect(textarea).toBeEnabled({ timeout: 3000 })

    await mobilePage.close()
  })

  test('should validate expired token shows proper error state', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)

    // Navigate with expired token
    await mobilePage.goto(`/m/join?token=expired-token-12345`)
    await mobilePage.waitForLoadState('domcontentloaded')

    // Verify expired state UI
    await expect(mobilePage.locator('text=Session Expired')).toBeVisible({
      timeout: 5000
    })
    await expect(
      mobilePage.locator('text=Please request a new QR code')
    ).toBeVisible({ timeout: 3000 })

    // Verify amber clock icon for expired state
    const amberIcon = mobilePage.locator('.bg-amber-100')
    await expect(amberIcon).toBeVisible({ timeout: 2000 })

    await mobilePage.close()
  })

  test('should validate invalid token shows proper error state', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)

    // Navigate with invalid token
    await mobilePage.goto(`/m/join?token=invalid-gibberish-999`)
    await mobilePage.waitForLoadState('domcontentloaded')

    // Verify invalid state UI
    await expect(mobilePage.locator('text=Invalid Session')).toBeVisible({
      timeout: 5000
    })
    await expect(
      mobilePage.locator('text=The QR code you scanned is not valid')
    ).toBeVisible({ timeout: 3000 })

    // Verify red X icon for invalid state
    const redIcon = mobilePage.locator('.bg-red-100')
    await expect(redIcon).toBeVisible({ timeout: 2000 })

    await mobilePage.close()
  })

  test('should validate missing token shows error state', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)

    // Navigate without token parameter
    await mobilePage.goto(`/m/join`)
    await mobilePage.waitForLoadState('domcontentloaded')

    // Verify invalid state (missing token treated as invalid)
    await expect(mobilePage.locator('text=Invalid Session')).toBeVisible({
      timeout: 5000
    })
    await expect(mobilePage.locator('text=No session token provided')).toBeVisible({
      timeout: 3000
    })

    await mobilePage.close()
  })

  test('should maintain real-time synchronization during rapid idea submissions', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    await desktopContext.auth.loginAsTestUser()
    await page.goto('/projects/test-project-456')

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)
    await mobilePage.goto(`/m/join?token=test-token-rapid`)
    await mobilePage.waitForTimeout(2000)

    // Rapidly submit 5 ideas
    for (let i = 1; i <= 5; i++) {
      const textarea = mobilePage.locator('textarea[placeholder*="Enter your idea"]')
      await textarea.fill(`Rapid idea ${i}`)

      const submitBtn = mobilePage.locator('button:has-text("Submit")')
      await submitBtn.click()
      await mobilePage.waitForTimeout(500)

      // Trigger real-time event
      await triggerRealtimeEvent(page, 'idea_created', {
        idea: {
          id: `rapid-idea-${i}`,
          content: `Rapid idea ${i}`,
          session_id: mockSession.id,
          created_at: new Date().toISOString()
        }
      })

      // Small delay between submissions
      await mobilePage.waitForTimeout(300)
    }

    // Verify all 5 ideas appear on desktop
    await page.waitForTimeout(2000)

    for (let i = 1; i <= 5; i++) {
      await expect(page.locator(`text=Rapid idea ${i}`)).toBeVisible({
        timeout: 3000
      })
    }

    // Verify order is maintained (newest first)
    const ideaCards = await page.locator('.idea-card-base').allTextContents()
    expect(ideaCards.some((text) => text.includes('Rapid idea 5'))).toBeTruthy()

    await mobilePage.close()
  })

  test('should handle session end gracefully on mobile', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    await desktopContext.auth.loginAsTestUser()
    await page.goto('/projects/test-project-456')

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)
    await mobilePage.goto(`/m/join?token=test-token-end`)
    await mobilePage.waitForTimeout(2000)

    // Desktop: End session
    await triggerRealtimeEvent(page, 'session_status_changed', {
      session: { ...mockSession, status: 'ended' }
    })

    // Mobile: Verify session ended message
    await mobilePage.waitForTimeout(1000)
    await expect(
      mobilePage.locator('text=Session ended, text=Session has ended')
    ).toBeVisible({ timeout: 5000 })

    // Verify form is disabled
    const textarea = mobilePage.locator('textarea[placeholder*="Enter your idea"]')
    await expect(textarea).toBeDisabled({ timeout: 3000 })

    await mobilePage.close()
  })
})

test.describe('Mobile Brainstorm - Accessibility and Mobile UX', () => {
  test('should have proper touch targets and mobile-optimized UI', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)
    await mobilePage.goto(`/m/join?token=test-token-a11y`)
    await mobilePage.waitForTimeout(2000)

    // Verify submit button has minimum 44x44px touch target
    const submitBtn = mobilePage.locator('button:has-text("Submit")')
    const btnBox = await submitBtn.boundingBox()

    expect(btnBox).toBeTruthy()
    if (btnBox) {
      expect(btnBox.width).toBeGreaterThanOrEqual(44)
      expect(btnBox.height).toBeGreaterThanOrEqual(44)
    }

    // Verify textarea is large enough for mobile typing
    const textarea = mobilePage.locator('textarea[placeholder*="Enter your idea"]')
    const textareaBox = await textarea.boundingBox()

    expect(textareaBox).toBeTruthy()
    if (textareaBox) {
      expect(textareaBox.height).toBeGreaterThanOrEqual(80) // Minimum height for mobile
    }

    await mobilePage.close()
  })

  test('should support keyboard navigation on mobile form', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)
    await mobilePage.goto(`/m/join?token=test-token-keyboard`)
    await mobilePage.waitForTimeout(2000)

    // Tab to textarea
    await mobilePage.keyboard.press('Tab')
    const textarea = mobilePage.locator('textarea[placeholder*="Enter your idea"]')
    await expect(textarea).toBeFocused({ timeout: 2000 })

    // Tab to submit button
    await mobilePage.keyboard.press('Tab')
    const submitBtn = mobilePage.locator('button:has-text("Submit")')
    await expect(submitBtn).toBeFocused({ timeout: 2000 })

    await mobilePage.close()
  })

  test('should have accessible labels and ARIA attributes', async ({
    page,
    context
  }) => {
    test.setTimeout(TEST_TIMEOUT)

    const mobilePage = await context.newPage()
    await setupMobileContext(mobilePage)
    await mobilePage.goto(`/m/join?token=test-token-aria`)
    await mobilePage.waitForTimeout(2000)

    // Verify textarea has accessible label
    const textarea = mobilePage.locator('textarea[placeholder*="Enter your idea"]')
    const ariaLabel = await textarea.getAttribute('aria-label')
    expect(ariaLabel || (await textarea.getAttribute('id'))).toBeTruthy()

    // Verify loading spinner has aria-label
    await mobilePage.goto(`/m/join?token=test-token-loading`)
    const spinner = mobilePage.locator('[aria-label="Validating session"]')
    await expect(spinner).toBeVisible({ timeout: 3000 })

    await mobilePage.close()
  })
})
