/**
 * AIProgressOverlay -- ADR-0015 Step 3 Component Contract Tests
 *
 * Covered test IDs (from ADR-0015 test table):
 *   T-0015-033  progress bar renders at correct width
 *   T-0015-034  stage text matches current stage prop
 *   T-0015-035  countdown "~N seconds remaining" when estimatedSecondsRemaining > 0
 *   T-0015-036  "Almost done..." when estimatedSecondsRemaining is 0
 *   T-0015-037  processing steps checklist renders with active step highlighted
 *   T-0015-038  stage dots: emerald completed, sapphire active, graphite pending
 *   T-0015-039  Cancel button calls onCancel when clicked
 *   T-0015-040  Cancel button absent/disabled when cancelable=false
 *   T-0015-041  error state: garnet bar, error message, Retry and Close buttons
 *   T-0015-042  error state: Retry calls onRetry, Close calls onCancel
 *   T-0015-043  aria-live="polite" region announces stage text
 *   T-0015-044  error state has aria-live="assertive" announcement
 *   T-0015-045  Cancel button has aria-label="Cancel AI generation"
 *
 * Pre-build expected state:
 *   ALL FAIL -- component does not exist at
 *   src/components/ui/AIProgressOverlay.tsx.
 *   Any test that passes before Colby builds is suspicious and flagged below.
 *
 * Mock strategy:
 *   No external dependencies to mock. Component is a pure presentational
 *   component driven entirely by props from useAIGeneration.
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIProgressOverlay from '../ui/AIProgressOverlay'

// ---------------------------------------------------------------------------
// Shared fixture props
// ---------------------------------------------------------------------------

const STAGE_SEQUENCE = ['analyzing', 'synthesizing', 'optimizing', 'finalizing']

const PROCESSING_STEPS = [
  'Reading idea context',
  'Building insight model',
  'Generating recommendations',
  'Finalizing report',
]

const BASE_PROPS = {
  isActive: true,
  progress: 45,
  stage: 'synthesizing',
  estimatedSecondsRemaining: 12,
  processingSteps: PROCESSING_STEPS,
  stageSequence: STAGE_SEQUENCE,
}

// ---------------------------------------------------------------------------
// T-0015-033: progress bar renders at correct width
// ---------------------------------------------------------------------------

describe('AIProgressOverlay -- progress bar', () => {
  it('should render a progress bar element whose width reflects the progress prop', () => {
    render(<AIProgressOverlay {...BASE_PROPS} progress={67} />)

    // The progress bar fill element must expose its width inline or via
    // aria-valuenow so assistive tech and tests can confirm the value.
    // Colby MUST use aria-valuenow on the progressbar role element.
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-valuenow', '67')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('should set the progress bar fill width style to match the progress prop', () => {
    render(<AIProgressOverlay {...BASE_PROPS} progress={40} />)

    // The visual fill element (child of the track) must have width: 40%
    // so the bar accurately reflects progress. Query by test-id because the
    // fill element is not itself a progressbar role element.
    const fill = screen.getByTestId('progress-bar-fill')
    expect(fill).toHaveStyle({ width: '40%' })
  })
})

// ---------------------------------------------------------------------------
// T-0015-034: stage text matches current stage prop
// ---------------------------------------------------------------------------

describe('AIProgressOverlay -- stage text', () => {
  it('should render the current stage label in the UI', () => {
    render(<AIProgressOverlay {...BASE_PROPS} stage="synthesizing" />)
    // The stage text must be visible -- either directly or inside a heading/span.
    // Case-insensitive because the component may capitalize or add an emoji prefix.
    expect(screen.getByText(/synthesizing/i)).toBeInTheDocument()
  })

  it('should update the visible stage text when a different stage prop is passed', () => {
    const { rerender } = render(<AIProgressOverlay {...BASE_PROPS} stage="analyzing" />)
    expect(screen.getByText(/analyzing/i)).toBeInTheDocument()

    rerender(<AIProgressOverlay {...BASE_PROPS} stage="finalizing" />)
    expect(screen.getByText(/finalizing/i)).toBeInTheDocument()
    expect(screen.queryByText(/analyzing/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// T-0015-035: countdown "~N seconds remaining" when estimatedSecondsRemaining > 0
// ---------------------------------------------------------------------------

describe('AIProgressOverlay -- countdown', () => {
  it('should show "~N seconds remaining" when estimatedSecondsRemaining is positive', () => {
    render(<AIProgressOverlay {...BASE_PROPS} estimatedSecondsRemaining={12} />)
    expect(screen.getByText(/~12.+second/i)).toBeInTheDocument()
  })

  // T-0015-036
  it('should show "Almost done..." when estimatedSecondsRemaining is 0', () => {
    render(<AIProgressOverlay {...BASE_PROPS} estimatedSecondsRemaining={0} />)
    expect(screen.getByText(/almost done/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// T-0015-037: processing steps checklist
// ---------------------------------------------------------------------------

describe('AIProgressOverlay -- processing steps', () => {
  it('should render all processing step labels', () => {
    render(<AIProgressOverlay {...BASE_PROPS} />)

    for (const step of PROCESSING_STEPS) {
      expect(screen.getByText(step)).toBeInTheDocument()
    }
  })

  it('should visually distinguish the last (active) step from completed steps', () => {
    render(<AIProgressOverlay {...BASE_PROPS} />)

    // The active step is the last item in processingSteps per the gold standard.
    // The component must apply a sapphire colour class to the last step's container.
    // Query all step items; the last one must carry a sapphire indicator class.
    const steps = screen.getAllByTestId('processing-step')
    const lastStep = steps[steps.length - 1]
    // Accept any sapphire class token -- exact utility may vary.
    expect(lastStep.className).toMatch(/sapphire/)
  })
})

// ---------------------------------------------------------------------------
// T-0015-038: stage dots
// ---------------------------------------------------------------------------

describe('AIProgressOverlay -- stage dots', () => {
  it('should render one dot per entry in stageSequence', () => {
    render(<AIProgressOverlay {...BASE_PROPS} />)
    const dots = screen.getAllByTestId('stage-dot')
    expect(dots).toHaveLength(STAGE_SEQUENCE.length)
  })

  it('should apply emerald class to completed stage dots and sapphire class to active dot', () => {
    // stage="synthesizing" means index 0 (analyzing) is complete, index 1 is active
    render(
      <AIProgressOverlay
        {...BASE_PROPS}
        stage="synthesizing"
        stageSequence={STAGE_SEQUENCE}
      />
    )

    const dots = screen.getAllByTestId('stage-dot')

    // Completed dot (analyzing = index 0)
    expect(dots[0].className).toMatch(/emerald/)

    // Active dot (synthesizing = index 1)
    expect(dots[1].className).toMatch(/sapphire/)

    // Pending dots (optimizing, finalizing = indices 2, 3)
    expect(dots[2].className).toMatch(/graphite/)
    expect(dots[3].className).toMatch(/graphite/)
  })
})

// ---------------------------------------------------------------------------
// T-0015-039 / T-0015-040 / T-0015-045: Cancel button
// ---------------------------------------------------------------------------

describe('AIProgressOverlay -- cancel button', () => {
  it('should call onCancel when the Cancel button is clicked (T-0015-039)', async () => {
    const onCancel = vi.fn()
    render(<AIProgressOverlay {...BASE_PROPS} onCancel={onCancel} cancelable={true} />)

    const cancelButton = screen.getByRole('button', { name: /cancel ai generation/i })
    await userEvent.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('should not render the Cancel button when cancelable is false (T-0015-040)', () => {
    render(<AIProgressOverlay {...BASE_PROPS} cancelable={false} />)
    expect(
      screen.queryByRole('button', { name: /cancel ai generation/i })
    ).not.toBeInTheDocument()
  })

  it('should give the Cancel button aria-label="Cancel AI generation" (T-0015-045)', () => {
    render(<AIProgressOverlay {...BASE_PROPS} onCancel={vi.fn()} cancelable={true} />)
    const btn = screen.getByRole('button', { name: 'Cancel AI generation' })
    expect(btn).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// T-0015-041 / T-0015-042: error state
// ---------------------------------------------------------------------------

describe('AIProgressOverlay -- error state', () => {
  const ERROR_MESSAGE = 'Something went wrong'

  it('should render error message and Retry + Close buttons when error prop is set (T-0015-041)', () => {
    render(
      <AIProgressOverlay
        {...BASE_PROPS}
        error={ERROR_MESSAGE}
        onRetry={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('should call onRetry when Retry is clicked and onCancel when Close is clicked (T-0015-042)', async () => {
    const onRetry = vi.fn()
    const onCancel = vi.fn()

    render(
      <AIProgressOverlay
        {...BASE_PROPS}
        error={ERROR_MESSAGE}
        onRetry={onRetry}
        onCancel={onCancel}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('should apply a garnet colour class to the progress bar in error state', () => {
    render(
      <AIProgressOverlay
        {...BASE_PROPS}
        error={ERROR_MESSAGE}
        onRetry={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const fill = screen.getByTestId('progress-bar-fill')
    expect(fill.className).toMatch(/garnet/)
  })
})

// ---------------------------------------------------------------------------
// T-0015-043 / T-0015-044: accessibility -- aria-live regions
// ---------------------------------------------------------------------------

describe('AIProgressOverlay -- accessibility', () => {
  it('should have an aria-live="polite" region that contains the stage text (T-0015-043)', () => {
    render(<AIProgressOverlay {...BASE_PROPS} stage="optimizing" />)

    // Find the live region
    const politeRegion = document.querySelector('[aria-live="polite"]')
    expect(politeRegion).not.toBeNull()

    // The stage text must live inside (or be) the polite region
    expect(politeRegion).toHaveTextContent(/optimizing/i)
  })

  it('should have an aria-live="assertive" region when error prop is set (T-0015-044)', () => {
    render(
      <AIProgressOverlay
        {...BASE_PROPS}
        error="Something went wrong"
        onRetry={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const assertiveRegion = document.querySelector('[aria-live="assertive"]')
    expect(assertiveRegion).not.toBeNull()
    expect(assertiveRegion).toHaveTextContent(/something went wrong/i)
  })
})

// ---------------------------------------------------------------------------
// Complete state (progress=100, derived from gold standard)
// ---------------------------------------------------------------------------

describe('AIProgressOverlay -- complete state', () => {
  it('should show a "Complete!" label when progress is 100', () => {
    render(
      <AIProgressOverlay
        {...BASE_PROPS}
        progress={100}
        stage="Complete!"
        estimatedSecondsRemaining={0}
      />
    )

    expect(screen.getByText(/complete/i)).toBeInTheDocument()
  })

  it('should show the progress bar at 100% width when progress is 100', () => {
    render(
      <AIProgressOverlay
        {...BASE_PROPS}
        progress={100}
        stage="Complete!"
        estimatedSecondsRemaining={0}
      />
    )

    const fill = screen.getByTestId('progress-bar-fill')
    expect(fill).toHaveStyle({ width: '100%' })
  })
})
