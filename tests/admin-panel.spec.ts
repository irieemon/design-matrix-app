/**
 * Admin Panel End-to-End Tests
 *
 * Tests the admin panel functionality after database schema fixes are applied
 *
 * Prerequisites:
 *   - FIX_ADMIN_DEPLOYMENT.sql has been executed in Supabase
 *   - Application deployed to Vercel
 *   - ai_token_usage table exists
 *   - users.last_login column exists
 *
 * Run with:
 *   npx playwright test tests/admin-panel.spec.ts
 */

import { test, expect } from '@playwright/test'

const VERCEL_URL = process.env.VERCEL_URL || 'http://localhost:5173'
const ADMIN_URL = `${VERCEL_URL}/admin`

test.describe('Admin Panel - Post-Fix Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin panel
    await page.goto(ADMIN_URL)

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')
  })

  test('should load admin panel without errors', async ({ page }) => {
    // Check page title or main heading
    await expect(page).toHaveTitle(/Admin/i)

    // Verify no console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.waitForTimeout(2000) // Wait for any delayed errors

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes('Multiple GoTrueClient instances') && // Warning, not error
        !err.includes('favicon') // Favicon errors are not critical
    )

    expect(criticalErrors).toHaveLength(0)
  })

  test('should load projects panel without 500 error', async ({ page }) => {
    // Listen for failed network requests
    const failedRequests: { url: string; status: number }[] = []

    page.on('response', (response) => {
      if (response.url().includes('/api/admin/projects') && response.status() >= 400) {
        failedRequests.push({
          url: response.url(),
          status: response.status()
        })
      }
    })

    // Wait for projects data to load
    await page.waitForTimeout(3000)

    // Should NOT have 500 errors
    const serverErrors = failedRequests.filter((req) => req.status === 500)
    expect(serverErrors).toHaveLength(0)

    // Should NOT have configuration errors
    const configErrors = failedRequests.filter((req) => req.status === 500)
    expect(configErrors).toHaveLength(0)
  })

  test('should load analytics panel without errors', async ({ page }) => {
    const failedRequests: { url: string; status: number; statusText: string }[] = []

    page.on('response', (response) => {
      if (response.url().includes('/api/admin/analytics') && response.status() >= 400) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        })
      }
    })

    // Wait for analytics to load
    await page.waitForTimeout(3000)

    // Should NOT have any 4xx or 5xx errors
    expect(failedRequests).toHaveLength(0)
  })

  test('should NOT get 404 on ai_token_usage table', async ({ page }) => {
    const notFoundErrors: string[] = []

    page.on('response', (response) => {
      if (
        response.status() === 404 &&
        response.url().includes('ai_token_usage')
      ) {
        notFoundErrors.push(response.url())
      }
    })

    // Navigate and wait
    await page.waitForTimeout(3000)

    // ai_token_usage table should exist
    expect(notFoundErrors).toHaveLength(0)
  })

  test('should NOT get 400 on users table with date filter', async ({ page }) => {
    const badRequestErrors: { url: string; message: string }[] = []

    page.on('response', async (response) => {
      if (
        response.status() === 400 &&
        response.url().includes('/rest/v1/users') &&
        response.url().includes('last_login')
      ) {
        const body = await response.text().catch(() => 'Unable to read body')
        badRequestErrors.push({
          url: response.url(),
          message: body
        })
      }
    })

    await page.waitForTimeout(3000)

    // last_login column should exist
    expect(badRequestErrors).toHaveLength(0)
  })

  test('should display projects data (if any projects exist)', async ({ page }) => {
    // Wait for potential data to load
    await page.waitForTimeout(3000)

    // Check for either:
    // 1. Projects list with data
    // 2. Empty state message (acceptable if no projects)
    const hasProjects = await page.locator('[data-testid="project-row"]').count()
    const hasEmptyState = await page.locator('text=/no projects/i').count()

    // Should have either projects or empty state, not error message
    expect(hasProjects > 0 || hasEmptyState > 0).toBe(true)
  })

  test('should display analytics overview metrics', async ({ page }) => {
    // Wait for analytics to load
    await page.waitForTimeout(3000)

    // Look for metrics sections - should not show error state
    const hasErrorMessage = await page.locator('text=/server configuration error/i').count()

    expect(hasErrorMessage).toBe(0)
  })

  test('should load token spend panel', async ({ page }) => {
    // Check for token spend panel access
    await page.waitForTimeout(3000)

    // Should NOT show 404 error for ai_token_usage
    const has404Error = await page.locator('text=/404/').count()

    expect(has404Error).toBe(0)
  })

  test('should have valid API responses', async ({ page }) => {
    const apiResponses: { endpoint: string; status: number; ok: boolean }[] = []

    page.on('response', (response) => {
      if (response.url().includes('/api/admin/')) {
        apiResponses.push({
          endpoint: response.url().split('/api/admin/')[1] || 'unknown',
          status: response.status(),
          ok: response.ok()
        })
      }
    })

    await page.waitForTimeout(5000) // Wait for all API calls

    // All admin API calls should return 200-299
    const failedCalls = apiResponses.filter((resp) => !resp.ok)

    if (failedCalls.length > 0) {
      console.log('Failed API calls:', failedCalls)
    }

    expect(failedCalls).toHaveLength(0)
  })

  test('should not display "Server configuration error"', async ({ page }) => {
    await page.waitForTimeout(3000)

    // This error indicates missing environment variables or database issues
    const configError = await page.locator('text=Server configuration error').count()

    expect(configError).toBe(0)
  })

  test('browser console should be clean', async ({ page }) => {
    const consoleMessages: { type: string; text: string }[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        })
      }
    })

    await page.waitForTimeout(3000)

    // Filter out acceptable warnings
    const criticalIssues = consoleMessages.filter(
      (msg) =>
        msg.type === 'error' &&
        !msg.text.includes('Multiple GoTrueClient') &&
        !msg.text.includes('favicon')
    )

    if (criticalIssues.length > 0) {
      console.log('Critical console issues:', criticalIssues)
    }

    expect(criticalIssues).toHaveLength(0)
  })
})

test.describe('Admin Panel - Data Integrity', () => {
  test('should handle empty ai_token_usage table gracefully', async ({ page }) => {
    await page.goto(ADMIN_URL)
    await page.waitForLoadState('networkidle')

    // Even with empty table, should not crash or show errors
    const hasError = await page.locator('text=/error loading/i').count()

    expect(hasError).toBe(0)
  })

  test('should handle users without last_login gracefully', async ({ page }) => {
    await page.goto(ADMIN_URL)
    await page.waitForLoadState('networkidle')

    // Should handle null last_login values (showing "Never" or similar)
    // Should not crash or show database errors
    const hasDbError = await page.locator('text=/database error/i').count()

    expect(hasDbError).toBe(0)
  })
})
