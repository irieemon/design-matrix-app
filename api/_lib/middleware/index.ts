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
export {
  withAuth,
  withAdmin,
  withOptionalAuth,
} from './withAuth'

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
