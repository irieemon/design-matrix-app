/**
 * Stripe webhook tests — Phase 06-03
 *
 * Covers:
 *  1. Duplicate delivery of same event_id is a no-op
 *  2. First delivery inserts into stripe_webhook_events
 *  3. invoice.payment_failed inserts a user_notifications row
 *  4. invoice.payment_failed sets status=past_due AND past_due_since
 *  5. Replay of payment_failed does NOT double-insert notification
 *  6. customer.subscription.updated back to active clears past_due_since
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// --- Mocks ------------------------------------------------------------------

const mockConstructWebhookEvent = vi.fn()
const mockGetSubscription = vi.fn()
const mockUpdateSubscription = vi.fn()

vi.mock('../../../src/lib/services/stripeService', () => ({
  stripeService: {
    constructWebhookEvent: (...args: any[]) => mockConstructWebhookEvent(...args),
    getSubscription: (...args: any[]) => mockGetSubscription(...args),
  },
}))

vi.mock('../../../src/lib/services/subscriptionService', () => ({
  subscriptionService: {
    updateSubscription: (...args: any[]) => mockUpdateSubscription(...args),
  },
}))

// Capture-all for Supabase admin writes
type InsertCall = { table: string; row: any }
const inserts: InsertCall[] = []
let dedupShouldConflict = false

const mockAdminClient = {
  from: (table: string) => ({
    insert: (row: any) => {
      inserts.push({ table, row })
      if (table === 'stripe_webhook_events' && dedupShouldConflict) {
        return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } })
      }
      return Promise.resolve({ error: null })
    },
  }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockAdminClient,
}))

// --- Import under test ------------------------------------------------------

import webhook from '../webhook'

// --- Helpers ----------------------------------------------------------------

function buildReq(rawBody: string = '{}'): VercelRequest {
  const body = Buffer.from(rawBody)
  async function* iter() {
    yield body
  }
  const req: any = iter()
  req.method = 'POST'
  req.headers = { 'stripe-signature': 'test_sig' }
  return req as VercelRequest
}

function buildRes(): VercelResponse & { _status: number; _json: any } {
  const res: any = {
    _status: 200,
    _json: null,
    status(code: number) {
      this._status = code
      return this
    },
    json(payload: any) {
      this._json = payload
      return this
    },
  }
  return res as VercelResponse & { _status: number; _json: any }
}

beforeEach(() => {
  inserts.length = 0
  dedupShouldConflict = false
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  mockConstructWebhookEvent.mockReset()
  mockGetSubscription.mockReset()
  mockUpdateSubscription.mockReset().mockResolvedValue(undefined)
})

// --- Tests ------------------------------------------------------------------

describe('stripe webhook — idempotency', () => {
  it('inserts into stripe_webhook_events on first delivery', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_new_1',
      type: 'invoice.payment_succeeded',
      data: { object: { subscription: null } },
    })
    const res = buildRes()
    await webhook(buildReq(), res)

    const dedupInsert = inserts.find((i) => i.table === 'stripe_webhook_events')
    expect(dedupInsert).toBeDefined()
    expect(dedupInsert!.row.event_id).toBe('evt_new_1')
    expect(res._status).toBe(200)
  })

  it('duplicate event_id returns 200 duplicate and skips handler', async () => {
    dedupShouldConflict = true
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_dup_1',
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_x' } },
    })
    const res = buildRes()
    await webhook(buildReq(), res)

    expect(res._status).toBe(200)
    expect(res._json).toMatchObject({ duplicate: true })
    // Handler must not have run → no getSubscription call
    expect(mockGetSubscription).not.toHaveBeenCalled()
    // No user_notifications insert
    expect(inserts.find((i) => i.table === 'user_notifications')).toBeUndefined()
  })
})

describe('stripe webhook — handlePaymentFailed', () => {
  it('inserts user_notifications and sets past_due_since', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_pf_1',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_123',
          subscription: 'sub_123',
          amount_due: 2500,
          currency: 'usd',
        },
      },
    })
    mockGetSubscription.mockResolvedValue({
      metadata: { user_id: 'user_abc' },
    })

    const res = buildRes()
    await webhook(buildReq(), res)

    // subscription update called with past_due + past_due_since
    expect(mockUpdateSubscription).toHaveBeenCalled()
    const [userId, updates] = mockUpdateSubscription.mock.calls[0]
    expect(userId).toBe('user_abc')
    expect(updates.status).toBe('past_due')
    expect(updates.past_due_since).toBeInstanceOf(Date)

    // user_notifications row inserted
    const notif = inserts.find((i) => i.table === 'user_notifications')
    expect(notif).toBeDefined()
    expect(notif!.row.user_id).toBe('user_abc')
    expect(notif!.row.type).toBe('payment_failed')
    expect(notif!.row.message).toContain('25.00')
    expect(notif!.row.message).toContain('USD')
  })

  it('duplicate payment_failed does NOT double-insert notification', async () => {
    dedupShouldConflict = true
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_pf_dup',
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_123', amount_due: 1000, currency: 'usd' } },
    })
    mockGetSubscription.mockResolvedValue({ metadata: { user_id: 'user_abc' } })

    const res = buildRes()
    await webhook(buildReq(), res)

    expect(inserts.find((i) => i.table === 'user_notifications')).toBeUndefined()
    expect(mockUpdateSubscription).not.toHaveBeenCalled()
    expect(res._json).toMatchObject({ duplicate: true })
  })
})

describe('stripe webhook — handleSubscriptionUpdated', () => {
  it('clears past_due_since when status transitions back to active', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      id: 'evt_su_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          status: 'active',
          metadata: { user_id: 'user_abc', tier: 'pro' },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          cancel_at_period_end: false,
        },
      },
    })

    const res = buildRes()
    await webhook(buildReq(), res)

    expect(mockUpdateSubscription).toHaveBeenCalled()
    const [, updates] = mockUpdateSubscription.mock.calls[0]
    expect(updates.status).toBe('active')
    expect(updates.past_due_since).toBeNull()
  })
})
