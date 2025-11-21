/**
 * Mobile Join Page
 * Phase Three Implementation
 *
 * Polished mobile UI for joining brainstorm sessions via QR code
 * Features: Validation states, responsive design, touch-optimized
 */

import { useEffect, useState } from 'react'
import { BrainstormSessionService } from '../lib/services/BrainstormSessionService'
import { generateDeviceFingerprint } from '../lib/security/brainstormSecurity'
import { isFeatureEnabled } from '../lib/config'
import type { BrainstormSession, SessionParticipant } from '../types/BrainstormSession'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import MobileIdeaSubmitForm from '../components/MobileIdeaSubmitForm'

type ValidationState = 'loading' | 'expired' | 'invalid' | 'success' | 'error'

export default function MobileJoinPage() {
  const [session, setSession] = useState<BrainstormSession | null>(null)
  const [participant, setParticipant] = useState<SessionParticipant | null>(null)
  const [validationState, setValidationState] = useState<ValidationState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function validateAndJoin() {
      try {
        // Extract access token from hash (e.g., #join/uuid-token)
        const hash = window.location.hash
        const match = hash.match(/#join\/([a-f0-9-]+)/)

        if (!match || !match[1]) {
          setValidationState('invalid')
          setErrorMessage('Invalid or missing access token')
          return
        }

        const accessToken = match[1]

        // Validate access token
        const validationResult = await BrainstormSessionService.validateAccessToken({
          accessToken
        })

        if (!validationResult.valid || !validationResult.session) {
          // Determine if expired vs invalid
          const isExpired = validationResult.error?.toLowerCase().includes('expired')
          setValidationState(isExpired ? 'expired' : 'invalid')
          setErrorMessage(validationResult.error || 'Session not found or expired')
          return
        }

        setSession(validationResult.session)

        // Generate device fingerprint
        const fingerprint = await generateDeviceFingerprint()

        // Join session as participant
        const joinResult = await BrainstormSessionService.joinSession({
          sessionId: validationResult.session.id,
          deviceFingerprint: fingerprint
        })

        if (!joinResult.success || !joinResult.participant) {
          setValidationState('error')
          setErrorMessage(joinResult.error || 'Failed to join session')
          return
        }

        setParticipant(joinResult.participant)
        setValidationState('success')
      } catch (err) {
        setValidationState('error')
        setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    validateAndJoin()
  }, [])

  const isPhase3Enabled = isFeatureEnabled('MOBILE_BRAINSTORM_PHASE3')

  // Phase Three: Polished Mobile UI
  if (isPhase3Enabled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100">
        {validationState === 'loading' && (
          <div className="flex flex-col items-center justify-center min-h-screen p-6">
            <LoadingSpinner size="lg" variant="primary" aria-label="Validating session" />
            <p className="mt-4 text-neutral-600 text-center">Validating session...</p>
          </div>
        )}

        {validationState === 'expired' && (
          <div className="flex flex-col items-center justify-center min-h-screen p-6">
            <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-neutral-800 mb-2">Session Expired</h1>
              <p className="text-neutral-600 mb-6">{errorMessage}</p>
              <p className="text-sm text-neutral-500">
                Please request a new QR code from the session facilitator.
              </p>
            </div>
          </div>
        )}

        {validationState === 'invalid' && (
          <div className="flex flex-col items-center justify-center min-h-screen p-6">
            <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-neutral-800 mb-2">Invalid Session</h1>
              <p className="text-neutral-600 mb-6">{errorMessage}</p>
              <p className="text-sm text-neutral-500">
                The join link is invalid. Please scan the QR code again.
              </p>
            </div>
          </div>
        )}

        {validationState === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-screen p-6">
            <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-neutral-800 mb-2">Unable to Join</h1>
              <p className="text-neutral-600 mb-6">{errorMessage}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {validationState === 'success' && session && participant && (
          <MobileIdeaSubmitForm session={session} participant={participant} />
        )}
      </div>
    )
  }

  // Phase One/Two: Basic UI (fallback when Phase Three is disabled)
  if (validationState === 'loading') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Validating session...</p>
      </div>
    )
  }

  if (validationState !== 'success') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ color: 'red' }}>Error: {errorMessage}</p>
      </div>
    )
  }

  if (!session || !participant) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Session not found</p>
      </div>
    )
  }

  const isPhase2Enabled = isFeatureEnabled('MOBILE_BRAINSTORM_PHASE2')

  return (
    <div style={{ padding: '20px' }}>
      <h1>Joined Session: {session.name}</h1>
      <p>Welcome, {participant.participant_name}!</p>
      <p>Session ID: {session.id}</p>
      <p>Participant ID: {participant.id}</p>
      <p>Status: Active</p>
      <hr />
      {isPhase2Enabled ? (
        <p>
          <strong>Phase Two Enabled</strong>: Real-time collaboration features active.
        </p>
      ) : (
        <p>
          <strong>Phase One Complete</strong>: Backend validation successful. Frontend UI will be
          implemented in Phase Two.
        </p>
      )}
    </div>
  )
}
