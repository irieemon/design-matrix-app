/**
 * DesktopOnlyHint — non-blocking "Best on desktop" banner.
 *
 * Rendered above page content when the user is on a mobile viewport and the
 * current route is classified as desktop-only (see 07-MOBILE-AUDIT.md).
 * Per D-08, this never blocks rendering of the underlying page.
 *
 * The "Email me this link" CTA POSTs to /api/email-link, which uses Resend
 * to send the current URL to the authenticated user's email.
 */
import React, { useState } from 'react'
import { SUPABASE_STORAGE_KEY } from '../../lib/config'

/**
 * Lock-free localStorage read — avoids GoTrueClient navigator.locks deadlock
 * that affects getSession() in this app. Matches the pattern used in useAuth.ts.
 */
function getAccessTokenFromLocalStorage(): string | null {
  try {
    const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return parsed?.access_token ?? null
  } catch {
    return null
  }
}

interface DesktopOnlyHintProps {
  pageName: string
  emailLinkCta?: boolean
}

type SendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent'; to?: string }
  | { status: 'error'; message: string }

export const DesktopOnlyHint: React.FC<DesktopOnlyHintProps> = ({
  pageName,
  emailLinkCta = true,
}) => {
  // Gate on mobile is handled by the caller (PageRouter) to avoid duplicate
  // useBreakpoint instances returning out-of-sync values during HMR / resize.
  const [send, setSend] = useState<SendState>({ status: 'idle' })

  const handleEmailLink = async () => {
    if (send.status === 'sending') return
    setSend({ status: 'sending' })
    try {
      const token = getAccessTokenFromLocalStorage()
      if (!token) {
        setSend({ status: 'error', message: 'Please sign in again.' })
        return
      }
      const url = typeof window !== 'undefined' ? window.location.href : ''
      const response = await fetch('/api/email-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url, pageName }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = data?.error?.message || `Request failed (${response.status})`
        setSend({ status: 'error', message })
        return
      }
      if (data?.delivered) {
        setSend({ status: 'sent', to: data.to })
      } else {
        setSend({
          status: 'error',
          message: 'Email service is not configured yet — try again later.',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send email. Try again.'
      setSend({ status: 'error', message })
    }
  }

  const buttonLabel =
    send.status === 'sending'
      ? 'Sending…'
      : send.status === 'sent'
        ? send.to
          ? `Sent to ${send.to}`
          : 'Sent'
        : 'Email me this link'

  return (
    <div
      role="note"
      data-testid="desktop-only-hint"
      style={{
        width: '100%',
        background: '#fffbeb',
        borderBottom: '1px solid #fde68a',
        padding: '0.75rem 1rem',
        color: '#78350f',
        fontSize: '0.875rem',
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p style={{ margin: 0, fontSize: '1rem' }}>
          <strong>Best on desktop</strong> — {pageName} works better on a larger screen.
        </p>
        {emailLinkCta && (
          <button
            type="button"
            onClick={handleEmailLink}
            disabled={send.status === 'sending' || send.status === 'sent'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '2.75rem',
              minWidth: '2.75rem',
              padding: '0 0.75rem',
              borderRadius: '0.375rem',
              background: send.status === 'sent' ? '#d1fae5' : '#fef3c7',
              fontSize: '1rem',
              fontWeight: 500,
              color: send.status === 'sent' ? '#065f46' : '#78350f',
              border: 'none',
              cursor:
                send.status === 'sending' || send.status === 'sent'
                  ? 'default'
                  : 'pointer',
              opacity: send.status === 'sending' ? 0.7 : 1,
            }}
          >
            {buttonLabel}
          </button>
        )}
      </div>
      {send.status === 'error' && (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#991b1b' }}>
          {send.message}
        </p>
      )}
    </div>
  )
}

export default DesktopOnlyHint
