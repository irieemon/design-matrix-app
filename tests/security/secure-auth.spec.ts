/**
 * Security Tests for httpOnly Cookie Authentication
 *
 * Validates PRIO-SEC-001 fix (CVSS 9.1 → 0.0)
 * Ensures tokens are NOT exposed to JavaScript
 */

import { test, expect } from '@playwright/test'

test.describe('Secure Authentication - httpOnly Cookies', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('SECURITY: Tokens should NOT be in localStorage', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')

    // Wait for authentication to complete
    await page.waitForTimeout(2000)

    // Check localStorage for tokens (should be EMPTY)
    const localStorageKeys = await page.evaluate(() => {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) keys.push(key)
      }
      return keys
    })

    // SECURITY VALIDATION: No auth tokens in localStorage
    const authKeys = localStorageKeys.filter(key =>
      key.includes('token') ||
      key.includes('auth') ||
      key.includes('session') ||
      key.includes('sb-')
    )

    expect(authKeys).toHaveLength(0)
    console.log('✅ SECURITY PASS: No auth tokens found in localStorage')
  })

  test('SECURITY: Tokens should NOT be in sessionStorage', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)

    // Check sessionStorage for tokens (should be EMPTY except csrf-token)
    const sessionStorageKeys = await page.evaluate(() => {
      const keys: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key) keys.push(key)
      }
      return keys
    })

    // SECURITY VALIDATION: Only CSRF token allowed (it's not sensitive)
    const tokenKeys = sessionStorageKeys.filter(key =>
      key.includes('access') ||
      key.includes('refresh') ||
      key.includes('session') ||
      (key.includes('token') && key !== 'csrf-token')
    )

    expect(tokenKeys).toHaveLength(0)
    console.log('✅ SECURITY PASS: No sensitive tokens in sessionStorage')
  })

  test('SECURITY: Access tokens should be in httpOnly cookies', async ({ page, context }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)

    // Get all cookies
    const cookies = await context.cookies()

    // Find auth cookies
    const accessTokenCookie = cookies.find(c => c.name === 'sb-access-token')
    const refreshTokenCookie = cookies.find(c => c.name === 'sb-refresh-token')

    // SECURITY VALIDATION: Cookies exist and are httpOnly
    expect(accessTokenCookie).toBeDefined()
    expect(accessTokenCookie?.httpOnly).toBe(true)
    expect(accessTokenCookie?.secure).toBe(true) // Should be true in production

    expect(refreshTokenCookie).toBeDefined()
    expect(refreshTokenCookie?.httpOnly).toBe(true)
    expect(refreshTokenCookie?.sameSite).toBe('Strict')

    console.log('✅ SECURITY PASS: Tokens stored in httpOnly cookies')
  })

  test('SECURITY: JavaScript cannot access auth tokens', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)

    // Try to access tokens via JavaScript (should fail)
    const tokenAccess = await page.evaluate(() => {
      // Try to read access token cookie
      const cookies = document.cookie
      const hasAccessToken = cookies.includes('sb-access-token')
      const hasRefreshToken = cookies.includes('sb-refresh-token')

      return {
        canAccessAccessToken: hasAccessToken,
        canAccessRefreshToken: hasRefreshToken,
        documentCookie: cookies
      }
    })

    // SECURITY VALIDATION: httpOnly cookies are NOT accessible via document.cookie
    expect(tokenAccess.canAccessAccessToken).toBe(false)
    expect(tokenAccess.canAccessRefreshToken).toBe(false)

    console.log('✅ SECURITY PASS: httpOnly cookies protected from JavaScript access')
  })

  test('SECURITY: CSRF token is readable but not sensitive', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)

    // CSRF token should be readable (it's not httpOnly)
    const csrfToken = await page.evaluate(() => {
      const cookies = document.cookie
      const match = cookies.match(/csrf-token=([^;]+)/)
      return match ? match[1] : null
    })

    // CSRF token should exist and be readable (this is intentional)
    expect(csrfToken).toBeTruthy()
    console.log('✅ SECURITY PASS: CSRF token readable (by design, not sensitive)')
  })

  test('SECURITY: Session persists across page reloads', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)

    // Verify logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    // Reload page
    await page.reload()
    await page.waitForTimeout(1000)

    // Should still be logged in (session restored from httpOnly cookie)
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    console.log('✅ SECURITY PASS: Session persists via httpOnly cookies')
  })

  test('SECURITY: Logout clears all auth cookies', async ({ page, context }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)

    // Verify cookies exist
    let cookies = await context.cookies()
    expect(cookies.some(c => c.name === 'sb-access-token')).toBe(true)

    // Logout
    await page.click('[data-testid="logout-button"]')
    await page.waitForTimeout(1000)

    // Verify cookies are cleared
    cookies = await context.cookies()
    expect(cookies.some(c => c.name === 'sb-access-token')).toBe(false)
    expect(cookies.some(c => c.name === 'sb-refresh-token')).toBe(false)

    console.log('✅ SECURITY PASS: Logout clears all auth cookies')
  })

  test('SECURITY: XSS attack cannot steal tokens', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)

    // Simulate XSS attack trying to steal tokens
    const xssAttempt = await page.evaluate(() => {
      try {
        // XSS payload that tries to steal tokens
        const stolenTokens = {
          localStorage: localStorage.getItem('sb-access-token'),
          sessionStorage: sessionStorage.getItem('sb-access-token'),
          cookies: document.cookie,
        }

        // Try to send stolen data (simulated)
        return {
          success: false,
          stolenData: stolenTokens,
          message: 'XSS blocked'
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // SECURITY VALIDATION: XSS cannot steal tokens
    expect(xssAttempt.stolenData?.localStorage).toBeNull()
    expect(xssAttempt.stolenData?.sessionStorage).toBeNull()
    expect(xssAttempt.stolenData?.cookies).not.toContain('sb-access-token')
    expect(xssAttempt.stolenData?.cookies).not.toContain('sb-refresh-token')

    console.log('✅ SECURITY PASS: XSS attack cannot steal httpOnly tokens')
  })
})

