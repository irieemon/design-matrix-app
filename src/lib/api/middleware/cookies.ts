/**
 * Cookie Utilities
 *
 * Secure httpOnly cookie management for authentication tokens
 */

import type { VercelResponse } from '@vercel/node'

/**
 * Cookie names
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'sb-access-token',
  REFRESH_TOKEN: 'sb-refresh-token',
  CSRF_TOKEN: 'csrf-token',
} as const

/**
 * Cookie configuration
 */
export interface CookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  maxAge?: number  // in seconds
  path?: string
  domain?: string
}

/**
 * Default cookie options (secure defaults)
 */
const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
}

/**
 * Set secure httpOnly cookie
 */
export function setSecureCookie(
  res: VercelResponse,
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  const opts = { ...DEFAULT_COOKIE_OPTIONS, ...options }

  const cookieParts: string[] = [
    `${name}=${encodeURIComponent(value)}`,
  ]

  if (opts.httpOnly) {
    cookieParts.push('HttpOnly')
  }

  if (opts.secure) {
    cookieParts.push('Secure')
  }

  if (opts.sameSite) {
    cookieParts.push(`SameSite=${opts.sameSite.charAt(0).toUpperCase() + opts.sameSite.slice(1)}`)
  }

  if (opts.maxAge !== undefined) {
    cookieParts.push(`Max-Age=${opts.maxAge}`)
  }

  if (opts.path) {
    cookieParts.push(`Path=${opts.path}`)
  }

  if (opts.domain) {
    cookieParts.push(`Domain=${opts.domain}`)
  }

  // Get existing Set-Cookie headers
  const existingHeaders = res.getHeader('Set-Cookie') || []
  const headers = Array.isArray(existingHeaders)
    ? existingHeaders
    : [existingHeaders.toString()]

  // Add new cookie
  headers.push(cookieParts.join('; '))

  // Set header
  res.setHeader('Set-Cookie', headers)
}

/**
 * Set authentication cookies (access + refresh + CSRF)
 */
export function setAuthCookies(
  res: VercelResponse,
  tokens: {
    accessToken: string
    refreshToken: string
    csrfToken: string
  }
): void {
  // Access token - short lived (1 hour), accessible from all paths
  setSecureCookie(res, COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60,  // 1 hour
    path: '/',
  })

  // Refresh token - long lived (7 days), restricted to /api/auth
  setSecureCookie(res, COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',  // More restrictive for refresh token
    maxAge: 60 * 60 * 24 * 7,  // 7 days
    path: '/api/auth',  // Only accessible to auth endpoints
  })

  // CSRF token - readable by JavaScript (not httpOnly)
  setSecureCookie(res, COOKIE_NAMES.CSRF_TOKEN, tokens.csrfToken, {
    httpOnly: false,  // JavaScript needs to read this for headers
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60,  // 1 hour (same as access token)
    path: '/',
  })
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(res: VercelResponse): void {
  // Clear all auth cookies by setting Max-Age=0
  const cookieNames = [
    COOKIE_NAMES.ACCESS_TOKEN,
    COOKIE_NAMES.REFRESH_TOKEN,
    COOKIE_NAMES.CSRF_TOKEN,
  ]

  cookieNames.forEach(name => {
    setSecureCookie(res, name, '', {
      maxAge: 0,
      path: name === COOKIE_NAMES.REFRESH_TOKEN ? '/api/auth' : '/',
    })
  })
}

/**
 * Parse cookie header into object
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {}
  }

  const cookies: Record<string, string> = {}

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=')
    const value = rest.join('=').trim()

    if (name && value) {
      try {
        cookies[name.trim()] = decodeURIComponent(value)
      } catch {
        // Invalid cookie value, skip
      }
    }
  })

  return cookies
}

/**
 * Get cookie value from request
 */
export function getCookie(
  req: { headers: { cookie?: string } },
  name: string
): string | undefined {
  const cookies = parseCookies(req.headers.cookie)
  return cookies[name]
}

/**
 * Generate secure random CSRF token
 */
export function generateCSRFToken(): string {
  // Generate 32 bytes of random data, base64 encoded
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Buffer.from(bytes).toString('base64url')
}
