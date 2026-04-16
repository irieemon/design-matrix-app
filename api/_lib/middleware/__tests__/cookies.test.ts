/**
 * Tests for api/_lib/middleware/cookies.ts — ADR-0016 Phase 1
 *
 * T-0016-001: setAuthCookies mints CSRF cookie with maxAge 86400 (24h)
 * T-0016-002: handleGetUser CSRF-mint branch sets cookie with maxAge 86400
 * T-0016-003: Access-token cookie maxAge remains 3600 (regression guard)
 * T-0016-004: Refresh-token cookie maxAge remains 60*60*24*7 (regression guard)
 *
 * Expected-red BEFORE Colby's Step 1 fix:
 *   T-0016-001 fails: cookies.ts:126 currently sets maxAge 60*60 (3600).
 *   T-0016-002 fails: api/auth.ts:396 currently sets maxAge 60*60 (3600).
 * Expected-green:
 *   T-0016-003 / T-0016-004 — regression guards for values that MUST NOT change.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { VercelResponse } from '@vercel/node'
import {
  setAuthCookies,
  COOKIE_NAMES,
} from '../cookies'

// Minimal VercelResponse stub — captures Set-Cookie headers without a real HTTP response
function createMockResponse() {
  const headers: Record<string, string | string[]> = {}
  let statusCode = 200
  const res = {
    _headers: headers,
    _statusCode: () => statusCode,
    setHeader: vi.fn((name: string, value: string | string[]) => {
      headers[name] = value
      return res as unknown as VercelResponse
    }),
    getHeader: vi.fn((name: string) => headers[name]),
    status: vi.fn((code: number) => {
      statusCode = code
      return res
    }),
    json: vi.fn((body: unknown) => {
      ;(res as unknown as { _body: unknown })._body = body
      return res
    }),
    send: vi.fn(),
    end: vi.fn(),
  }
  return res as unknown as VercelResponse & {
    _headers: Record<string, string | string[]>
    _statusCode: () => number
    _body?: unknown
  }
}

/** Extract the Set-Cookie entry for the named cookie from the response. */
function findCookieHeader(res: ReturnType<typeof createMockResponse>, cookieName: string): string | undefined {
  const raw = res._headers['Set-Cookie']
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  return list.find((h) => typeof h === 'string' && h.startsWith(`${cookieName}=`))
}

/** Pull Max-Age=N off a Set-Cookie header string. Returns number or undefined. */
function parseMaxAge(header: string | undefined): number | undefined {
  if (!header) return undefined
  const match = header.match(/Max-Age=(\d+)/)
  return match ? Number(match[1]) : undefined
}

describe('setAuthCookies', () => {
  let res: ReturnType<typeof createMockResponse>

  beforeEach(() => {
    res = createMockResponse()
  })

  describe('T-0016-001: CSRF cookie maxAge is 86400 (24 hours)', () => {
    it('sets csrf-token cookie with Max-Age=86400', () => {
      setAuthCookies(res, {
        accessToken: 'access-token-value',
        refreshToken: 'refresh-token-value',
        csrfToken: 'csrf-token-value',
      })

      const csrfHeader = findCookieHeader(res, COOKIE_NAMES.CSRF_TOKEN)
      expect(csrfHeader).toBeDefined()
      expect(parseMaxAge(csrfHeader)).toBe(60 * 60 * 24)
    })
  })

  describe('T-0016-003: Access-token cookie maxAge remains 3600 (regression guard)', () => {
    it('sets sb-access-token cookie with Max-Age=3600', () => {
      setAuthCookies(res, {
        accessToken: 'access-token-value',
        refreshToken: 'refresh-token-value',
        csrfToken: 'csrf-token-value',
      })

      const accessHeader = findCookieHeader(res, COOKIE_NAMES.ACCESS_TOKEN)
      expect(accessHeader).toBeDefined()
      expect(parseMaxAge(accessHeader)).toBe(60 * 60)
    })
  })

  describe('T-0016-004: Refresh-token cookie maxAge remains 7 days (regression guard)', () => {
    it('sets sb-refresh-token cookie with Max-Age=604800', () => {
      setAuthCookies(res, {
        accessToken: 'access-token-value',
        refreshToken: 'refresh-token-value',
        csrfToken: 'csrf-token-value',
      })

      const refreshHeader = findCookieHeader(res, COOKIE_NAMES.REFRESH_TOKEN)
      expect(refreshHeader).toBeDefined()
      expect(parseMaxAge(refreshHeader)).toBe(60 * 60 * 24 * 7)
    })
  })
})

/**
 * T-0016-002: handleGetUser CSRF-mint branch sets csrf-token with maxAge 86400.
 *
 * handleGetUser lives in api/auth.ts (module-internal). We invoke it via the
 * default export (the consolidated auth router) and mock @supabase/supabase-js
 * so the getUser and user_profiles calls succeed, driving execution into the
 * CSRF-mint branch at api/auth.ts:382–398.
 */
describe('handleGetUser CSRF-mint branch', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_ANON_KEY = 'test-anon-key'
  })

  describe('T-0016-002: mints csrf-token with Max-Age=86400 when session has no CSRF cookie', () => {
    it('sets csrf-token cookie with Max-Age=86400 on the CSRF-mint branch', async () => {
      // Mock @supabase/supabase-js so the handler's auth + profile fetch succeed.
      vi.doMock('@supabase/supabase-js', () => ({
        createClient: () => ({
          auth: {
            getUser: async () => ({
              data: { user: { id: 'user-123' } },
              error: null,
            }),
          },
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'user-123',
                    email: 'test@example.com',
                    role: 'user',
                    full_name: 'Test User',
                    avatar_url: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }))

      // Import the router AFTER the mock is in place.
      const routerMod = await import('../../../auth')
      const router = (routerMod as { default: (req: unknown, res: VercelResponse) => unknown | Promise<unknown> }).default

      const res = createMockResponse()
      // GET /api/auth?action=user with Bearer token; no csrf-token cookie
      // present in request — drives into the mint branch at auth.ts:390.
      const req = {
        method: 'GET',
        url: '/api/auth?action=user',
        headers: {
          authorization: 'Bearer fake-access-token',
          cookie: '',
          'x-forwarded-for': '127.0.0.1',
        },
        query: { action: 'user' },
        socket: { remoteAddress: '127.0.0.1' },
      }

      await router(req, res)

      const csrfHeader = findCookieHeader(res, COOKIE_NAMES.CSRF_TOKEN)
      expect(csrfHeader).toBeDefined()
      expect(parseMaxAge(csrfHeader)).toBe(60 * 60 * 24)
    })
  })
})
