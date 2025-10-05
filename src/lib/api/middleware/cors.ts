import { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * CORS Middleware for API Routes
 * Adds proper CORS headers to allow frontend requests
 */
export function corsMiddleware(req: VercelRequest, res: VercelResponse): boolean {
  // Determine allowed origin based on environment
  const allowedOrigins = [
    'http://localhost:3003',
    'http://localhost:3000',
    'https://your-production-domain.com' // Update with actual production domain
  ]

  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '')
  const isAllowed = allowedOrigins.some(allowed => origin?.startsWith(allowed))

  // Set CORS headers
  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (process.env.NODE_ENV === 'development') {
    // In development, allow any origin
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-Requested-With, Content-Type, Authorization, Accept, Origin'
  )
  res.setHeader('Access-Control-Max-Age', '86400') // 24 hours

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true // Indicates preflight was handled
  }

  return false // Continue with normal request processing
}

/**
 * Wrapper to apply CORS middleware to API handler
 */
export function withCors(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<any>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Apply CORS headers
    const preflightHandled = corsMiddleware(req, res)

    // If preflight, stop here
    if (preflightHandled) {
      return
    }

    // Continue with actual handler
    return handler(req, res)
  }
}
