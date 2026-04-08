/**
 * InvitationAcceptPage
 *
 * Mounts when the URL is `/invite#token=...` (or hash route `#token=...`).
 *
 * Flow:
 *   1. Parse token from window.location.hash
 *   2. GET /api/invitations/lookup?token=... — preview project + role
 *   3. If not authenticated, render AuthScreen for signup; on success, retry
 *   4. POST /api/invitations/accept with the token + Authorization header
 *   5. On success navigate to the project
 *
 * IMPORTANT: This page never calls `supabase.auth.getSession()` — that
 * deadlocks the singleton client on this codebase (see MEMORY.md
 * feedback_supabase_auth_deadlock). Instead, the access token is read
 * synchronously from localStorage under SUPABASE_STORAGE_KEY.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { SUPABASE_STORAGE_KEY } from '../lib/config'
import AuthScreen from '../components/auth/AuthScreen'
import { getCsrfToken } from '../utils/cookieUtils'

interface InvitePreview {
  projectId: string
  projectName: string
  role: 'viewer' | 'editor'
  inviterName: string
}

type Status =
  | 'loading'
  | 'invalid'
  | 'preview-needs-auth'
  | 'preview-authed'
  | 'accepting'
  | 'accepted'
  | 'accept-failed'

function readAccessTokenLockFree(): string | null {
  try {
    const raw = localStorage.getItem(SUPABASE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.access_token ?? null
  } catch {
    return null
  }
}

function parseTokenFromHash(): string {
  const hash = window.location.hash || ''
  const m = hash.match(/(?:^#|&)token=([^&]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

const InvitationAcceptPage: React.FC = () => {
  const [status, setStatus] = useState<Status>('loading')
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [token] = useState<string>(() => parseTokenFromHash())

  // Step 1+2: parse token, fetch preview
  useEffect(() => {
    let cancelled = false
    if (!token) {
      setStatus('invalid')
      return
    }
    ;(async () => {
      try {
        const res = await fetch(
          `/api/invitations/lookup?token=${encodeURIComponent(token)}`,
          { credentials: 'include' }
        )
        if (cancelled) return
        if (!res.ok) {
          setStatus('invalid')
          return
        }
        const data = (await res.json()) as InvitePreview
        setPreview(data)
        const accessToken = readAccessTokenLockFree()
        setStatus(accessToken ? 'preview-authed' : 'preview-needs-auth')
      } catch {
        if (!cancelled) setStatus('invalid')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  // Step 4: POST /api/invitations/accept
  const acceptInvite = useCallback(async () => {
    setStatus('accepting')
    const accessToken = readAccessTokenLockFree()
    if (!accessToken) {
      setStatus('preview-needs-auth')
      return
    }
    try {
      const csrfToken = getCsrfToken()
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        setStatus('accept-failed')
        return
      }
      const data = (await res.json()) as { projectId: string; role: string }
      setStatus('accepted')
      // Step 5: navigate into the project using the app's URL convention
      // (query param `?project=<id>`, root path, no hash). useBrowserHistory
      // in MainApp picks this up and restores the project automatically.
      setTimeout(() => {
        window.location.replace(`/?project=${data.projectId}`)
      }, 600)
    } catch {
      setStatus('accept-failed')
    }
  }, [token])

  // Auto-accept once we know the user is authenticated
  useEffect(() => {
    if (status === 'preview-authed') acceptInvite()
  }, [status, acceptInvite])

  // ─── Renders ───────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas-primary">
        <p className="text-graphite-600">Looking up invitation…</p>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-canvas-primary p-6 text-center">
        <h1 className="text-2xl font-semibold text-graphite-900 mb-2">Invitation unavailable</h1>
        <p className="text-graphite-600 max-w-md">
          This invite link is no longer valid. Ask the project owner for a new one.
        </p>
      </div>
    )
  }

  if (status === 'preview-needs-auth' && preview) {
    return (
      <div className="min-h-screen bg-canvas-primary">
        <div className="max-w-2xl mx-auto px-6 py-8 text-center">
          <h1 className="text-2xl font-semibold text-graphite-900 mb-2">
            Join {preview.projectName}
          </h1>
          <p className="text-graphite-600 mb-6">
            {preview.inviterName} invited you as a <strong>{preview.role}</strong>. Sign up or log in to accept.
          </p>
        </div>
        <AuthScreen
          onAuthSuccess={() => {
            // After login/signup, re-check token presence and accept.
            setStatus('preview-authed')
          }}
        />
      </div>
    )
  }

  if (status === 'preview-authed' || status === 'accepting') {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas-primary">
        <p className="text-graphite-600">
          Joining {preview?.projectName ?? 'the project'}…
        </p>
      </div>
    )
  }

  if (status === 'accepted') {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas-primary">
        <p className="text-graphite-700">Joined {preview?.projectName}. Redirecting…</p>
      </div>
    )
  }

  // accept-failed
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-canvas-primary p-6 text-center">
      <h1 className="text-2xl font-semibold text-graphite-900 mb-2">Couldn't join project</h1>
      <p className="text-graphite-600 max-w-md mb-4">
        This invite link is no longer valid. Ask the project owner for a new one.
      </p>
      <button
        onClick={() => window.location.replace('/')}
        className="px-4 py-2 rounded-lg bg-sapphire-500 text-white font-medium"
      >
        Go home
      </button>
    </div>
  )
}

export default InvitationAcceptPage
