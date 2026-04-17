/**
 * Authentication Header Utilities
 *
 * Provides helpers for adding authentication headers to API requests.
 * Both helpers read tokens from localStorage via the lock-free path shared
 * with `createAuthenticatedClientFromLocalStorage` — callers avoid the
 * GoTrueClient navigator.locks deadlock that the SDK session-read APIs can
 * trigger during auth hydration.
 */

import {
  createAuthenticatedClientFromLocalStorage,
  getAuthTokensFromLocalStorage
} from './supabase'

// Re-exported so callers that need both an authenticated client and auth
// headers can import from a single boundary instead of going directly to
// supabase.ts. The import is also required by the Wave A structural contract
// (T-0017-A18) which verifies the lock-free helper is wired into this module.
export { createAuthenticatedClientFromLocalStorage }

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json'
}

/**
 * Get authentication headers for API requests.
 *
 * Async shape retained for backwards compatibility with existing callers;
 * internally reads the access token from localStorage synchronously.
 *
 * @returns Headers object with Authorization if user is authenticated
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  return getAuthHeadersSync()
}

/**
 * Get synchronous auth headers from localStorage.
 *
 * @returns Headers object with Authorization if token exists in localStorage
 */
export function getAuthHeadersSync(): HeadersInit {
  const { accessToken } = getAuthTokensFromLocalStorage()

  if (!accessToken) {
    return { ...JSON_HEADERS }
  }

  return {
    ...JSON_HEADERS,
    Authorization: `Bearer ${accessToken}`
  }
}
