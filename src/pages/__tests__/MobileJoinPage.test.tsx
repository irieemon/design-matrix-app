/**
 * MobileJoinPage Component Tests
 * Phase Three Implementation - Validation States
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MobileJoinPage from '../MobileJoinPage'
import { BrainstormSessionService } from '../../lib/services/BrainstormSessionService'
import * as configModule from '../../lib/config'

// Mock BrainstormSessionService
vi.mock('../../lib/services/BrainstormSessionService', () => ({
  BrainstormSessionService: {
    validateAndJoin: vi.fn()
  }
}))

// Mock isFeatureEnabled
vi.mock('../../lib/config', async () => {
  const actual = await vi.importActual('../../lib/config')
  return {
    ...actual,
    isFeatureEnabled: vi.fn()
  }
})

describe('MobileJoinPage - Phase Three UI', () => {
  const mockToken = 'valid-token-123'

  beforeEach(() => {
    vi.clearAllMocks()
    // Enable Phase Three by default for these tests
    vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)
  })

  const renderWithRouter = (token: string) => {
    return render(
      <MemoryRouter initialEntries={[`/m/join?token=${token}`]}>
        <Routes>
          <Route path="/m/join" element={<MobileJoinPage />} />
        </Routes>
      </MemoryRouter>
    )
  }

  describe('Loading State', () => {
    it('shows loading spinner during validation', () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      )

      renderWithRouter(mockToken)

      expect(screen.getByLabelText('Validating session')).toBeInTheDocument()
      expect(screen.getByText('Validating session...')).toBeInTheDocument()
    })

    it('displays gradient background during loading', () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      )

      const { container } = renderWithRouter(mockToken)

      const bgElement = container.querySelector('.bg-gradient-to-b')
      expect(bgElement).toBeInTheDocument()
    })
  })

  describe('Expired State', () => {
    it('shows expired UI when token is expired', async () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockResolvedValueOnce({
        success: false,
        error: 'Session token has expired. Please request a new QR code.'
      })

      renderWithRouter(mockToken)

      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument()
      })

      expect(
        screen.getByText('Session token has expired. Please request a new QR code.')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Please request a new QR code from the session facilitator.')
      ).toBeInTheDocument()
    })

    it('displays amber clock icon for expired state', async () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockResolvedValueOnce({
        success: false,
        error: 'Token expired'
      })

      const { container } = renderWithRouter(mockToken)

      await waitFor(() => {
        const amberIcon = container.querySelector('.bg-amber-100')
        expect(amberIcon).toBeInTheDocument()
      })
    })
  })

  describe('Invalid State', () => {
    it('shows invalid UI when token is invalid', async () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockResolvedValueOnce({
        success: false,
        error: 'Invalid session token'
      })

      renderWithRouter(mockToken)

      await waitFor(() => {
        expect(screen.getByText('Invalid Session')).toBeInTheDocument()
      })

      expect(screen.getByText('Invalid session token')).toBeInTheDocument()
      expect(
        screen.getByText(/The QR code you scanned is not valid/)
      ).toBeInTheDocument()
    })

    it('displays red X icon for invalid state', async () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockResolvedValueOnce({
        success: false,
        error: 'Invalid token'
      })

      const { container } = renderWithRouter(mockToken)

      await waitFor(() => {
        const redIcon = container.querySelector('.bg-red-100')
        expect(redIcon).toBeInTheDocument()
      })
    })
  })

  describe('Error State', () => {
    it('shows error UI with retry button for generic errors', async () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockRejectedValueOnce(
        new Error('Network error')
      )

      renderWithRouter(mockToken)

      await waitFor(() => {
        expect(screen.getByText('Connection Error')).toBeInTheDocument()
      })

      expect(screen.getByText('Network error')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
    })

    it('displays orange warning icon for error state', async () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockRejectedValueOnce(
        new Error('Generic error')
      )

      const { container } = renderWithRouter(mockToken)

      await waitFor(() => {
        const orangeIcon = container.querySelector('.bg-orange-100')
        expect(orangeIcon).toBeInTheDocument()
      })
    })

    it('allows retry on error', async () => {
      const mockValidateAndJoin = vi.mocked(BrainstormSessionService.validateAndJoin)

      // First call fails
      mockValidateAndJoin.mockRejectedValueOnce(new Error('Network error'))

      renderWithRouter(mockToken)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
      })

      // Second call succeeds
      mockValidateAndJoin.mockResolvedValueOnce({
        success: true,
        session: {
          id: 'session-1',
          project_id: 'project-1',
          name: 'Test Session',
          status: 'active',
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 3600000).toISOString()
        },
        participant: {
          id: 'participant-1',
          session_id: 'session-1',
          participant_name: 'Test User',
          is_anonymous: false,
          is_approved: true,
          contribution_count: 0,
          joined_at: new Date().toISOString(),
          last_active_at: new Date().toISOString()
        }
      })

      const retryButton = screen.getByRole('button', { name: /Try Again/i })
      retryButton.click()

      await waitFor(() => {
        expect(mockValidateAndJoin).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Success State', () => {
    it('shows MobileIdeaSubmitForm on successful validation', async () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockResolvedValueOnce({
        success: true,
        session: {
          id: 'session-1',
          project_id: 'project-1',
          name: 'Product Brainstorm',
          status: 'active',
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 3600000).toISOString()
        },
        participant: {
          id: 'participant-1',
          session_id: 'session-1',
          participant_name: 'Alice Johnson',
          is_anonymous: false,
          is_approved: true,
          contribution_count: 0,
          joined_at: new Date().toISOString(),
          last_active_at: new Date().toISOString()
        }
      })

      renderWithRouter(mockToken)

      await waitFor(() => {
        expect(screen.getByText('Product Brainstorm')).toBeInTheDocument()
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
      })
    })
  })

  describe('Missing Token', () => {
    it('shows invalid state when token is missing', async () => {
      render(
        <MemoryRouter initialEntries={['/m/join']}>
          <Routes>
            <Route path="/m/join" element={<MobileJoinPage />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Invalid Session')).toBeInTheDocument()
      })

      expect(screen.getByText('No session token provided')).toBeInTheDocument()
    })
  })

  describe('Phase Three Feature Flag', () => {
    it('uses Phase One/Two UI when Phase Three is disabled', async () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)
      vi.mocked(BrainstormSessionService.validateAndJoin).mockResolvedValueOnce({
        success: false,
        error: 'Token expired'
      })

      const { container } = renderWithRouter(mockToken)

      await waitFor(() => {
        // Phase One/Two UI doesn't have gradient background
        const gradientBg = container.querySelector('.bg-gradient-to-b')
        expect(gradientBg).not.toBeInTheDocument()
      })
    })

    it('uses Phase Three UI when Phase Three is enabled', async () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)
      vi.mocked(BrainstormSessionService.validateAndJoin).mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      )

      const { container } = renderWithRouter(mockToken)

      // Phase Three UI has gradient background
      const gradientBg = container.querySelector('.bg-gradient-to-b')
      expect(gradientBg).toBeInTheDocument()
    })
  })

  describe('Error Detection Logic', () => {
    it('detects expired error from message containing "expired"', async () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockResolvedValueOnce({
        success: false,
        error: 'This token has expired and is no longer valid'
      })

      renderWithRouter(mockToken)

      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument()
      })
    })

    it('detects invalid error when not expired', async () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockResolvedValueOnce({
        success: false,
        error: 'Token validation failed'
      })

      renderWithRouter(mockToken)

      await waitFor(() => {
        expect(screen.getByText('Invalid Session')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has accessible loading spinner with aria-label', () => {
      vi.mocked(BrainstormSessionService.validateAndJoin).mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      )

      renderWithRouter(mockToken)

      const spinner = screen.getByLabelText('Validating session')
      expect(spinner).toBeInTheDocument()
    })

    it('has descriptive headings for all states', async () => {
      // Test expired state heading
      vi.mocked(BrainstormSessionService.validateAndJoin).mockResolvedValueOnce({
        success: false,
        error: 'Token expired'
      })

      const { rerender } = renderWithRouter(mockToken)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Session Expired' })).toBeInTheDocument()
      })

      // Test invalid state heading
      vi.mocked(BrainstormSessionService.validateAndJoin).mockResolvedValueOnce({
        success: false,
        error: 'Invalid token'
      })

      rerender(
        <MemoryRouter initialEntries={[`/m/join?token=${mockToken}`]}>
          <Routes>
            <Route path="/m/join" element={<MobileJoinPage />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Invalid Session' })).toBeInTheDocument()
      })
    })
  })
})
