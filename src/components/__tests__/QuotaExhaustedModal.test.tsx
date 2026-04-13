/**
 * QuotaExhaustedModal -- ADR-0015 Step 5 Component Contract Tests
 *
 * Covered test IDs (from ADR-0015 test table):
 *   T-0015-047  renders heading "Monthly AI Limit Reached"
 *   T-0015-048  renders usage count and reset date in long format
 *   T-0015-049  "Upgrade to Team" button navigates to /pricing
 *   T-0015-050  "Close" button calls onClose
 *   T-0015-051  Close button is focused on mount (not the upgrade button)
 *   T-0015-052  has role="dialog" and aria-labelledby pointing to heading
 *
 * Pre-build expected state:
 *   ALL FAIL -- component does not exist at
 *   src/components/ui/QuotaExhaustedModal.tsx.
 *   Any test that passes before Colby builds is suspicious and flagged.
 *
 * Mock strategy:
 *   No hooks to mock. QuotaExhaustedModal is a pure presentational component
 *   driven by props. react-router-dom's useNavigate is mocked to capture
 *   navigation calls without requiring a full Router tree.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock react-router-dom navigate to capture routing calls
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import QuotaExhaustedModal from '@/components/ui/QuotaExhaustedModal'
import type { QuotaData } from '@/hooks/useAIQuota'

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const EXHAUSTED_QUOTA: QuotaData = {
  canUse: false,
  current: 5,
  limit: 5,
  percentageUsed: 100,
  isUnlimited: false,
  resetsAt: '2026-05-01T00:00:00.000Z',
}

function renderModal(overrides: Partial<{ isOpen: boolean; onClose: () => void; onUpgrade: () => void }> = {}) {
  const defaults = {
    isOpen: true,
    onClose: vi.fn(),
    quota: EXHAUSTED_QUOTA,
    onUpgrade: vi.fn(),
  }
  return render(<QuotaExhaustedModal {...defaults} {...overrides} />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// T-0015-047: heading text
// ---------------------------------------------------------------------------

describe('QuotaExhaustedModal', () => {
  it('should render the heading "Monthly AI Limit Reached"', () => {
    renderModal()

    expect(
      screen.getByRole('heading', { name: /Monthly AI Limit Reached/i })
    ).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // T-0015-048: usage count and reset date in long format
  // -------------------------------------------------------------------------

  it('should render the usage count and reset date in long human-readable format', () => {
    renderModal()

    // ADR-0015 UX doc S2d copy contract:
    // "You've used all {limit} AI generations this month."
    expect(screen.getByText(/You've used all 5 AI generations this month/i)).toBeInTheDocument()

    // Reset date must be formatted with Intl.DateTimeFormat (long month name)
    // "2026-05-01T00:00:00.000Z" -> "May 1, 2026"
    expect(screen.getByText(/May 1, 2026/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // T-0015-049: upgrade button navigates to /pricing
  // -------------------------------------------------------------------------

  it('should navigate to /pricing when the upgrade CTA is clicked', async () => {
    const user = userEvent.setup()
    renderModal()

    // ADR-0015 UX doc S2d: CTA text is "Upgrade to Team"
    const upgradeButton = screen.getByRole('button', { name: /Upgrade to Team/i })
    await user.click(upgradeButton)

    expect(mockNavigate).toHaveBeenCalledWith('/pricing')
  })

  // -------------------------------------------------------------------------
  // T-0015-050: close button calls onClose
  // -------------------------------------------------------------------------

  it('should call onClose when the Close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal({ onClose })

    const closeButton = screen.getByRole('button', { name: /^Close$/i })
    await user.click(closeButton)

    expect(onClose).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // T-0015-051: Close button is focused on mount (not upgrade)
  // -------------------------------------------------------------------------

  it('should focus the Close button on mount, not the upgrade button', () => {
    renderModal()

    // ADR-0015 spec: focus Close on mount to prevent accidental purchase
    const closeButton = screen.getByRole('button', { name: /^Close$/i })
    expect(document.activeElement).toBe(closeButton)
  })

  // -------------------------------------------------------------------------
  // T-0015-052: role="dialog" + aria-labelledby
  // -------------------------------------------------------------------------

  it('should have role="dialog" with aria-labelledby pointing to the heading', () => {
    renderModal()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()

    const labelledById = dialog.getAttribute('aria-labelledby')
    expect(labelledById).toBeTruthy()

    // The element the aria-labelledby points to must contain the heading text
    const labelElement = document.getElementById(labelledById!)
    expect(labelElement).not.toBeNull()
    expect(labelElement!.textContent).toMatch(/Monthly AI Limit Reached/i)
  })
})
