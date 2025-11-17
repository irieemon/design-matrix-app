/**
 * Authentication Header Utilities
 *
 * Provides helpers for adding authentication headers to API requests
 */

import { supabase } from './supabase'

/**
 * Get authentication headers for API requests
 * Supports both Authorization header (from Supabase session) and cookies
 *
 * @returns Headers object with Authorization if user is authenticated
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  try {
    // Get current session from Supabase
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch (error) {
    console.error('Failed to get auth session:', error)
  }

  return headers
}

/**
 * Get synchronous auth headers from localStorage
 * Faster alternative that doesn't require async session fetch
 *
 * @returns Headers object with Authorization if token exists in localStorage
 */
export function getAuthHeadersSync(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  try {
    // Read access token directly from localStorage (synchronous)
    const authData = localStorage.getItem('sb-vfovtgtjailvrphsgafv-auth-token')
    if (authData) {
      const parsed = JSON.parse(authData)
      const accessToken = parsed?.access_token
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }
    }
  } catch (error) {
    console.error('Failed to get auth token from localStorage:', error)
  }

  return headers
}
