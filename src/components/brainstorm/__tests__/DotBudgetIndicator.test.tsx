/**
 * DotBudgetIndicator component tests — Phase 05.4a Wave 3, Unit 4
 *
 * Tests T-054A-100 through T-054A-105 (6 tests).
 *
 * Component receives props directly (votesUsed, total?).
 * No context dependency — DotBudgetIndicator is a pure display component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { DotBudgetIndicator } from '../DotBudgetIndicator'

// --------------------------------------------------------------------------
// T-054A-100: renders text "3 / 5 votes used"
// --------------------------------------------------------------------------
describe('T-054A-100: renders vote count text', () => {
  it('renders "3 / 5 votes used" when votesUsed=3', () => {
    render(<DotBudgetIndicator votesUsed={3} />)
    expect(screen.getByText('3 / 5 votes used')).toBeDefined()
  })
})

// --------------------------------------------------------------------------
// T-054A-101: 5 mini dots rendered, aria-hidden
// --------------------------------------------------------------------------
describe('T-054A-101: 5 mini dots with aria-hidden', () => {
  it('renders 5 decorative spans with aria-hidden="true"', () => {
    const { container } = render(<DotBudgetIndicator votesUsed={2} />)
    const hiddenSpans = container.querySelectorAll('[aria-hidden="true"]')
    expect(hiddenSpans.length).toBe(5)
  })
})

// --------------------------------------------------------------------------
// T-054A-102: background switches to graphite-200 at 5/5
// --------------------------------------------------------------------------
describe('T-054A-102: background switches at 5/5', () => {
  it('chip has bg-graphite-200 class when votesUsed=5', () => {
    const { container } = render(<DotBudgetIndicator votesUsed={5} />)
    // The chip is the outermost element
    const chip = container.firstElementChild as HTMLElement
    expect(chip.className).toContain('bg-graphite-200')
  })

  it('chip has bg-graphite-100 when votesUsed < 5', () => {
    const { container } = render(<DotBudgetIndicator votesUsed={3} />)
    const chip = container.firstElementChild as HTMLElement
    expect(chip.className).toContain('bg-graphite-100')
  })
})

// --------------------------------------------------------------------------
// T-054A-103: text element has aria-live=polite
// --------------------------------------------------------------------------
describe('T-054A-103: text has aria-live=polite', () => {
  it('the text span has aria-live="polite"', () => {
    const { container } = render(<DotBudgetIndicator votesUsed={2} />)
    const politeEl = container.querySelector('[aria-live="polite"]')
    expect(politeEl).not.toBeNull()
    expect(politeEl?.textContent).toContain('votes used')
  })
})

// --------------------------------------------------------------------------
// T-054A-104: chip has aria-label with count
// --------------------------------------------------------------------------
describe('T-054A-104: chip aria-label includes count', () => {
  it('chip has aria-label="Vote budget: 2 of 5 votes used" when votesUsed=2', () => {
    const { container } = render(<DotBudgetIndicator votesUsed={2} />)
    const chip = container.firstElementChild as HTMLElement
    expect(chip.getAttribute('aria-label')).toBe('Vote budget: 2 of 5 votes used')
  })
})

// --------------------------------------------------------------------------
// T-054A-105: total prop override respected
// --------------------------------------------------------------------------
describe('T-054A-105: total prop override', () => {
  it('shows "3 / 10 votes used" when votesUsed=3 and total=10', () => {
    render(<DotBudgetIndicator votesUsed={3} total={10} />)
    expect(screen.getByText('3 / 10 votes used')).toBeDefined()
  })

  it('chip aria-label reflects custom total', () => {
    const { container } = render(<DotBudgetIndicator votesUsed={3} total={10} />)
    const chip = container.firstElementChild as HTMLElement
    expect(chip.getAttribute('aria-label')).toBe('Vote budget: 3 of 10 votes used')
  })
})
