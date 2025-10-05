/* eslint-disable no-console */
import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import validator from 'validator'
import { isValidUUID, sanitizeUserId } from '../../src/utils/uuid'

// Create optimized Supabase client for server-side auth verification
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  // Optimize for server-side performance
  auth: {
    autoRefreshToken: false, // Server doesn't need auto-refresh
    persistSession: false,   // Server doesn't need session persistence
    detectSessionInUrl: false // Server doesn't need URL detection
  },
  // PERFORMANCE: Aggressive connection pooling optimizations
  global: {
    headers: {
      'Connection': 'keep-alive',
      'Keep-Alive': 'timeout=2, max=1000',  // Faster timeout, more connections
      'Cache-Control': 'no-store'            // Prevent stale cached responses
    }
  },
  // PERFORMANCE: Database connection optimizations
  db: {
    schema: 'public'
  }
})

// Token validation cache to reduce repeated Supabase calls
const tokenCache = new Map<string, { user: any; timestamp: number; expires: number }>()
const TOKEN_CACHE_DURATION = 60 * 1000 // 1 minute cache

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string
    email?: string
  }
}

// Session security
export function validateSession(req: VercelRequest): boolean {
  const userAgent = req.headers['user-agent']
  const xForwardedFor = req.headers['x-forwarded-for']

  // Basic bot detection
  if (!userAgent || userAgent.length < 10) {
    return false
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i
  ]

  if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    return false
  }

  return true
}

export async function authenticate(req: VercelRequest): Promise<{ user: { id: string; email?: string } | null; error?: string }> {
  const authStart = performance.now()

  try {
    // Get the authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'Missing or invalid authorization header' }
    }

    // Extract and validate the token
    const token = authHeader.substring(7)

    // Basic token format validation
    if (!token || token.length < 10 || token.length > 2000) {
      return { user: null, error: 'Invalid token format' }
    }

    // Check for suspicious patterns
    if (!/^[A-Za-z0-9._-]+$/.test(token)) {
      return { user: null, error: 'Invalid token format' }
    }

    // Check cache first to avoid repeated Supabase calls
    const cached = tokenCache.get(token)
    if (cached && Date.now() < cached.expires) {
      const authTime = performance.now() - authStart
      console.log(`Auth cache hit: ${authTime.toFixed(1)}ms`)
      const cachedUserId = sanitizeUserId(cached.user.id)
      if (!cachedUserId) {
        tokenCache.delete(token) // Remove invalid cached entry
        return { user: null, error: 'Invalid cached user ID format' }
      }

      return {
        user: {
          id: cachedUserId,
          email: cached.user.email ? validator.normalizeEmail(cached.user.email) || cached.user.email : undefined
        },
        error: undefined
      }
    }

    // PERFORMANCE: Verify token with aggressive timeout optimization
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 400) // OPTIMIZED: 400ms timeout

    let result
    try {
      result = await supabase.auth.getUser(token)
      clearTimeout(timeoutId)
    } catch (error) {
      if (error.name === 'AbortError') {
        return { user: null, error: 'Authentication timeout' }
      }
      throw error
    }

    const { data: { user }, error } = result

    if (error || !user) {
      return { user: null, error: 'Invalid or expired token' }
    }

    // Validate user data and UUID format
    if (!user.id || typeof user.id !== 'string') {
      return { user: null, error: 'Invalid user data' }
    }

    // Validate UUID format for user ID
    const sanitizedUserId = sanitizeUserId(user.id)
    if (!sanitizedUserId) {
      return { user: null, error: 'Invalid user ID format - must be a valid UUID' }
    }

    // Cache the successful result
    tokenCache.set(token, {
      user,
      timestamp: Date.now(),
      expires: Date.now() + TOKEN_CACHE_DURATION
    })

    const authTime = performance.now() - authStart
    console.log(`Auth verified: ${authTime.toFixed(1)}ms`)

    return {
      user: {
        id: sanitizedUserId,
        email: user.email ? validator.normalizeEmail(user.email) || user.email : undefined
      },
      error: undefined
    }
  } catch (error) {
    const authTime = performance.now() - authStart
    console.error(`Authentication error (${authTime.toFixed(1)}ms):`, error)
    return { user: null, error: 'Authentication failed' }
  }
}

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now()
  for (const [token, cached] of Array.from(tokenCache.entries())) {
    if (now > cached.expires) {
      tokenCache.delete(token)
    }
  }
}, 60000) // Clean up every minute

// Rate limiting with per-user tracking
const userRateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Security middleware
export function securityMiddleware(req: VercelRequest, res: VercelResponse, next?: () => void) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Validate Content-Type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
    const contentType = req.headers['content-type']
    if (!contentType || !contentType.includes('application/json')) {
      res.status(400).json({ error: 'Content-Type must be application/json' })
      return
    }
  }

  // Validate Content-Length
  const contentLength = parseInt(req.headers['content-length'] || '0')
  if (contentLength > 10 * 1024 * 1024) { // 10MB limit
    res.status(413).json({ error: 'Request body too large' })
    return
  }

  if (next) next()
}

// Request sanitization
export function sanitizeRequest(req: VercelRequest): void {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Basic XSS prevention
        req.body[key] = req.body[key].replace(/<script[^>]*>.*?<\/script>/gi, '')
        req.body[key] = req.body[key].replace(/javascript:/gi, '')
        req.body[key] = req.body[key].replace(/on\w+=/gi, '')
      }
    }
  }
}

export function checkUserRateLimit(userId: string, limit: number = 10, windowMs: number = 60000): boolean {
  // Sanitize userId to prevent injection attacks
  const sanitizedUserId = validator.escape(String(userId)).substring(0, 100)

  const now = Date.now()
  const userLimit = userRateLimitStore.get(sanitizedUserId)

  if (!userLimit || now > userLimit.resetTime) {
    userRateLimitStore.set(sanitizedUserId, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (userLimit.count >= limit) {
    return false
  }

  userLimit.count++
  return true
}