test.describe('Security Compliance - CVSS Validation', () => {
  test('PRIO-SEC-001: XSS Token Theft Vulnerability RESOLVED', async ({ page, context }) => {
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // CVSS 9.1 → 0.0 Validation
    const securityChecks = {
      noLocalStorageTokens: true,
      noSessionStorageTokens: true,
      httpOnlyCookies: true,
      secureFlag: true,
      xssProtection: true
    }

    // Check 1: No tokens in localStorage
    const localStorageCheck = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.includes('token') || key?.includes('auth')) {
          return false
        }
      }
      return true
    })
    securityChecks.noLocalStorageTokens = localStorageCheck

    // Check 2: No tokens in sessionStorage (except CSRF)
    const sessionStorageCheck = await page.evaluate(() => {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.includes('access') || key?.includes('refresh')) {
          return false
        }
      }
      return true
    })
    securityChecks.noSessionStorageTokens = sessionStorageCheck

    // Check 3: httpOnly cookies exist
    const cookies = await context.cookies()
    const accessCookie = cookies.find(c => c.name === 'sb-access-token')
    securityChecks.httpOnlyCookies = !!accessCookie?.httpOnly

    // Check 4: Secure flag enabled
    securityChecks.secureFlag = !!accessCookie?.secure

    // Check 5: XSS cannot access tokens
    const xssCheck = await page.evaluate(() => {
      const cookies = document.cookie
      return !cookies.includes('sb-access-token') && !cookies.includes('sb-refresh-token')
    })
    securityChecks.xssProtection = xssCheck

    // FINAL VALIDATION
    console.log('🔒 PRIO-SEC-001 Security Validation:', securityChecks)

    expect(securityChecks.noLocalStorageTokens).toBe(true)
    expect(securityChecks.noSessionStorageTokens).toBe(true)
    expect(securityChecks.httpOnlyCookies).toBe(true)
    expect(securityChecks.secureFlag).toBe(true)
    expect(securityChecks.xssProtection).toBe(true)

    console.log('✅ CVSS 9.1 VULNERABILITY RESOLVED: XSS token theft no longer possible')
  })
})
