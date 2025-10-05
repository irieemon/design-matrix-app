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
} from './types.js'

// Cookie utilities
export {
  COOKIE_NAMES,
  setSecureCookie,
  setAuthCookies,
  clearAuthCookies,
  parseCookies,
  getCookie,
  generateCSRFToken,
} from './cookies.js'

// Authentication middleware
export {
  withAuth,
  withAdmin,
  withOptionalAuth,
} from './withAuth.js'

// CSRF protection
export {
  withCSRF,
  withOriginValidation,
} from './withCSRF.js'

// Rate limiting
export {
  withRateLimit,
  withStrictRateLimit,
  withUserRateLimit,
} from './withRateLimit.js'

// Composition utilities
export {
  compose,
  publicEndpoint,
  authenticatedEndpoint,
  adminEndpoint,
} from './compose.js'
