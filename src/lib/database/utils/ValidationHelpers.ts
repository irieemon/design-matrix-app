/**
 * ValidationHelpers - Input validation utilities
 *
 * Extracted from DatabaseService to provide centralized validation logic
 * for project IDs, user IDs, and other common validation patterns.
 */

import { logger } from '../../../utils/logger'
import { sanitizeUserId } from '../../../utils/uuid'

export class ValidationHelpers {
  /**
   * Validate and sanitize project ID
   */
  static validateProjectId(projectId?: string): string | null {
    if (!projectId) return null
    const sanitized = sanitizeUserId(projectId) // Reuse sanitization logic
    if (!sanitized) {
      logger.warn(`Invalid project ID format: ${projectId}`)
      return null
    }
    return sanitized
  }

  /**
   * Validate and sanitize user ID
   */
  static validateUserId(userId?: string): string | null {
    if (!userId) return null
    const sanitized = sanitizeUserId(userId)
    if (!sanitized) {
      logger.warn(`Invalid user ID format: ${userId}`)
      return null
    }
    return sanitized
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Validate required string field
   */
  static validateRequiredString(value: any, fieldName: string): boolean {
    if (typeof value !== 'string' || value.trim().length === 0) {
      logger.warn(`Invalid ${fieldName}: must be a non-empty string`)
      return false
    }
    return true
  }

  /**
   * Validate UUID format
   */
  static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  /**
   * Validate project role
   */
  static validateProjectRole(role: string): boolean {
    const validRoles = ['owner', 'editor', 'commenter', 'viewer']
    return validRoles.includes(role)
  }

  /**
   * Validate project status
   */
  static validateProjectStatus(status: string): boolean {
    const validStatuses = ['active', 'completed', 'paused', 'archived']
    return validStatuses.includes(status)
  }
}
