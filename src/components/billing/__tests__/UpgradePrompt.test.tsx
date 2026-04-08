/**
 * Tests for UpgradePrompt (BILL-06).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import UpgradePrompt from '../UpgradePrompt'

describe('UpgradePrompt', () => {
  it('renders resource label, used/limit and a CTA to /pricing', () => {
    render(<UpgradePrompt resource="projects" limit={1} used={1} />)
    expect(screen.getByText(/project limit/i)).toBeInTheDocument()
    expect(screen.getByText(/used/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /upgrade to team/i })
    expect(link).toHaveAttribute('href', '/pricing')
  })

  it('renders ai_ideas variant', () => {
    render(<UpgradePrompt resource="ai_ideas" limit={5} used={5} />)
    expect(screen.getByText(/AI generations/i)).toBeInTheDocument()
  })
})
