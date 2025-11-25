/**
 * Session QR Code Component
 * Phase Four Implementation
 *
 * Desktop facilitator overlay displaying QR code, join code, and session information
 * for mobile participants to join the brainstorming session
 */

import React, { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { isFeatureEnabled } from '../../lib/config'

interface SessionQRCodeProps {
  sessionId: string
  qrCodeData: string // Full URL for QR scanning
  joinCode: string // ABCD-1234 format
  expiresAt: string // ISO timestamp
  onClose?: () => void
  className?: string
}

function getTimeRemaining(expiresAt: string): string {
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()

  if (diffMs <= 0) return 'Expired'

  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffHour > 0) {
    const remainingMin = diffMin % 60
    return `${diffHour}h ${remainingMin}m`
  }
  if (diffMin > 0) {
    const remainingSec = diffSec % 60
    return `${diffMin}m ${remainingSec}s`
  }
  return `${diffSec}s`
}

export default function SessionQRCode({
  sessionId,
  qrCodeData,
  joinCode,
  expiresAt,
  onClose,
  className = ''
}: SessionQRCodeProps) {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(expiresAt))
  const [isExpired, setIsExpired] = useState(false)

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(expiresAt)
      setTimeRemaining(remaining)

      if (remaining === 'Expired') {
        setIsExpired(true)
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  // Phase Four feature flag check
  if (!isFeatureEnabled('MOBILE_BRAINSTORM_PHASE4')) {
    return null
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop itself, not the panel
    if (e.target === e.currentTarget && onClose) {
      onClose()
    }
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in ${className}`}
      role="dialog"
      aria-labelledby="session-qr-title"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      {/* Overlay Panel */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 id="session-qr-title" className="text-xl font-semibold text-neutral-800">
            📱 Mobile Join Session
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              aria-label="Close mobile join overlay"
            >
              <svg
                className="w-5 h-5 text-neutral-600"
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
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {/* QR Code */}
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-xl border-4 border-blue-500 shadow-lg">
              <QRCodeSVG
                value={qrCodeData}
                size={200}
                level="H"
                includeMargin={false}
                aria-label={`QR code for session ${sessionId}`}
              />
            </div>
          </div>

          {/* Join Code Display */}
          <div className="mb-6">
            <p className="text-sm text-neutral-600 text-center mb-2">
              Or enter this code manually:
            </p>
            <div className="bg-neutral-100 rounded-lg px-4 py-3 text-center">
              <p className="text-2xl font-bold text-neutral-800 tracking-wider font-mono">
                {joinCode}
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-6 bg-blue-50 rounded-lg px-4 py-3">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              📲 How to Join on Mobile:
            </h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Scan the QR code with your phone camera</li>
              <li>Or visit the link and enter the join code</li>
              <li>Enter your name when prompted</li>
              <li>Start submitting ideas!</li>
            </ol>
          </div>

          {/* Time Remaining */}
          <div className="flex items-center justify-center gap-2">
            <svg
              className={`w-5 h-5 ${isExpired ? 'text-red-500' : 'text-neutral-500'}`}
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
            <p
              className={`text-sm ${isExpired ? 'text-red-600 font-semibold' : 'text-neutral-600'}`}
            >
              {isExpired ? 'Session Expired' : `Expires in ${timeRemaining}`}
            </p>
          </div>

          {/* Expired Warning */}
          {isExpired && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-800 text-center">
                ⚠️ This session has expired. Create a new session to enable mobile join.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 rounded-b-2xl">
          <p className="text-xs text-neutral-500 text-center">
            Mobile participants can submit ideas in real-time
          </p>
        </div>
      </div>
    </div>
  )
}
