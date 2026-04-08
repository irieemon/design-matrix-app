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

// Quota enforcement (Phase 06-02)
export { withQuotaCheck } from './withQuotaCheck'
export type { QuotaRequest, QuotaResource, QuotaContext } from './withQuotaCheck'
