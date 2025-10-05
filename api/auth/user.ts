import type { VercelResponse } from '@vercel/node'
import type { AuthenticatedRequest } from '../middleware/types'
import { authenticatedEndpoint } from '../middleware/compose'
import { getUserProfile } from './roles'
import { finishAuthSession, recordAuthMetric } from '../utils/performanceMonitor'
import { createPerformanceLogger } from '../utils/logger'

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  const startTime = performance.now()
  const logger = createPerformanceLogger(req, 'auth/user', startTime)

  try {
    // PERFORMANCE: Fast method check without detailed logging
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // PERFORMANCE: Reduced logging overhead in production
    if (process.env.NODE_ENV === 'development' && req.user) {
      logger.debug('Processing request', {
        userAgent: req.headers['user-agent']?.substring(0, 30),
        userId: req.user.id
      })
    }

    // User is already authenticated by withAuth middleware
    const user = req.user
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const profileStart = performance.now()

    // PERFORMANCE: Get user profile with timeout protection
    const profile = await getUserProfile(user.id, user.email)
    const profileTime = performance.now() - profileStart

    // PERFORMANCE: Streamlined response with minimal object creation
    const endTime = performance.now()
    const totalTime = endTime - startTime

    // PERFORMANCE: Only log slow requests to reduce overhead
    if (totalTime > 500 || process.env.NODE_ENV === 'development') {
      console.log(`[API /auth/user] ${totalTime > 500 ? 'SLOW' : 'Success'} - ${totalTime.toFixed(1)}ms (profile: ${profileTime.toFixed(1)}ms)`)
    }

    // PERFORMANCE: Direct response without intermediate object
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

export default authenticatedEndpoint(handler)