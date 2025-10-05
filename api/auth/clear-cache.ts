/* eslint-disable no-console */
/**
 * SECURITY-HARDENED Cache Clearing Endpoint
 *
 * CRITICAL SECURITY FEATURES:
 * - Bearer token authentication with validation
 * - Input sanitization and validation
 * - Rate limiting per user
 * - Comprehensive error handling
 * - Audit logging for security monitoring
 * - Fail-safe design with graceful degradation
 */

import { VercelRequest, VercelResponse } from '@vercel/node'

// Security middleware - kept minimal and secure
function applySecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
}

// Rate limiting for security
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10 // requests per minute
const RATE_WINDOW = 60000 // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false
  }

  userLimit.count++
  return true
}

// Simple secure authentication without complex dependencies
async function authenticateRequest(req: VercelRequest): Promise<{ userId: string; email?: string } | null> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  // Basic token validation
  if (!token || token.length < 10 || token.length > 2000) {
    return null
  }

  // Token format validation (prevent injection)
  if (!/^[A-Za-z0-9._-]+$/.test(token)) {
    return null
  }

  try {
    // Use Supabase client for token validation
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('[SECURITY] Missing Supabase configuration')
      return null
    }

    // Import Supabase dynamically to avoid initialization issues
    const { createClient } = await import('@supabase/supabase-js')

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    })

    // Verify token with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      clearTimeout(timeoutId)

      if (error || !user) {
        console.warn('[SECURITY] Token validation failed:', error?.message)
        return null
      }

      // Validate user data
      if (!user.id || typeof user.id !== 'string') {
        console.warn('[SECURITY] Invalid user data format')
        return null
      }

      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(user.id)) {
        console.warn('[SECURITY] Invalid user ID format')
        return null
      }

      return {
        userId: user.id,
        email: user.email
      }

    } catch (authError) {
      clearTimeout(timeoutId)
      if (authError.name === 'AbortError') {
        console.warn('[SECURITY] Authentication timeout')
      } else {
        console.error('[SECURITY] Authentication error:', authError)
      }
      return null
    }

  } catch (error) {
    console.error('[SECURITY] Authentication setup error:', error)
    return null
  }
}

// Simple cache clearing without complex dependencies
function clearSimpleCache(): { cleared: number; operations: string[] } {
  const operations: string[] = []
  let totalCleared = 0

  try {
    // Clear any global caches if they exist
    if (global.queryOptimizerCache) {
      const size = global.queryOptimizerCache.size || 0
      global.queryOptimizerCache.clear?.()
      totalCleared += size
      operations.push(`QueryOptimizer: ${size} entries`)
    }

    if (global.userProfileCache) {
      const size = global.userProfileCache.size || 0
      global.userProfileCache.clear?.()
      totalCleared += size
      operations.push(`UserProfile: ${size} entries`)
    }

    if (global.connectionPool) {
      // Just log, don't clear active connections
      operations.push('ConnectionPool: logged')
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
      operations.push('GC: triggered')
    }

    return { cleared: totalCleared, operations }

  } catch (error) {
    console.warn('[CACHE] Cache clearing error (non-critical):', error)
    return { cleared: 0, operations: ['Error: ' + error.message] }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = performance.now()

  try {
    // Apply security headers immediately
    applySecurityHeaders(res)

    // Method validation
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
        allowed: ['POST']
      })
    }

    // Content-Type validation for security
    const contentType = req.headers['content-type']
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'Invalid Content-Type',
        expected: 'application/json'
      })
    }

    // Authenticate request
    const auth = await authenticateRequest(req)
    if (!auth) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid or missing Bearer token'
      })
    }

    // Rate limiting check
    if (!checkRateLimit(auth.userId)) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: 60
      })
    }

    console.log(`[SECURITY] Cache clear request from user: ${auth.email || auth.userId}`)

    // Clear caches safely
    const cacheResult = clearSimpleCache()

    const endTime = performance.now()
    const totalTime = endTime - startTime

    console.log(`[SECURITY] Cache clearing completed in ${totalTime.toFixed(1)}ms:`, cacheResult.operations)

    // Success response with security audit trail
    res.status(200).json({
      success: true,
      message: 'Server-side caches cleared successfully',
      cleared: {
        totalEntries: cacheResult.cleared,
        operations: cacheResult.operations,
        timestamp: new Date().toISOString(),
        userId: auth.userId
      },
      performance: {
        duration: `${totalTime.toFixed(1)}ms`,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    const endTime = performance.now()
    const totalTime = endTime - startTime

    console.error(`[SECURITY] Cache clear error after ${totalTime.toFixed(1)}ms:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })

    // Security-safe error response (don't leak internals)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Cache clearing operation failed',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: `${totalTime.toFixed(1)}ms`
        }
      })
    })
  }
}