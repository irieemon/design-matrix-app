/**
 * Authenticated Supabase Client Factory
 *
 * Creates Supabase clients with user authentication that enforce Row-Level Security (RLS).
 * This replaces direct supabaseAdmin usage to restore defense-in-depth security.
 *
 * SECURITY: Part of RLS restoration (Phase 3)
 * - Uses access tokens from httpOnly cookies
 * - Enforces Row-Level Security policies
 * - Provides proper user context for database operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Create an authenticated Supabase client with user session
 *
 * @param accessToken - JWT access token from httpOnly cookie
 * @returns Supabase client with authenticated session that enforces RLS
 *
 * @example
 * // In API endpoint
 * const accessToken = getCookie(req, 'sb-access-token')
 * const supabase = createAuthenticatedClient(accessToken)
 *
 * // In service layer
 * const ideas = await ideaService.getIdeasByProject(projectId, supabase)
 */
export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  if (!accessToken) {
    logger.warn('⚠️ createAuthenticatedClient called without access token')
    throw new Error('Access token is required for authenticated client')
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error('❌ Missing Supabase environment variables')
    throw new Error('Supabase configuration is incomplete')
  }

  // Create client with user session
  // Use unique storage key to prevent "Multiple GoTrueClient instances" warning
  const uniqueStorageKey = `sb-auth-${accessToken.substring(0, 8)}`

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storage: undefined,
      storageKey: uniqueStorageKey, // Unique key per authenticated client
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }
  })

  logger.debug('🔐 Created authenticated Supabase client with RLS enforcement')

  return client
}

/**
 * Create an authenticated client from request context
 *
 * Extracts access token from httpOnly cookie and creates authenticated client.
 * Used in API endpoints that need to perform database operations.
 *
 * @param req - Next.js API request object with cookies
 * @returns Authenticated Supabase client or null if no valid token
 *
 * @example
 * // In API route
 * export default async function handler(req, res) {
 *   const supabase = createClientFromRequest(req)
 *   if (!supabase) {
 *     return res.status(401).json({ error: 'Unauthorized' })
 *   }
 *   // Use supabase client with RLS enforcement
 * }
 */
export function createClientFromRequest(req: any): SupabaseClient | null {
  try {
    // Extract access token from httpOnly cookie
    const accessToken = extractAccessToken(req)

    if (!accessToken) {
      logger.debug('⚠️ No access token found in request')
      return null
    }

    return createAuthenticatedClient(accessToken)
  } catch (_error) {
    logger.error('❌ Failed to create client from request:', error)
    return null
  }
}

/**
 * Extract access token from request cookies
 *
 * @param req - Request object with cookies
 * @returns Access token string or null
 */
function extractAccessToken(req: any): string | null {
  // Try multiple cookie parsing methods for compatibility

  // Method 1: Pre-parsed cookies object
  if (req.cookies && req.cookies['sb-access-token']) {
    return req.cookies['sb-access-token']
  }

  // Method 2: Raw cookie header parsing
  if (req.headers && req.headers.cookie) {
    const cookies = parseCookieHeader(req.headers.cookie)
    if (cookies['sb-access-token']) {
      return cookies['sb-access-token']
    }
  }

  return null
}

/**
 * Parse cookie header string into key-value pairs
 *
 * @param cookieHeader - Raw Cookie header string
 * @returns Object with cookie key-value pairs
 */
function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=')
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim()
    }
  })

  return cookies
}

/**
 * Validate that a client is authenticated
 *
 * Checks if the client has valid user session.
 *
 * @param client - Supabase client to validate
 * @returns Promise<boolean> - true if authenticated, false otherwise
 */
export async function isClientAuthenticated(client: SupabaseClient): Promise<boolean> {
  try {
    const { data: { user }, error } = await client.auth.getUser()

    if (error || !user) {
      logger.debug('⚠️ Client authentication check failed:', error?.message || 'No user')
      return false
    }

    logger.debug('✅ Client is authenticated:', user.id)
    return true
  } catch (_error) {
    logger.error('❌ Error checking client authentication:', error)
    return false
  }
}

/**
 * Get user ID from authenticated client
 *
 * @param client - Authenticated Supabase client
 * @returns User ID or null if not authenticated
 */
export async function getUserIdFromClient(client: SupabaseClient): Promise<string | null> {
  try {
    const { data: { user }, error } = await client.auth.getUser()

    if (error || !user) {
      return null
    }

    return user.id
  } catch (_error) {
    logger.error('❌ Error getting user ID from client:', error)
    return null
  }
}
