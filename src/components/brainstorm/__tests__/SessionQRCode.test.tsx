/**
 * SessionQRCode Component Tests
 * Phase Four Implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SessionQRCode from '../SessionQRCode'
import * as configModule from '../../../lib/config'

// Mock isFeatureEnabled
vi.mock('../../../lib/config', async () => {
  const actual = await vi.importActual('../../../lib/config')
  return {
    ...actual,
    isFeatureEnabled: vi.fn()
  }
})

describe('SessionQRCode - Phase Four Component', () => {
  const mockSessionId = 'session-123'
  const mockQrCodeData = 'https://example.com/m/join?token=abc123'
  const mockJoinCode = 'ABCD-1234'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Enable Phase Four by default
    vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Feature Flag Gating', () => {
    it('renders when Phase Four flag is ON', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

      const expiresAt = new Date(Date.now() + 3600000).toISOString() // 1 hour from now

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      expect(screen.getByLabelText(/Mobile Join Session/i)).toBeInTheDocument()
    })

    it('renders nothing when Phase Four flag is OFF', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)

      const expiresAt = new Date(Date.now() + 3600000).toISOString()

      const { container } = render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('QR Code Display', () => {
    it('displays QR code with session data', () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      const qrCode = screen.getByLabelText(`QR code for session ${mockSessionId}`)
      expect(qrCode).toBeInTheDocument()
    })

    it('displays join code in correct format', () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      expect(screen.getByText('ABCD-1234')).toBeInTheDocument()
    })
  })

  describe('Instructions Display', () => {
    it('shows mobile join instructions', () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      expect(screen.getByText(/How to Join on Mobile:/i)).toBeInTheDocument()
      expect(screen.getByText(/Scan the QR code with your phone camera/i)).toBeInTheDocument()
      expect(screen.getByText(/Enter your name when prompted/i)).toBeInTheDocument()
    })
  })

  describe('Time Remaining Countdown', () => {
    it('displays time remaining for active session', () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString() // 1 hour from now

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      expect(screen.getByText(/Expires in/i)).toBeInTheDocument()
    })

    it('updates countdown every second', () => {
      const expiresAt = new Date(Date.now() + 65000).toISOString() // 65 seconds from now

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      // Initial state: should show 1m 5s
      expect(screen.getByText(/Expires in 1m 5s/i)).toBeInTheDocument()

      // Advance 1 second
      vi.advanceTimersByTime(1000)

      // Should update to 1m 4s
      expect(screen.getByText(/Expires in 1m 4s/i)).toBeInTheDocument()
    })

    it('shows expired state when session expires', () => {
      const expiresAt = new Date(Date.now() + 2000).toISOString() // 2 seconds from now

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      // Advance beyond expiration
      vi.advanceTimersByTime(3000)

      expect(screen.getByText('Session Expired')).toBeInTheDocument()
      expect(
        screen.getByText(/This session has expired. Create a new session to enable mobile join./i)
      ).toBeInTheDocument()
    })

    it('formats hours and minutes correctly', () => {
      const expiresAt = new Date(Date.now() + 7200000).toISOString() // 2 hours from now

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      expect(screen.getByText(/Expires in 2h 0m/i)).toBeInTheDocument()
    })

    it('shows only seconds when less than 1 minute remaining', () => {
      const expiresAt = new Date(Date.now() + 45000).toISOString() // 45 seconds from now

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      expect(screen.getByText(/Expires in 45s/i)).toBeInTheDocument()
    })
  })

  describe('Close Functionality', () => {
    it('renders close button when onClose provided', () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()
      const onCloseMock = vi.fn()

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
          onClose={onCloseMock}
        />
      )

      const closeButton = screen.getByLabelText('Close mobile join overlay')
      expect(closeButton).toBeInTheDocument()
    })

    it('does not render close button when onClose not provided', () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      const closeButton = screen.queryByLabelText('Close mobile join overlay')
      expect(closeButton).not.toBeInTheDocument()
    })

    it('calls onClose when close button clicked', async () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()
      const onCloseMock = vi.fn()

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
          onClose={onCloseMock}
        />
      )

      const closeButton = screen.getByLabelText('Close mobile join overlay')
      await userEvent.click(closeButton)

      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes for dialog', () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()

      const { container } = render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      const dialog = container.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('aria-labelledby', 'session-qr-title')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('has descriptive heading', () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      const heading = screen.getByRole('heading', { name: /Mobile Join Session/i })
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveAttribute('id', 'session-qr-title')
    })
  })

  describe('Visual States', () => {
    it('applies correct styling for expired session', () => {
      const expiresAt = new Date(Date.now() - 1000).toISOString() // Already expired

      render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      expect(screen.getByText('Session Expired')).toHaveClass('text-red-600')
    })

    it('applies custom className when provided', () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()

      const { container } = render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
          className="custom-class"
        />
      )

      const dialog = container.querySelector('[role="dialog"]')
      expect(dialog).toHaveClass('custom-class')
    })
  })

  describe('Timer Cleanup', () => {
    it('cleans up interval on unmount', () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()

      const { unmount } = render(
        <SessionQRCode
          sessionId={mockSessionId}
          qrCodeData={mockQrCodeData}
          joinCode={mockJoinCode}
          expiresAt={expiresAt}
        />
      )

      // Verify timer is running
      expect(vi.getTimerCount()).toBeGreaterThan(0)

      unmount()

      // Timer should be cleaned up
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
