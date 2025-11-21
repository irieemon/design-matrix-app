/**
 * Security Middleware
 *
 * Composable security middleware for API endpoints
 */

// Types
export type {
  AuthenticatedRequest,
  MiddlewareHandler,
  MiddlewareWrapper,
  RateLimitConfig,
  CSRFConfig,
  ErrorResponse,
} from './types'

// Cookie utilities
export {
  COOKIE_NAMES,
  setSecureCookie,
  setAuthCookies,
  clearAuthCookies,
  parseCookies,
  getCookie,
  generateCSRFToken,
} from './cookies'

// Authentication middleware
// ✅ FIX: withAuth middleware moved to backend (api/_lib/middleware/withAuth.ts)
// Frontend middleware should not handle auth - use backend API routes instead
// export {
//   withAuth,
//   withAdmin,
//   withOptionalAuth,
// } from './withAuth'

// CSRF protection
export {
  withCSRF,
  withOriginValidation,
} from './withCSRF'

// Rate limiting
export {
  withRateLimit,
  withStrictRateLimit,
  withUserRateLimit,
} from './withRateLimit'

// Composition utilities
export {
  compose,
  publicEndpoint,
  authenticatedEndpoint,
  adminEndpoint,
} from './compose'
