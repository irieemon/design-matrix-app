/**
 * Tests for PaymentFailedBanner (BILL-02).
 *
 * Uses createAuthenticatedClientFromLocalStorage (NOT the default supabase
 * singleton) to avoid the getSession deadlock documented in MEMORY.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

vi.mock('../../../lib/supabase', () => ({
  createAuthenticatedClientFromLocalStorage: vi.fn(),
}))
vi.mock('../../../contexts/UserContext', () => ({
  useCurrentUser: vi.fn(),
}))

import { createAuthenticatedClientFromLocalStorage } from '../../../lib/supabase'
import { useCurrentUser } from '../../../contexts/UserContext'
import PaymentFailedBanner from '../PaymentFailedBanner'

function makeClient(selectResult: any, updateResult: any = { error: null }) {
  const maybeSingle = vi.fn().mockResolvedValue(selectResult)
  const selectChain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle,
    update: vi.fn().mockReturnThis(),
  }
  const updateChain: any = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(updateResult),
  }
  return {
    from: vi.fn((table: string) => {
      // First call for select, subsequent update call returns updateChain
      return {
        select: selectChain.select,
        eq: selectChain.eq,
        is: selectChain.is,
        order: selectChain.order,
        limit: selectChain.limit,
        maybeSingle,
        update: updateChain.update.mockImplementation(() => ({
          eq: updateChain.eq,
        })),
      }
    }),
  }
}

describe('PaymentFailedBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
    ;(useCurrentUser as any).mockReturnValue({ id: 'user-1', email: 'a@b.com' })
  })

  it('renders when an unread payment_failed notification exists', async () => {
    const client = makeClient({
      data: {
        id: 'n1',
        user_id: 'user-1',
        type: 'payment_failed',
        message: 'Card declined',
        created_at: '2026-01-01',
        read_at: null,
      },
      error: null,
    })
    ;(createAuthenticatedClientFromLocalStorage as any).mockReturnValue(client)

    render(<PaymentFailedBanner />)
    await waitFor(() => expect(screen.getByTestId('payment-failed-banner')).toBeInTheDocument())
    expect(screen.getByText(/Card declined/)).toBeInTheDocument()
    expect(client.from).toHaveBeenCalledWith('user_notifications')
  })

  it('hides when dismissed (PATCH sets read_at)', async () => {
    const client = makeClient({
      data: {
        id: 'n1',
        user_id: 'user-1',
        type: 'payment_failed',
        message: 'Card declined',
        created_at: '2026-01-01',
        read_at: null,
      },
      error: null,
    })
    ;(createAuthenticatedClientFromLocalStorage as any).mockReturnValue(client)

    render(<PaymentFailedBanner />)
    const banner = await screen.findByTestId('payment-failed-banner')
    fireEvent.click(screen.getByLabelText(/Dismiss/))
    await waitFor(() => expect(screen.queryByTestId('payment-failed-banner')).toBeNull())
  })

  it('renders nothing when no notification exists', async () => {
    const client = makeClient({ data: null, error: null })
    ;(createAuthenticatedClientFromLocalStorage as any).mockReturnValue(client)

    const { container } = render(<PaymentFailedBanner />)
    await waitFor(() => expect(client.from).toHaveBeenCalled())
    expect(container.querySelector('[data-testid="payment-failed-banner"]')).toBeNull()
  })
})
