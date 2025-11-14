/**
 * Consolidated Auth API Routes
 *
 * Consolidates all auth routes into a single serverless function:
 * - POST   /api/auth?action=session (login)
 * - DELETE /api/auth?action=session (logout)
 * - POST   /api/auth?action=refresh (refresh token)
 * - GET    /api/auth?action=user (get user profile)
 * - POST   /api/auth?action=clear-cache (clear server caches)
 * - GET    /api/auth?action=performance (performance metrics)
 * - GET    /api/auth?action=roles (user roles - via getUserProfile)
 * - POST   /api/auth?action=admin-verify (verify admin status)
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  setAuthCookies,
  clearAuthCookies,
  generateCSRFToken,
  getCookie,
  COOKIE_NAMES,
  withRateLimit,
  withAuth,
  withCSRF,
  compose,
  type AuthenticatedRequest,
} from './_lib/middleware/index.js'
import { optimizedGetUserProfile } from './_lib/utils/queryOptimizer.js'

// Alias for compatibility
const getUserProfile = optimizedGetUserProfile
import { finishAuthSession, recordAuthMetric } from './_lib/utils/performanceMonitor.js'
import { createPerformanceLogger, createRequestLogger } from './_lib/utils/logger.js'
import { getPerformanceMonitor } from './_lib/utils/performanceMonitor.js'
import { getConnectionPool } from './_lib/utils/connectionPool.js'
import { getQueryOptimizer } from './_lib/utils/queryOptimizer.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ============================================================================
// SESSION HANDLERS (login/logout/signup)
// ============================================================================

async function handleSignup(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, password, full_name } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required',
          code: 'VALIDATION_ERROR',
        },
        timestamp: new Date().toISOString(),
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: {
          message: 'Password must be at least 8 characters',
          code: 'WEAK_PASSWORD',
        },
        timestamp: new Date().toISOString(),
      })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name || email.split('@')[0],
        },
      },
    })

    if (error) {
      console.error('Signup error:', error)
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'SIGNUP_ERROR',
        },
        timestamp: new Date().toISOString(),
      })
    }

    if (!data.user) {
      return res.status(500).json({
        error: {
          message: 'User creation failed',
          code: 'USER_CREATION_FAILED',
        },
        timestamp: new Date().toISOString(),
      })
    }

    if (!data.session) {
      return res.status(200).json({
        success: true,
        message: 'Please check your email to confirm your account',
        requiresEmailConfirmation: true,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        timestamp: new Date().toISOString(),
      })
    }

    const csrfToken = generateCSRFToken()

    setAuthCookies(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      csrfToken,
    })

    return res.status(201).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      },
      csrfToken,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Signup handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error during signup',
        code: 'SIGNUP_ERROR',
      },
      timestamp: new Date().toISOString(),
    })
  }
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required',
          code: 'MISSING_CREDENTIALS',
        },
        timestamp: new Date().toISOString(),
      })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session) {
      console.error('Login error:', error)
      return res.status(401).json({
        error: {
          message: error?.message || 'Invalid credentials',
          code: 'LOGIN_FAILED',
        },
        timestamp: new Date().toISOString(),
      })
    }

    const csrfToken = generateCSRFToken()

    setAuthCookies(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      csrfToken,
    })

    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || data.user.email,
        avatar_url: data.user.user_metadata?.avatar_url || null,
        role: data.user.role || 'user',
        created_at: data.user.created_at,
        updated_at: data.user.updated_at,
      },
      expiresAt: data.session.expires_at,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Login handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error during login',
        code: 'LOGIN_ERROR',
      },
      timestamp: new Date().toISOString(),
    })
  }
}

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  try {
    const accessToken = getCookie(req, COOKIE_NAMES.ACCESS_TOKEN)

    if (accessToken) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      })

      await supabase.auth.signOut()
    }

    clearAuthCookies(res)

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Logout handler error:', error)
    clearAuthCookies(res)

    return res.status(200).json({
      success: true,
      message: 'Logged out (with errors)',
      timestamp: new Date().toISOString(),
    })
  }
}

// ============================================================================
// REFRESH TOKEN HANDLER
// ============================================================================

async function handleRefresh(req: VercelRequest, res: VercelResponse) {
  try {
    const refreshToken = getCookie(req, COOKIE_NAMES.REFRESH_TOKEN)

    if (!refreshToken) {
      clearAuthCookies(res)

      return res.status(401).json({
        error: {
          message: 'No refresh token provided',
          code: 'REFRESH_TOKEN_MISSING',
        },
        timestamp: new Date().toISOString(),
      })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session) {
      console.error('Token refresh error:', error)
      clearAuthCookies(res)

      return res.status(401).json({
        error: {
          message: error?.message || 'Token refresh failed',
          code: 'REFRESH_FAILED',
        },
        timestamp: new Date().toISOString(),
      })
    }

    const csrfToken = generateCSRFToken()

    setAuthCookies(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      csrfToken,
    })

    return res.status(200).json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        metadata: data.user?.user_metadata,
      },
      expiresAt: data.session?.expires_at,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Refresh handler error:', error)
    clearAuthCookies(res)

    return res.status(500).json({
      error: {
        message: 'Internal server error during token refresh',
        code: 'REFRESH_ERROR',
      },
      timestamp: new Date().toISOString(),
    })
  }
}

// ============================================================================
// USER PROFILE HANDLER
// ============================================================================

async function handleGetUser(req: AuthenticatedRequest, res: VercelResponse) {
  const startTime = performance.now()
  const logger = createPerformanceLogger(req, 'auth/user', startTime)

  try {
    if (process.env.NODE_ENV === 'development' && req.user) {
      logger.debug('Processing request', {
        userAgent: req.headers['user-agent']?.substring(0, 30),
        userId: req.user.id
      })
    }

    const user = req.user
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const profileStart = performance.now()
    const profile = await getUserProfile(user.id, user.email)
    const profileTime = performance.now() - profileStart

    const endTime = performance.now()
    const totalTime = endTime - startTime

    if (totalTime > 500 || process.env.NODE_ENV === 'development') {
      console.log(`[API /auth/user] ${totalTime > 500 ? 'SLOW' : 'Success'} - ${totalTime.toFixed(1)}ms (profile: ${profileTime.toFixed(1)}ms)`)
    }

    res.status(200).json({
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }
    })
  } catch (error) {
    const endTime = performance.now()
    const totalTime = endTime - startTime
    finishAuthSession(`user_${Date.now()}`, false)
    recordAuthMetric('user_endpoint_error', totalTime, false)

    console.error(`[API /auth/user] Error after ${totalTime.toFixed(1)}ms:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?.id || 'unknown'
    })

    res.status(500).json({
      error: 'Failed to get user data',
      ...(process.env.NODE_ENV === 'development' && {
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    })
  }
}

// ============================================================================
// CLEAR CACHE HANDLER
// ============================================================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW = 60000

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

async function authenticateClearCache(req: VercelRequest): Promise<{ userId: string; email?: string } | null> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  if (!token || token.length < 10 || token.length > 2000) {
    return null
  }

  if (!/^[A-Za-z0-9._-]+$/.test(token)) {
    return null
  }

  try {
    const { createClient } = await import('@supabase/supabase-js')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      clearTimeout(timeoutId)

      if (error || !user) {
        return null
      }

      if (!user.id || typeof user.id !== 'string') {
        return null
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(user.id)) {
        return null
      }

      return {
        userId: user.id,
        email: user.email
      }

    } catch (authError) {
      clearTimeout(timeoutId)
      return null
    }

  } catch (error) {
    console.error('[SECURITY] Authentication setup error:', error)
    return null
  }
}

function clearSimpleCache(): { cleared: number; operations: string[] } {
  const operations: string[] = []
  let totalCleared = 0

  try {
    if ((globalThis as any).queryOptimizerCache) {
      const size = (globalThis as any).queryOptimizerCache.size || 0;
      (globalThis as any).queryOptimizerCache.clear?.()
      totalCleared += size
      operations.push(`QueryOptimizer: ${size} entries`)
    }

    if ((globalThis as any).userProfileCache) {
      const size = (globalThis as any).userProfileCache.size || 0;
      (globalThis as any).userProfileCache.clear?.()
      totalCleared += size
      operations.push(`UserProfile: ${size} entries`)
    }

    if ((globalThis as any).connectionPool) {
      operations.push('ConnectionPool: logged')
    }

    if ((globalThis as any).gc) {
      (globalThis as any).gc()
      operations.push('GC: triggered')
    }

    return { cleared: totalCleared, operations }

  } catch (error) {
    console.warn('[CACHE] Cache clearing error (non-critical):', error)
    return { cleared: 0, operations: ['Error: ' + (error as Error).message] }
  }
}

async function handleClearCache(req: VercelRequest, res: VercelResponse) {
  const startTime = performance.now()

  try {
    const contentType = req.headers['content-type']
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'Invalid Content-Type',
        expected: 'application/json'
      })
    }

    const auth = await authenticateClearCache(req)
    if (!auth) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Invalid or missing Bearer token'
      })
    }

    if (!checkRateLimit(auth.userId)) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: 60
      })
    }

    console.log(`[SECURITY] Cache clear request from user: ${auth.email || auth.userId}`)

    const cacheResult = clearSimpleCache()

    const endTime = performance.now()
    const totalTime = endTime - startTime

    console.log(`[SECURITY] Cache clearing completed in ${totalTime.toFixed(1)}ms:`, cacheResult.operations)

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

// ============================================================================
// PERFORMANCE METRICS HANDLER
// ============================================================================

function calculateHealthScore(dashboardData: any, poolStats: any, cacheStats: any): number {
  let score = 100

  const avgAuthTimeMs = parseFloat(dashboardData.kpis.avgAuthTime) || 0
  const successRate = parseFloat(dashboardData.kpis.authSuccessRate) / 100 || 0

  if (avgAuthTimeMs > 2000) score -= 20
  else if (avgAuthTimeMs > 1000) score -= 10
  else if (avgAuthTimeMs > 500) score -= 5

  if (successRate < 0.95) score -= 20
  else if (successRate < 0.98) score -= 10

  const utilizationRate = poolStats.inUseConnections / poolStats.totalConnections
  if (utilizationRate > 0.9) score -= 15
  else if (utilizationRate > 0.7) score -= 5

  if (poolStats.queuedRequests > 10) score -= 10
  else if (poolStats.queuedRequests > 5) score -= 5

  if (cacheStats.hitRate < 0.7) score -= 10
  else if (cacheStats.hitRate < 0.8) score -= 5

  score -= Math.min(dashboardData.alerts.length * 3, 10)

  return Math.max(0, Math.min(100, Math.round(score)))
}

async function handlePerformance(req: VercelRequest, res: VercelResponse) {
  const logger = createRequestLogger(req, 'auth/performance')

  try {
    const authHeader = req.headers.authorization
    const isAuthorized = authHeader && (
      authHeader.includes('admin') ||
      req.headers['x-admin-key'] === process.env.ADMIN_MONITORING_KEY
    )

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized - admin access required' })
    }

    const monitor = getPerformanceMonitor()
    const pool = getConnectionPool()
    const optimizer = getQueryOptimizer()

    const dashboardData = monitor.getDashboardData()
    const poolStats = pool.getStats()
    const cacheStats = optimizer.getCacheStats()
    const queryMetrics = optimizer.getMetrics()

    const healthScore = calculateHealthScore(dashboardData, poolStats, cacheStats)

    const performanceReport = {
      timestamp: new Date().toISOString(),
      status: dashboardData.status,
      healthScore,

      authentication: {
        successRate: dashboardData.kpis.authSuccessRate,
        avgResponseTime: dashboardData.kpis.avgAuthTime,
        totalRequests: dashboardData.kpis.totalRequests,
        activeBottlenecks: dashboardData.kpis.activeBottlenecks
      },

      connectionPool: {
        totalConnections: poolStats.totalConnections,
        activeConnections: poolStats.inUseConnections,
        availableConnections: poolStats.availableConnections,
        queuedRequests: poolStats.queuedRequests,
        utilizationRate: `${((poolStats.inUseConnections / poolStats.totalConnections) * 100).toFixed(1)}%`
      },

      queryCache: {
        size: cacheStats.size,
        hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
        memoryUsage: cacheStats.memoryUsage
      },

      trends: dashboardData.trends,
      alerts: dashboardData.alerts,
      recommendations: dashboardData.recommendations,

      detailedMetrics: process.env.NODE_ENV === 'development' ? {
        queryMetrics,
        rawDashboardData: dashboardData
      } : undefined
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Content-Type', 'application/json')

    logger.info('Performance dashboard data retrieved', {
      statusCode: 200,
      healthScore,
      authSuccessRate: dashboardData.kpis.authSuccessRate,
      activeConnections: poolStats.inUseConnections,
      cacheHitRate: cacheStats.hitRate
    })

    res.status(200).json(performanceReport)

  } catch (error) {
    logger.error('Performance dashboard error', error, {
      statusCode: 500
    })
    res.status(500).json({
      error: 'Performance monitoring unavailable',
      timestamp: new Date().toISOString()
    })
  }
}

// ============================================================================
// ADMIN VERIFICATION HANDLER
// ============================================================================

const ADMIN_CAPABILITIES = {
  admin: [
    'view_all_users',
    'view_all_projects',
    'update_user_status',
    'view_platform_stats',
  ],
  super_admin: [
    'view_all_users',
    'view_all_projects',
    'update_user_status',
    'view_platform_stats',
    'update_user_roles',
    'delete_any_project',
    'system_administration',
  ],
} as const

async function handleAdminVerify(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const userId = req.user!.id

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, email, role, full_name')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      console.error('Admin verification error:', error)
      return res.status(403).json({
        error: {
          message: 'Unable to verify admin status',
          code: 'VERIFICATION_FAILED',
        },
        timestamp: new Date().toISOString(),
      })
    }

    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
    const isSuperAdmin = profile.role === 'super_admin'

    if (!isAdmin) {
      await supabase.from('admin_audit_log').insert({
        user_id: userId,
        action: 'ADMIN_ACCESS_DENIED',
        resource: '/api/auth?action=admin-verify',
        is_admin: false,
        timestamp: new Date().toISOString(),
        ip_address: req.headers['x-forwarded-for'] as string || null,
        user_agent: req.headers['user-agent'] || null,
        metadata: {
          reason: 'Non-admin user attempted admin verification',
        },
      })

      return res.status(403).json({
        error: {
          message: 'Admin access required',
          code: 'NOT_ADMIN',
        },
        timestamp: new Date().toISOString(),
      })
    }

    const capabilities = isSuperAdmin
      ? ADMIN_CAPABILITIES.super_admin
      : ADMIN_CAPABILITIES.admin

    await supabase.from('admin_audit_log').insert({
      user_id: userId,
      action: 'ADMIN_VERIFIED',
      resource: '/api/auth?action=admin-verify',
      is_admin: true,
      timestamp: new Date().toISOString(),
      ip_address: req.headers['x-forwarded-for'] as string || null,
      user_agent: req.headers['user-agent'] || null,
      metadata: {
        role: profile.role,
        capabilities: capabilities.length,
      },
    })

    return res.status(200).json({
      success: true,
      isAdmin: true,
      isSuperAdmin,
      capabilities: Array.from(capabilities),
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.full_name,
      },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Admin verify handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error during admin verification',
        code: 'VERIFICATION_ERROR',
      },
      timestamp: new Date().toISOString(),
    })
  }
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

async function authRouter(req: VercelRequest, res: VercelResponse) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Extract action from query parameter
  const action = (req.query.action as string) || ''

  // Route based on action
  switch (action) {
    case 'signup':
      if (req.method !== 'POST') {
        return res.status(405).json({
          error: {
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
            allowed: ['POST'],
          },
          timestamp: new Date().toISOString(),
        })
      }
      return handleSignup(req, res)

    case 'session':
      if (req.method === 'POST') {
        return handleLogin(req, res)
      }
      if (req.method === 'DELETE') {
        return handleLogout(req, res)
      }
      return res.status(405).json({
        error: {
          message: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED',
          allowed: ['POST', 'DELETE'],
        },
        timestamp: new Date().toISOString(),
      })

    case 'refresh':
      if (req.method !== 'POST') {
        return res.status(405).json({
          error: {
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
            allowed: ['POST'],
          },
          timestamp: new Date().toISOString(),
        })
      }
      return handleRefresh(req, res)

    case 'user':
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
      }
      // Apply auth middleware manually
      return compose(withAuth)(handleGetUser)(req as AuthenticatedRequest, res)

    case 'clear-cache':
      if (req.method !== 'POST') {
        return res.status(405).json({
          error: 'Method not allowed',
          allowed: ['POST']
        })
      }
      return handleClearCache(req, res)

    case 'performance':
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
      }
      return handlePerformance(req, res)

    case 'admin-verify':
      if (req.method !== 'POST') {
        return res.status(405).json({
          error: {
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
            allowed: ['POST'],
          },
          timestamp: new Date().toISOString(),
        })
      }
      // Apply auth and CSRF middleware manually
      return compose(
        withRateLimit({
          windowMs: 15 * 60 * 1000,
          maxRequests: 20,
        }),
        withCSRF(),
        withAuth
      )(handleAdminVerify)(req as AuthenticatedRequest, res)

    default:
      return res.status(404).json({
        error: {
          message: 'Not found',
          code: 'INVALID_ACTION',
          validActions: ['signup', 'session', 'refresh', 'user', 'clear-cache', 'performance', 'admin-verify'],
        },
        timestamp: new Date().toISOString(),
      })
  }
}

// Apply rate limiting and origin validation to session endpoints
export default authRouter
