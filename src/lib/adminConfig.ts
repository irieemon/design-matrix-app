/**
 * Admin Configuration Management
 * Handles environment-specific admin account configuration and privileges
 */

import { logger } from '../utils/logger'

export interface AdminConfig {
  adminEmails: string[]
  superAdminEmails: string[]
  requireMFA: boolean
  enableAuditLogging: boolean
  sessionTimeoutMs: number
  maxConcurrentSessions: number
}

// Development environment configuration
const developmentConfig: AdminConfig = {
  adminEmails: [
    'admin@prioritas.com',
    'manager@company.com',
    'sean@lakehouse.net', // Development admin
    'dev@localhost',
    'test@example.com'
  ],
  superAdminEmails: [
    'admin@prioritas.com',
    'sean@lakehouse.net' // Development super admin
  ],
  requireMFA: false,
  enableAuditLogging: false,
  sessionTimeoutMs: 8 * 60 * 60 * 1000, // 8 hours for development
  maxConcurrentSessions: 5
}

// Production environment configuration
const productionConfig: AdminConfig = {
  adminEmails: [
    'admin@prioritas.com',
    ...(process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || [])
  ],
  superAdminEmails: [
    'admin@prioritas.com',
    ...(process.env.SUPER_ADMIN_EMAILS?.split(',').map(email => email.trim()) || [])
  ],
  requireMFA: true,
  enableAuditLogging: true,
  sessionTimeoutMs: 2 * 60 * 60 * 1000, // 2 hours for production
  maxConcurrentSessions: 2
}

// Staging environment configuration (mirrors production with test accounts)
const stagingConfig: AdminConfig = {
  adminEmails: [
    'admin@prioritas.com',
    'staging-admin@prioritas.com',
    'test-admin@company.com'
  ],
  superAdminEmails: [
    'admin@prioritas.com',
    'staging-admin@prioritas.com'
  ],
  requireMFA: true,
  enableAuditLogging: true,
  sessionTimeoutMs: 4 * 60 * 60 * 1000, // 4 hours for staging
  maxConcurrentSessions: 3
}

/**
 * Get current environment
 */
function getCurrentEnvironment(): 'development' | 'staging' | 'production' {
  // Check if we're running in browser (client-side)
  if (typeof window !== 'undefined') {
    // Use Vite environment variables for client-side
    const env = import.meta.env.MODE
    if (env === 'development') return 'development'
    if (env === 'staging') return 'staging'
    return 'production'
  }

  // Server-side environment detection
  const nodeEnv = process.env.NODE_ENV || 'development'
  const customEnv = process.env.APP_ENV

  if (customEnv === 'staging') return 'staging'
  if (nodeEnv === 'development') return 'development'
  return 'production'
}

/**
 * Get admin configuration for current environment
 */
export function getAdminConfig(): AdminConfig {
  const environment = getCurrentEnvironment()

  let config: AdminConfig
  switch (environment) {
    case 'development':
      config = developmentConfig
      break
    case 'staging':
      config = stagingConfig
      break
    case 'production':
      config = productionConfig
      break
    default:
      logger.warn('Unknown environment, falling back to production config')
      config = productionConfig
  }

  logger.debug('AdminConfig: Using configuration for environment:', environment, {
    adminCount: config.adminEmails.length,
    superAdminCount: config.superAdminEmails.length,
    requireMFA: config.requireMFA,
    enableAuditLogging: config.enableAuditLogging
  })

  return config
}

/**
 * Check if email is an admin in current environment
 */
export function isAdminEmail(email: string): boolean {
  const config = getAdminConfig()
  const normalizedEmail = email.toLowerCase().trim()

  return config.adminEmails.some(adminEmail =>
    adminEmail.toLowerCase() === normalizedEmail
  ) || config.superAdminEmails.some(superAdminEmail =>
    superAdminEmail.toLowerCase() === normalizedEmail
  )
}

/**
 * Check if email is a super admin in current environment
 */
export function isSuperAdminEmail(email: string): boolean {
  const config = getAdminConfig()
  const normalizedEmail = email.toLowerCase().trim()

  return config.superAdminEmails.some(superAdminEmail =>
    superAdminEmail.toLowerCase() === normalizedEmail
  )
}

/**
 * Get admin role for email
 */
export function getAdminRole(email: string): 'user' | 'admin' | 'super_admin' {
  if (isSuperAdminEmail(email)) return 'super_admin'
  if (isAdminEmail(email)) return 'admin'
  return 'user'
}

/**
 * Admin session management
 */
