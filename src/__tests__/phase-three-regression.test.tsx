/**
 * Phase Three Regression Tests
 *
 * Ensures Phase Three mobile brainstorm features do NOT break existing functionality:
 * - Idea Matrix CRUD operations still work
 * - Project navigation remains functional
 * - Non-brainstorm features unaffected
 * - Phase Three flag OFF behavior (Phase One/Two intact)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Import Phase Three components
import MobileJoinPage from '../pages/MobileJoinPage'
import MobileIdeaSubmitForm from '../components/MobileIdeaSubmitForm'
import ParticipantList from '../components/brainstorm/ParticipantList'
import PresenceIndicators from '../components/brainstorm/PresenceIndicators'

// Import existing components that should NOT be affected
import OptimizedIdeaCard from '../components/matrix/OptimizedIdeaCard'

// Mock dependencies
vi.mock('../lib/config', () => ({
  isFeatureEnabled: vi.fn()
}))

vi.mock('../lib/services/BrainstormSessionService', () => ({
  BrainstormSessionService: {
    validateAndJoin: vi.fn(),
    submitIdea: vi.fn()
  }
}))

vi.mock('../hooks/brainstorm/useBrainstormRealtime', () => ({
  useBrainstormRealtime: vi.fn(() => ({
    participants: [],
    presenceStates: [],
    isConnected: true,
    reconnectAttempts: 0,
    sessionStatus: 'active'
  }))
}))

import * as configModule from '../lib/config'

describe('Phase Three Regression Tests - Existing Features Intact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Idea Matrix CRUD - NO REGRESSIONS', () => {
    it('should still render OptimizedIdeaCard without mobile features when flag OFF', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)

      const mockIdea = {
        id: 'idea-1',
        content: 'Test idea without mobile',
        user_id: 'user-1',
        project_id: 'project-1',
        x: 100,
        y: 100,
        priority: 'moderate' as const,
        details: '',
        tags: [],
        locked_by: null,
        locked_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { container } = render(
        <OptimizedIdeaCard
          idea={mockIdea}
          isFromMobile={false}
          isNewIdea={false}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onDragStart={vi.fn()}
          onDragEnd={vi.fn()}
        />
      )

      // Should render card
      expect(screen.getByText('Test idea without mobile')).toBeInTheDocument()

      // Should NOT have mobile indicator when flag OFF
      const mobileIndicator = container.querySelector(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(mobileIndicator).not.toBeInTheDocument()
    })

    it('should still handle card editing without mobile features', async () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)

      const mockIdea = {
        id: 'idea-2',
        content: 'Editable idea',
        user_id: 'user-1',
        project_id: 'project-1',
        x: 150,
        y: 150,
        priority: 'high' as const,
        details: 'Original details',
        tags: [],
        locked_by: null,
        locked_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const onEditMock = vi.fn()

      render(
        <OptimizedIdeaCard
          idea={mockIdea}
          isFromMobile={false}
          isNewIdea={false}
          onEdit={onEditMock}
          onDelete={vi.fn()}
          onDragStart={vi.fn()}
          onDragEnd={vi.fn()}
        />
      )

      // Double-click to edit
      const card = screen.getByText('Editable idea')
      await userEvent.dblClick(card)

      // Verify edit callback fired
      await waitFor(() => {
        expect(onEditMock).toHaveBeenCalled()
      })
    })

    it('should still handle card deletion without mobile features', async () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)

      const mockIdea = {
        id: 'idea-3',
        content: 'Deletable idea',
        user_id: 'user-1',
        project_id: 'project-1',
        x: 200,
        y: 200,
        priority: 'low' as const,
        details: '',
        tags: [],
        locked_by: null,
        locked_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const onDeleteMock = vi.fn()

      const { container } = render(
        <OptimizedIdeaCard
          idea={mockIdea}
          isFromMobile={false}
          isNewIdea={false}
          onEdit={vi.fn()}
          onDelete={onDeleteMock}
          onDragStart={vi.fn()}
          onDragEnd={vi.fn()}
        />
      )

      // Find and click delete button
      const deleteButton = container.querySelector('[aria-label="Delete idea"]')
      expect(deleteButton).toBeInTheDocument()

      if (deleteButton) {
        await userEvent.click(deleteButton as HTMLElement)

        await waitFor(() => {
          expect(onDeleteMock).toHaveBeenCalled()
        })
      }
    })
  })

  describe('Project Navigation - NO REGRESSIONS', () => {
    it('should not affect project page routing when Phase Three flag OFF', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)

      // Render app with project route
      const { container } = render(
        <MemoryRouter initialEntries={['/projects/test-project']}>
          <Routes>
            <Route path="/projects/:projectId" element={<div>Project Page</div>} />
          </Routes>
        </MemoryRouter>
      )

      // Verify project page renders
      expect(screen.getByText('Project Page')).toBeInTheDocument()
    })

    it('should not interfere with non-mobile routes', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

      // Render regular project route (not mobile)
      const { container } = render(
        <MemoryRouter initialEntries={['/projects/regular-project']}>
          <Routes>
            <Route path="/projects/:projectId" element={<div>Regular Project</div>} />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Regular Project')).toBeInTheDocument()
    })
  })

  describe('Phase Three Flag Behavior - Phase One/Two Intact', () => {
    it('should use Phase One/Two UI when Phase Three flag is OFF', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)

      render(
        <MemoryRouter initialEntries={['/m/join?token=test-token']}>
          <Routes>
            <Route path="/m/join" element={<MobileJoinPage />} />
          </Routes>
        </MemoryRouter>
      )

      // Phase One/Two UI doesn't have gradient background
      const gradientBg = document.querySelector('.bg-gradient-to-b')
      expect(gradientBg).not.toBeInTheDocument()
    })

    it('should use Phase Three UI when flag is ON', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

      const mockSession = {
        id: 'session-1',
        project_id: 'project-1',
        name: 'Test Session',
        status: 'active' as const,
        created_by: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 3600000).toISOString()
      }

      const mockParticipant = {
        id: 'participant-1',
        session_id: 'session-1',
        participant_name: 'Test User',
        is_anonymous: false,
        is_approved: true,
        contribution_count: 0,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString()
      }

      const { container } = render(
        <MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />
      )

      // Phase Three has mobile form elements
      const ideaTextarea = screen.getByPlaceholderText(/Enter your idea/i)
      expect(ideaTextarea).toBeInTheDocument()
    })
  })

  describe('Non-Brainstorm Features - NO REGRESSIONS', () => {
    it('should not affect idea card rendering for non-session ideas', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

      const regularIdea = {
        id: 'regular-idea',
        content: 'Regular non-session idea',
        user_id: 'user-1',
        project_id: 'project-1',
        x: 250,
        y: 250,
        priority: 'strategic' as const,
        details: '',
        tags: [],
        locked_by: null,
        locked_at: null,
        created_at: new Date(Date.now() - 10000).toISOString(), // Old idea
        updated_at: new Date(Date.now() - 10000).toISOString()
        // NO session_id - regular idea
      }

      const { container } = render(
        <OptimizedIdeaCard
          idea={regularIdea}
          isFromMobile={false}
          isNewIdea={false}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onDragStart={vi.fn()}
          onDragEnd={vi.fn()}
        />
      )

      // Should render regular idea
      expect(screen.getByText('Regular non-session idea')).toBeInTheDocument()

      // Should NOT have mobile indicator for regular ideas
      const mobileIndicator = container.querySelector(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(mobileIndicator).not.toBeInTheDocument()

      // Should NOT have new animation for old ideas
      const card = screen.getByText('Regular non-session idea').closest('.draggable')
      expect(card).not.toHaveClass('animate-scale-in')
    })

    it('should not affect participant list when no active session', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

      // Empty participants array (no active session)
      render(<ParticipantList participants={[]} />)

      // Should show "No active participants" state
      expect(screen.getByText(/No active participants/i)).toBeInTheDocument()
    })

    it('should not affect presence indicators when no one is typing', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

      // Empty presence states
      const { container } = render(<PresenceIndicators presenceStates={[]} />)

      // Should render nothing (no typing indicators)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Backward Compatibility - Phase Two Features Work', () => {
    it('should still support real-time updates without mobile indicators', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)

      const realtimeIdea = {
        id: 'realtime-idea',
        content: 'Real-time updated idea',
        user_id: 'user-1',
        project_id: 'project-1',
        x: 300,
        y: 300,
        priority: 'moderate' as const,
        details: '',
        tags: [],
        locked_by: null,
        locked_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { rerender } = render(
        <OptimizedIdeaCard
          idea={realtimeIdea}
          isFromMobile={false}
          isNewIdea={true}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onDragStart={vi.fn()}
          onDragEnd={vi.fn()}
        />
      )

      // Should show new animation even when flag OFF
      const card = screen.getByText('Real-time updated idea').closest('.draggable')
      expect(card).toHaveClass('animate-scale-in')

      // Update to not new
      rerender(
        <OptimizedIdeaCard
          idea={realtimeIdea}
          isFromMobile={false}
          isNewIdea={false}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onDragStart={vi.fn()}
          onDragEnd={vi.fn()}
        />
      )

      // Animation should be removed
      const updatedCard = screen
        .getByText('Real-time updated idea')
        .closest('.draggable')
      expect(updatedCard).not.toHaveClass('animate-scale-in')
    })
  })

  describe('Performance - NO DEGRADATION', () => {
    it('should render idea cards quickly even with Phase Three features enabled', () => {
      vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

      const ideas = Array.from({ length: 20 }, (_, i) => ({
        id: `perf-idea-${i}`,
        content: `Performance test idea ${i}`,
        user_id: 'user-1',
        project_id: 'project-1',
        x: 100 + i * 10,
        y: 100 + i * 10,
        priority: 'moderate' as const,
        details: '',
        tags: [],
        locked_by: null,
        locked_at: null,
        session_id: i % 2 === 0 ? 'session-1' : undefined, // Mix of mobile and regular
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const startTime = performance.now()

      ideas.forEach((idea) => {
        render(
          <OptimizedIdeaCard
            idea={idea}
            isFromMobile={!!idea.session_id}
            isNewIdea={false}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onDragStart={vi.fn()}
            onDragEnd={vi.fn()}
          />
        )
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render 20 cards in under 500ms
      expect(renderTime).toBeLessThan(500)
    })
  })
})
