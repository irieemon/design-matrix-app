/**
 * CSRF cookie bootstrap helper extracted from useAuth.ts.
 *
 * Why a separate module: useAuth's useEffect needs to await the outcome and
 * dispatch terminal-logout (ADR-0016 Step 3). Tests must mock this function
 * to drive the dispatch deterministically. Function-to-function calls within
 * a single ES module cannot be intercepted by `vi.doMock` because the lexical
 * binding is captured at module evaluation. Splitting the helper into its
 * own module restores the import boundary the mocks need.
 *
 * The module-level `csrfBootstrapped` guard lives here so it remains a
 * single source of truth for both the useAuth caller and the BaseAiService
 * 403 re-mint path (which calls this with `force=true`).
 */

import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import { SUPABASE_STORAGE_KEY } from '../lib/config'

export type BootstrapCsrfOutcome = 'ok' | 'retryable' | 'terminal'

// Module-level guard: only attempt the unforced bootstrap once per page load.
// Per T-0016-063, this flag MUST be set to true ONLY after a confirmed 200.
let csrfBootstrapped = false

/**
 * Mint the csrf-token cookie by calling /api/auth?action=user with the
 * localStorage access token. The endpoint mints csrf-token if it's missing.
 *
 * @param force - Bypass the `csrfBootstrapped` module guard. Used by the
 *   in-session 403 CSRF_COOKIE_MISSING re-mint path (ADR-0016 Step 2).
 */
export async function bootstrapCsrfCookie(force: boolean = false): Promise<BootstrapCsrfOutcome> {
  if (!force && csrfBootstrapped) return 'ok'
  if (typeof document === 'undefined') return 'ok'
  // Cookie presence check must verify a NON-EMPTY value, not just the prefix.
  // Browsers can leave a cookie key with an empty value after eviction; the
  // prior `startsWith('csrf-token=')` check returned true for `csrf-token=`,
  // causing the bootstrap to be skipped without a usable token (Poirot #8).
  const csrfCookieHasValue = document.cookie.split(';').some(c => {
    const trimmed = c.trim()
    if (!trimmed.startsWith('csrf-token=')) return false
    const value = trimmed.slice('csrf-token='.length)
    return value.length > 0
  })
  if (csrfCookieHasValue) {
    csrfBootstrapped = true
    return 'ok'
  }

  const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
  if (!stored) return 'retryable'

  let token: string | undefined
  try {
    const parsed = JSON.parse(stored)
    token = parsed?.access_token
  } catch {
    return 'retryable'
  }
  if (!token) return 'retryable'

  try {
    const response = await fetch('/api/auth?action=user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })

    if (response.ok) {
      csrfBootstrapped = true
      return 'ok'
    }

    if (response.status === 401) {
      const { data: refreshData } = await supabase.auth.refreshSession()
      const freshToken = refreshData?.session?.access_token
      if (!freshToken) return 'terminal'

      const retryResponse = await fetch('/api/auth?action=user', {
        headers: {
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })

      if (retryResponse.ok) {
        csrfBootstrapped = true
        return 'ok'
      }
      if (retryResponse.status === 401) return 'terminal'
      return 'retryable'
    }

    logger.warn('CSRF bootstrap non-OK response', { status: response.status })
    // Non-401 4xx are client-fault terminal-class outcomes (e.g. 403 forbidden,
    // 404 endpoint missing) and will not recover on retry. 5xx are server-fault
    // and may recover, so they remain 'retryable' (Poirot #7). T-0016-009
    // covers the 500 case.
    if (response.status >= 400 && response.status < 500) {
      return 'terminal'
    }
    return 'retryable'
  } catch (e) {
    logger.warn('CSRF bootstrap failed', e)
    return 'retryable'
  }
}