export class AdminSessionManager {
  private static activeSessions = new Map<string, {
    userId: string
    email: string
    startTime: number
    lastActivity: number
    capabilities: string[]
  }>()

  /**
   * Start admin session
   */
  static startAdminSession(userId: string, email: string, capabilities: string[]): string {
    const sessionId = `admin_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()

    // Check if user already has max concurrent sessions
    const config = getAdminConfig()
    const userSessions = Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId)

    if (userSessions.length >= config.maxConcurrentSessions) {
      // Remove oldest session
      const oldestSession = userSessions
        .sort((a, b) => a.startTime - b.startTime)[0]

      const oldestSessionId = Array.from(this.activeSessions.entries())
        .find(([_, session]) => session === oldestSession)?.[0]

      if (oldestSessionId) {
        this.activeSessions.delete(oldestSessionId)
        logger.debug('AdminSessionManager: Removed oldest session due to limit')
      }
    }

    this.activeSessions.set(sessionId, {
      userId,
      email,
      startTime: now,
      lastActivity: now,
      capabilities
    })

    logger.debug('AdminSessionManager: Started admin session', { sessionId, email, capabilities })
    return sessionId
  }

  /**
   * Update session activity
   */
  static updateSessionActivity(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId)
    if (!session) return false

    session.lastActivity = Date.now()
    return true
  }

  /**
   * End admin session
   */
  static endAdminSession(sessionId: string): boolean {
    const success = this.activeSessions.delete(sessionId)
    if (success) {
      logger.debug('AdminSessionManager: Ended admin session', { sessionId })
    }
    return success
  }

  /**
   * Validate admin session
   */
  static validateAdminSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId)
    if (!session) return false

    const config = getAdminConfig()
    const now = Date.now()

    // Check if session has expired
    if (now - session.lastActivity > config.sessionTimeoutMs) {
      this.activeSessions.delete(sessionId)
      logger.debug('AdminSessionManager: Session expired', { sessionId })
      return false
    }

    return true
  }

  /**
   * Get active admin sessions
   */
  static getActiveSessions(): Array<{
    sessionId: string
    userId: string
    email: string
    startTime: number
    lastActivity: number
    capabilities: string[]
  }> {
    return Array.from(this.activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      ...session
    }))
  }

  /**
   * Cleanup expired sessions
   */
  static cleanupExpiredSessions(): number {
    const config = getAdminConfig()
    const now = Date.now()
    let cleanedCount = 0

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > config.sessionTimeoutMs) {
        this.activeSessions.delete(sessionId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.debug('AdminSessionManager: Cleaned up expired sessions', { count: cleanedCount })
    }

    return cleanedCount
  }
}

// Cleanup expired sessions every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    AdminSessionManager.cleanupExpiredSessions()
  }, 5 * 60 * 1000)
}

/**
 * Admin audit logging
 */
export interface AdminAuditEvent {
  id: string
  userId: string
  userEmail: string
  action: string
  resource: string
  resourceId?: string
  details: Record<string, any>
  timestamp: string
  ipAddress?: string
  userAgent?: string
}

export class AdminAuditLogger {
  private static logs: AdminAuditEvent[] = []
  private static maxLogs = 1000

  /**
   * Log admin action
   */
  static logAction(
    userId: string,
    userEmail: string,
    action: string,
    resource: string,
    resourceId?: string,
    details: Record<string, any> = {},
    context?: { ipAddress?: string; userAgent?: string }
  ): void {
    const config = getAdminConfig()
    if (!config.enableAuditLogging) return

    const auditEvent: AdminAuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userEmail,
      action,
      resource,
      resourceId,
      details,
      timestamp: new Date().toISOString(),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    }

    this.logs.push(auditEvent)

    // Keep only recent logs in memory
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    logger.debug('AdminAuditLogger: Logged action', { action, resource, userId })

    // In production, this would be sent to a secure logging service
    if (getCurrentEnvironment() === 'production') {
      // TODO: Send to external audit logging service
      logger.info('ADMIN AUDIT', auditEvent)
    }
  }

  /**
   * Get audit logs
   */
  static getAuditLogs(limit: number = 100): AdminAuditEvent[] {
    return this.logs.slice(-limit).reverse()
  }

  /**
   * Get audit logs for user
   */
  static getUserAuditLogs(userId: string, limit: number = 50): AdminAuditEvent[] {
    return this.logs
      .filter(log => log.userId === userId)
      .slice(-limit)
      .reverse()
  }
}

export default {
  getAdminConfig,
  isAdminEmail,
  isSuperAdminEmail,
  getAdminRole,
  AdminSessionManager,
  AdminAuditLogger
}