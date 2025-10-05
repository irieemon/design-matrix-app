/* eslint-disable no-console */
/**
 * UUID Utility Module
 * Provides consistent UUID generation, validation, and formatting across the application
 */

import { logger } from '../lib/logging'

/**
 * Generate a new UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID()
}

/**
 * Validate UUID format (v1-v5 compatible, includes demo UUIDs)
 */
export function isValidUUID(id: string): boolean {
  // More permissive regex that accepts demo UUIDs (all zeros) and standard UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * Generate UUID for demo/test users with proper format
 */
export function generateDemoUUID(suffix?: string): string {
  const basePart = '00000000-0000-0000-0000-00000000000'
  const suffixPart = suffix ? suffix.padStart(1, '0') : '1'
  return basePart + suffixPart
}

/**
 * Check if UUID is a demo/test UUID
 */
export function isDemoUUID(id: string): boolean {
  return id.startsWith('00000000-0000-0000-0000-00000000000')
}

/**
 * Sanitize and validate user ID input
 */
export function sanitizeUserId(userId: string | undefined | null): string | null {
  if (!userId) return null

  const trimmed = userId.trim()
  if (!trimmed) return null

  // Handle legacy test IDs by converting them to proper UUID format
  if (trimmed === 'test-user-id' || trimmed.startsWith('test-')) {
    return generateDemoUUID('1')
  }

  // Validate UUID format
  if (!isValidUUID(trimmed)) {
    logger.warn('Invalid UUID format', { uuid: trimmed })
    return null
  }

  return trimmed
}

/**
 * Convert legacy string ID to UUID format
 */
export function legacyIdToUUID(legacyId: string): string {
  // Map common test IDs to consistent UUIDs
  const legacyMapping: Record<string, string> = {
    'test-user-id': generateDemoUUID('1'),
    'test-project-id': generateDemoUUID('2'),
    'test-project-1': '00000000-0000-0000-0000-000000000001', // Fixed UUID for test-project-1
    'test-project-123': '00000000-0000-0000-0000-000000000123', // Fixed UUID for test-project-123
    'test-idea-id': generateDemoUUID('3')
  }

  if (legacyMapping[legacyId]) {
    return legacyMapping[legacyId]
  }

  // For other legacy IDs, generate a consistent UUID based on the string
  // This ensures the same legacy ID always maps to the same UUID
  const hash = legacyId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)

  const hashStr = Math.abs(hash).toString(16).padStart(12, '0').substring(0, 12)
  return `00000000-0000-0000-0000-${hashStr}`
}

/**
 * Sanitize and validate project ID input
 */
export function sanitizeProjectId(projectId: string | undefined | null): string | null {
  if (!projectId) return null

  const trimmed = projectId.trim()
  if (!trimmed) return null

  // Handle legacy test project IDs by converting them to proper UUID format
  if (trimmed.startsWith('test-project-') || trimmed === 'test-project-id') {
    return legacyIdToUUID(trimmed)
  }

  // Validate UUID format
  if (!isValidUUID(trimmed)) {
    logger.warn('Invalid UUID format for project ID', { projectId: trimmed })
    // Try to convert legacy ID
    return legacyIdToUUID(trimmed)
  }

  return trimmed
}

/**
 * Ensure a user ID is in proper UUID format
 */
export function ensureUUID(id: string | undefined | null): string {
  const sanitized = sanitizeUserId(id)
  if (sanitized) return sanitized

  // If we can't sanitize, try legacy conversion
  if (id) {
    return legacyIdToUUID(id)
  }

  // Last resort: generate new UUID
  return generateUUID()
}

/**
 * Ensure a project ID is in proper UUID format
 */
export function ensureProjectUUID(id: string | undefined | null): string {
  const sanitized = sanitizeProjectId(id)
  if (sanitized) return sanitized

  // If we can't sanitize, try legacy conversion
  if (id) {
    return legacyIdToUUID(id)
  }

  // Last resort: generate new UUID
  return generateUUID()
}