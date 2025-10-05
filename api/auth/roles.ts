/* eslint-disable no-console */
import { sanitizeUserId, ensureUUID } from '../../src/utils/uuid'

export type UserRole = 'user' | 'admin' | 'super_admin'

interface UserProfile {
  id: string
  email: string
  role: UserRole
  full_name?: string
  avatar_url?: string
  created_at?: string
  updated_at?: string
}

// Server-side role management - secure and centralized
const ADMIN_EMAILS = new Set([
  'admin@prioritas.com',
  'manager@company.com'
])

const SUPER_ADMIN_EMAILS = new Set([
  'admin@prioritas.com'
])

// Determine user role based on server-side configuration
export function determineUserRole(email: string): UserRole {
  if (SUPER_ADMIN_EMAILS.has(email.toLowerCase())) {
    return 'super_admin'
  }
  if (ADMIN_EMAILS.has(email.toLowerCase())) {
    return 'admin'
  }
  return 'user'
}

// PERFORMANCE: Ultra-optimized user profile retrieval with aggressive caching
export async function getUserProfile(userId: string, userEmail: string): Promise<UserProfile> {
  const profileStart = performance.now()

  try {
    // Validate and sanitize user ID
    const validUserId = sanitizeUserId(userId) || ensureUUID(userId)
    if (!validUserId || !isValidUUID(validUserId)) {
      console.warn(`Invalid user ID format, creating fallback profile: ${userId}`)
      // Return fallback profile for invalid UUID
      const fallbackProfile: UserProfile = {
        id: ensureUUID(userId),
        email: userEmail,
        role: determineUserRole(userEmail),
        full_name: userEmail.split('@')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      return fallbackProfile
    }

    // Use optimized query system with connection pooling
    const profileData = await optimizedGetUserProfile(validUserId, userEmail)

    if (profileData) {
      // Ensure role is current (without expensive update queries)
      const expectedRole = determineUserRole(userEmail)
      const finalProfile = {
        ...profileData,
        role: expectedRole // Use server-determined role for consistency
      }

      const profileTime = performance.now() - profileStart
      console.log(`Profile retrieved (optimized): ${profileTime.toFixed(1)}ms`)
      return finalProfile
    }

    // If query optimizer returned null, create fallback immediately
    const fallbackProfile: UserProfile = {
      id: validUserId,
      email: userEmail,
      role: determineUserRole(userEmail),
      full_name: userEmail.split('@')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const profileTime = performance.now() - profileStart
    console.log(`Profile fallback created: ${profileTime.toFixed(1)}ms`)
    return fallbackProfile

  } catch (error) {
    const profileTime = performance.now() - profileStart
    console.warn(`Profile error, using fallback (${profileTime.toFixed(1)}ms):`, error)

    // Always return a valid profile to prevent auth failures
    const fallbackUserId = sanitizeUserId(userId) || ensureUUID(userId)
    return {
      id: fallbackUserId,
      email: userEmail,
      role: determineUserRole(userEmail),
      full_name: userEmail.split('@')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }
}

// Clean up expired server profile cache entries
setInterval(() => {
  const now = Date.now()
  for (const [key, cached] of serverProfileCache.entries()) {
    if (now > cached.expires) {
      serverProfileCache.delete(key)
    }
  }
}, 60000) // Clean up every minute

// Note: This file provides getUserProfile function for other API endpoints
// The main user API endpoint is in /api/auth/user.ts

// Role validation helpers
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = { user: 0, admin: 1, super_admin: 2 }
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

export function requireRole(requiredRole: UserRole) {
  return async (req: VercelRequest, res: VercelResponse, next: () => void) => {
    const { user, error } = await authenticate(req)
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const profile = await getUserProfile(user.id, user.email || '')
    if (!hasRole(profile.role, requiredRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Add user profile to request
    ;(req as any).userProfile = profile
    next()
  }
}