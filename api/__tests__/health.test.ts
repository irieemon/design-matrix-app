/**
 * Smoke tests for /api/health (ADR-0017 Wave E, AC-HEALTH-01).
 *
 * Verifies:
 *   1. GET returns 200 with the exact documented shape.
 *   2. Response body carries zero PII, tokens, env values, or build metadata.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Mock @supabase/supabase-js BEFORE importing the handler so the createClient
// call inside probeSupabase() resolves to our stub.
vi.mock('@supabase/supabase-js', () => {
  const limit = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })
  const select = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ select })
  const createClient = vi.fn().mockReturnValue({ from })
  return { createClient, __mocks: { createClient, from, select, limit } }
})

// Dynamic import AFTER the mock is registered.
const { default: handler } = await import('../health.js')

function createMockRequest(method = 'GET'): VercelRequest {
  return {
    method,
    headers: {},
    query: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as VercelRequest
}

function createMockResponse() {
  const headers: Record<string, string> = {}
  const res = {
    statusCode: 200,
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code
      return this
    }),
    json: vi.fn(function (this: any, body: unknown) {
      ;(this as any)._body = body
      return this
    }),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value
    }),
    end: vi.fn().mockReturnThis(),
    _body: undefined as unknown,
  }
  return res as unknown as VercelResponse & {
    _body: unknown
    statusCode: number
    status: ReturnType<typeof vi.fn>
    json: ReturnType<typeof vi.fn>
  }
}

const FORBIDDEN_KEYS = [
  'user_id',
  'userId',
  'email',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'csrf',
  'csrfToken',
  'csrf_token',
  'token',
  'authorization',
  'build',
  'buildId',
  'build_id',
  'commit',
  'commitSha',
  'sha',
  'version',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
]

function collectStringValues(value: unknown, sink: string[]): void {
  if (typeof value === 'string') {
    sink.push(value)
    return
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStringValues(v, sink)
    }
  }
}

describe('GET /api/health', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://stub.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key-for-test-only'
  })

  afterEach(() => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
  })

  it('returns 200 with exact documented shape on healthy supabase', async () => {
    const req = createMockRequest('GET')
    const res = createMockResponse()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = (res as any)._body as Record<string, unknown>

    expect(Object.keys(body).sort()).toEqual(['status', 'supabase', 'timestamp'])
    expect(body.status).toBe('ok')
    expect(body.supabase).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
    expect(() => new Date(body.timestamp as string).toISOString()).not.toThrow()
    expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp)
  })

  it('does not expose user identifiers, tokens, emails, or env values', async () => {
    const req = createMockRequest('GET')
    const res = createMockResponse()

    await handler(req, res)

    const body = (res as any)._body as Record<string, unknown>

    // No forbidden keys at any nesting level
    const bodyString = JSON.stringify(body)
    for (const key of FORBIDDEN_KEYS) {
      expect(bodyString).not.toContain(`"${key}"`)
    }

    // No env values leaked as string content
    const stringValues: string[] = []
    collectStringValues(body, stringValues)
    for (const v of stringValues) {
      expect(v).not.toContain('anon-key-for-test-only')
      expect(v).not.toContain('stub.supabase.co')
      expect(v).not.toMatch(/^sk-/)  // OpenAI-style key prefix
      expect(v).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)  // JWT-ish pattern
    }
  })
})
