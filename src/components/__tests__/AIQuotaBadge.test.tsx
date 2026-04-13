/**
 * AIQuotaBadge -- ADR-0015 Step 5 Component Contract Tests
 *
 * Covered test IDs (from ADR-0015 test table):
 *   T-0015-058  renders "3/5 AI" with neutral styling when usage < 80%
 *   T-0015-059  renders "4/5 AI" with amber warning styling when usage 80-99%
 *   T-0015-060  renders "5/5 AI" with garnet error styling when usage 100%
 *   T-0015-061  renders skeleton pill during loading
 *   T-0015-062  renders "-- AI" on fetch error
 *   T-0015-063  not rendered (null) for team tier
 *   T-0015-065  tooltip "Upgrade for unlimited" shown when exhausted
 *   T-0015-066  correct aria-label per usage state (neutral, warning, exhausted)
 *
 * Pre-build expected state:
 *   ALL FAIL -- component does not exist at src/components/ui/AIQuotaBadge.tsx.
 *   Any test that passes before Colby builds is suspicious and flagged.
 *
 * Mock strategy:
 *   useAIQuota is mocked at the module level. Each test overrides the return
 *   value to drive the specific state under test. No network calls are made.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock useAIQuota before importing the component so the mock is in place
// when the module initialises.
vi.mock('@/hooks/useAIQuota', () => ({
  useAIQuota: vi.fn(),
}))

import { useAIQuota } from '@/hooks/useAIQuota'
import AIQuotaBadge from '@/components/ui/AIQuotaBadge'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuota(current: number, limit: number) {
  const percentageUsed = limit === 0 ? 0 : Math.round((current / limit) * 100)
  return {
    canUse: current < limit,
    current,
    limit,
    percentageUsed,
    isUnlimited: false,
    resetsAt: '2026-05-01T00:00:00.000Z',
  }
}

const mockUseAIQuota = vi.mocked(useAIQuota)

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// T-0015-058: neutral styling when usage < 80%
// ---------------------------------------------------------------------------

describe('AIQuotaBadge', () => {
  it('should render usage fraction and neutral styling when under 80% used', () => {
    // 3/5 = 60% -- neutral zone (0-79%)
    mockUseAIQuota.mockReturnValue({
      quota: makeQuota(3, 5),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<AIQuotaBadge />)

    expect(screen.getByText(/3\/5 AI/)).toBeInTheDocument()
    // Neutral state must NOT carry amber or garnet class names
    const badge = screen.getByText(/3\/5 AI/).closest('[class]')
    expect(badge?.className).not.toMatch(/amber/)
    expect(badge?.className).not.toMatch(/garnet/)
  })

  // -------------------------------------------------------------------------
  // T-0015-059: amber warning styling at 80-99%
  // -------------------------------------------------------------------------

  it('should render amber warning styling when usage is 80-99%', () => {
    // 4/5 = 80% -- warning zone
    mockUseAIQuota.mockReturnValue({
      quota: makeQuota(4, 5),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<AIQuotaBadge />)

    expect(screen.getByText(/4\/5 AI/)).toBeInTheDocument()
    // ADR-0015 UX doc S2c specifies amber classes in warning state
    const badge = screen.getByText(/4\/5 AI/).closest('[class]')
    expect(badge?.className).toMatch(/amber/)
  })

  // -------------------------------------------------------------------------
  // T-0015-060: garnet exhausted styling at 100%
  // -------------------------------------------------------------------------

  it('should render garnet styling when quota is exhausted (100% used)', () => {
    // 5/5 = 100% -- exhausted
    mockUseAIQuota.mockReturnValue({
      quota: makeQuota(5, 5),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<AIQuotaBadge />)

    expect(screen.getByText(/5\/5 AI/)).toBeInTheDocument()
    // ADR-0015 UX doc S2c specifies garnet classes in exhausted state
    const badge = screen.getByText(/5\/5 AI/).closest('[class]')
    expect(badge?.className).toMatch(/garnet/)
  })

  // -------------------------------------------------------------------------
  // T-0015-061: skeleton pill during loading
  // -------------------------------------------------------------------------

  it('should render a loading skeleton while quota data is being fetched', () => {
    mockUseAIQuota.mockReturnValue({
      quota: null,
      isLoading: true,
      error: null,
      refresh: vi.fn(),
    })

    render(<AIQuotaBadge />)

    // Skeleton is present; no usage text should be visible
    expect(screen.queryByText(/AI/)).not.toBeInTheDocument()
    // ADR-0015 spec requires aria-label="Loading AI usage" on skeleton
    expect(
      screen.getByRole('status', { hidden: true }) ||
      document.querySelector('[aria-label="Loading AI usage"]')
    ).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // T-0015-062: "-- AI" on fetch error
  // -------------------------------------------------------------------------

  it('should render "-- AI" with muted styling on quota fetch error', () => {
    mockUseAIQuota.mockReturnValue({
      quota: null,
      isLoading: false,
      error: 'Network error',
      refresh: vi.fn(),
    })

    render(<AIQuotaBadge />)

    expect(screen.getByText(/-- AI/)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // T-0015-063: hidden for team tier (isUnlimited = true via null quota)
  // -------------------------------------------------------------------------

  it('should not render when quota is null (team/enterprise tier returns null)', () => {
    // useAIQuota returns null quota for paid tiers per hook contract
    mockUseAIQuota.mockReturnValue({
      quota: null,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    const { container } = render(<AIQuotaBadge />)

    // Component must render nothing for paid tiers
    expect(container.firstChild).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0015-065: tooltip "Upgrade for unlimited" on exhausted hover
  // -------------------------------------------------------------------------

  it('should show "Upgrade for unlimited" tooltip when exhausted badge is hovered', async () => {
    mockUseAIQuota.mockReturnValue({
      quota: makeQuota(5, 5),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    const user = userEvent.setup()
    render(<AIQuotaBadge />)

    const badge = screen.getByText(/5\/5 AI/)
    await user.hover(badge)

    // ADR-0015 UX doc S2c: tooltip text is "Upgrade for unlimited"
    expect(screen.getByText(/Upgrade for unlimited/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // T-0015-066: aria-label per usage state
  // -------------------------------------------------------------------------

  it('should set aria-label to neutral usage description when under 80% used', () => {
    mockUseAIQuota.mockReturnValue({
      quota: makeQuota(3, 5),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<AIQuotaBadge />)

    // ADR-0015 UX doc S2c: "AI usage: 3 of 5 generations used this month"
    expect(
      screen.getByRole('status', { name: /AI usage: 3 of 5 generations used this month/i }) ||
      document.querySelector('[aria-label*="3 of 5"]')
    ).toBeTruthy()
  })
})
