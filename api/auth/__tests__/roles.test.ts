/**
 * Roles and Authorization Tests
 *
 * Comprehensive security tests for RBAC system and user profile management:
 * - Role determination based on email configuration
 * - User profile retrieval with UUID validation and fallback handling
 * - Role hierarchy and permission checking (user < admin < super_admin)
 * - Server-side profile caching and performance optimization
 * - UUID sanitization and validation for security
 * - Admin and super admin email whitelisting
 * - Fallback profile generation for invalid data
 *
 * Business Impact: Unauthorized privilege escalation, data breaches, access control bypass
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VercelRequest, VercelResponse } from '@vercel/node'

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
    }))
  }))
}))

vi.mock('../middleware', () => ({
  authenticate: vi.fn()
}))

vi.mock('../../utils/queryOptimizer', () => ({
  optimizedGetUserProfile: vi.fn()
}))

vi.mock('../../src/utils/uuid', () => ({
  isValidUUID: vi.fn((id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
  sanitizeUserId: vi.fn((id: string) => id),
  ensureUUID: vi.fn((id: string) => id || '00000000-0000-0000-0000-000000000000')
}))

// Set up environment
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

// Import after mocks
import {
  determineUserRole,
  getUserProfile,
  hasRole,
  requireRole,
  UserRole
} from '../roles'
import { optimizedGetUserProfile } from '../../utils/queryOptimizer'
import { authenticate } from '../middleware'

describe('Roles and Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('determineUserRole', () => {
    describe('Super Admin Detection', () => {
      it('should identify super admin by email', () => {
        const role = determineUserRole('admin@prioritas.com')
        expect(role).toBe('super_admin')
      })

      it('should be case-insensitive for super admin', () => {
        expect(determineUserRole('ADMIN@PRIORITAS.COM')).toBe('super_admin')
        expect(determineUserRole('Admin@Prioritas.Com')).toBe('super_admin')
        expect(determineUserRole('aDmIn@pRiOrItAs.cOm')).toBe('super_admin')
      })
    })

    describe('Admin Detection', () => {
      it('should identify admin by prioritas email', () => {
        const role = determineUserRole('admin@prioritas.com')
        expect(role).toBe('super_admin') // Super admin takes precedence
      })

      it('should identify admin by company email', () => {
        const role = determineUserRole('manager@company.com')
        expect(role).toBe('admin')
      })

      it('should be case-insensitive for admin', () => {
        expect(determineUserRole('MANAGER@COMPANY.COM')).toBe('admin')
        expect(determineUserRole('Manager@Company.Com')).toBe('admin')
      })
    })

    describe('Regular User Detection', () => {
      it('should default to user role for unknown emails', () => {
        expect(determineUserRole('user@example.com')).toBe('user')
        expect(determineUserRole('test@test.com')).toBe('user')
        expect(determineUserRole('random@domain.com')).toBe('user')
      })

      it('should handle empty email', () => {
        expect(determineUserRole('')).toBe('user')
      })

      it('should handle malformed emails', () => {
        expect(determineUserRole('not-an-email')).toBe('user')
        expect(determineUserRole('@')).toBe('user')
        expect(determineUserRole('test@')).toBe('user')
      })
    })

    describe('Security Edge Cases', () => {
      it('should not be fooled by subdomain tricks', () => {
        expect(determineUserRole('user@admin.prioritas.com.evil.com')).toBe('user')
        expect(determineUserRole('admin@prioritas.com.fake.com')).toBe('user')
      })

      it('should handle email injection attempts', () => {
        expect(determineUserRole('user@example.com\nadmin@prioritas.com')).toBe('user')
        expect(determineUserRole('admin@prioritas.com\r\n')).toBe('super_admin')
      })

      it('should handle whitespace variations', () => {
        expect(determineUserRole(' admin@prioritas.com ')).toBe('user') // Trimming should be done by caller
        expect(determineUserRole('admin @prioritas.com')).toBe('user')
      })
    })
  })

  describe('getUserProfile', () => {
    const validUserId = '12345678-1234-1234-1234-123456789abc'
    const validEmail = 'test@example.com'

    describe('Successful Profile Retrieval', () => {
      it('should retrieve existing user profile', async () => {
        const mockProfile = {
          id: validUserId,
          email: validEmail,
          role: 'user' as const,
          full_name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-12-01T00:00:00Z'
        }

        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const profile = await getUserProfile(validUserId, validEmail)

        expect(profile).toEqual(mockProfile)
        expect(optimizedGetUserProfile).toHaveBeenCalledWith(validUserId, validEmail)
      })

      it('should use server-determined role for consistency', async () => {
        const mockProfile = {
          id: validUserId,
          email: 'admin@prioritas.com',
          role: 'user' as const, // Wrong role in DB
          full_name: 'Admin User'
        }

        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const profile = await getUserProfile(validUserId, 'admin@prioritas.com')

        expect(profile.role).toBe('super_admin') // Should be corrected
        expect(profile.email).toBe('admin@prioritas.com')
      })

      it('should handle profile with minimal data', async () => {
        const mockProfile = {
          id: validUserId,
          email: validEmail,
          role: 'user' as const
        }

        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const profile = await getUserProfile(validUserId, validEmail)

        expect(profile.id).toBe(validUserId)
        expect(profile.email).toBe(validEmail)
        expect(profile.role).toBe('user')
      })
    })

    describe('Fallback Profile Generation', () => {
      it('should create fallback profile when query returns null', async () => {
        ;(optimizedGetUserProfile as any).mockResolvedValue(null)

        const profile = await getUserProfile(validUserId, validEmail)

        expect(profile.id).toBe(validUserId)
        expect(profile.email).toBe(validEmail)
        expect(profile.role).toBe('user')
        expect(profile.full_name).toBe('test')
        expect(profile.created_at).toBeDefined()
        expect(profile.updated_at).toBeDefined()
      })

      it('should create fallback profile for admin email', async () => {
        ;(optimizedGetUserProfile as any).mockResolvedValue(null)

        const profile = await getUserProfile(validUserId, 'admin@prioritas.com')

        expect(profile.role).toBe('super_admin')
        expect(profile.email).toBe('admin@prioritas.com')
      })

      it('should create fallback profile on error', async () => {
        ;(optimizedGetUserProfile as any).mockRejectedValue(new Error('Database error'))

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const profile = await getUserProfile(validUserId, validEmail)

        expect(profile.id).toBe(validUserId)
        expect(profile.email).toBe(validEmail)
        expect(profile.role).toBe('user')

        warnSpy.mockRestore()
      })

      it('should extract username from email for full_name', async () => {
        ;(optimizedGetUserProfile as any).mockResolvedValue(null)

        const profile = await getUserProfile(validUserId, 'john.doe@example.com')

        expect(profile.full_name).toBe('john.doe')
      })
    })

    describe('UUID Validation and Sanitization', () => {
      it('should accept valid UUIDs', async () => {
        const validUUIDs = [
          '12345678-1234-1234-1234-123456789abc',
          '00000000-0000-0000-0000-000000000000',
          'ffffffff-ffff-ffff-ffff-ffffffffffff'
        ]

        for (const uuid of validUUIDs) {
          ;(optimizedGetUserProfile as any).mockResolvedValue({
            id: uuid,
            email: validEmail,
            role: 'user' as const
          })

          const profile = await getUserProfile(uuid, validEmail)
          expect(profile.id).toBe(uuid)
        }
      })

      it('should handle invalid UUID format gracefully', async () => {
        const invalidUUIDs = [
          'not-a-uuid',
          '12345',
          '',
          'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        ]

        for (const invalidId of invalidUUIDs) {
          const profile = await getUserProfile(invalidId, validEmail)

          expect(profile.email).toBe(validEmail)
          expect(profile.role).toBe('user')
          expect(profile.created_at).toBeDefined()
        }
      })

      it('should log warning for invalid UUID', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        await getUserProfile('invalid-uuid', validEmail)

        expect(warnSpy).toHaveBeenCalled()
        warnSpy.mockRestore()
      })
    })

    describe('Performance and Logging', () => {
      it('should log profile retrieval time', async () => {
        const mockProfile = {
          id: validUserId,
          email: validEmail,
          role: 'user' as const
        }

        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        await getUserProfile(validUserId, validEmail)

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Profile retrieved')
        )

        logSpy.mockRestore()
      })

      it('should log fallback creation time', async () => {
        ;(optimizedGetUserProfile as any).mockResolvedValue(null)

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        await getUserProfile(validUserId, validEmail)

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Profile fallback created')
        )

        logSpy.mockRestore()
      })

      it('should log error and create fallback on exception', async () => {
        ;(optimizedGetUserProfile as any).mockRejectedValue(new Error('Test error'))

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const profile = await getUserProfile(validUserId, validEmail)

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Profile error'),
          expect.any(Error)
        )
        expect(profile).toBeDefined()

        warnSpy.mockRestore()
      })
    })
  })

  describe('hasRole', () => {
    describe('Role Hierarchy Validation', () => {
      it('should allow user role to access user resources', () => {
        expect(hasRole('user', 'user')).toBe(true)
      })

      it('should prevent user from accessing admin resources', () => {
        expect(hasRole('user', 'admin')).toBe(false)
      })

      it('should prevent user from accessing super_admin resources', () => {
        expect(hasRole('user', 'super_admin')).toBe(false)
      })

      it('should allow admin to access user resources', () => {
        expect(hasRole('admin', 'user')).toBe(true)
      })

      it('should allow admin to access admin resources', () => {
        expect(hasRole('admin', 'admin')).toBe(true)
      })

      it('should prevent admin from accessing super_admin resources', () => {
        expect(hasRole('admin', 'super_admin')).toBe(false)
      })

      it('should allow super_admin to access all resources', () => {
        expect(hasRole('super_admin', 'user')).toBe(true)
        expect(hasRole('super_admin', 'admin')).toBe(true)
        expect(hasRole('super_admin', 'super_admin')).toBe(true)
      })
    })

    describe('Edge Cases', () => {
      it('should handle same role comparison', () => {
        expect(hasRole('user', 'user')).toBe(true)
        expect(hasRole('admin', 'admin')).toBe(true)
        expect(hasRole('super_admin', 'super_admin')).toBe(true)
      })

      it('should handle invalid roles gracefully', () => {
        // TypeScript should prevent this, but test runtime behavior
        expect(hasRole('invalid' as UserRole, 'user')).toBe(false)
        expect(hasRole('user', 'invalid' as UserRole)).toBe(false)
      })
    })
  })

  describe('requireRole', () => {
    let mockRequest: Partial<VercelRequest>
    let mockResponse: Partial<VercelResponse>
    let statusMock: any
    let jsonMock: any
    let nextMock: any

    const createMockRequest = (): VercelRequest => ({
      method: 'GET',
      headers: { authorization: 'Bearer valid.token' },
      url: '/api/test',
      query: {},
      body: {}
    } as VercelRequest)

    const createMockResponse = (): VercelResponse => {
      jsonMock = vi.fn().mockReturnThis()
      statusMock = vi.fn().mockReturnValue({ json: jsonMock })

      return {
        status: statusMock,
        json: jsonMock,
        setHeader: vi.fn()
      } as unknown as VercelResponse
    }

    beforeEach(() => {
      mockRequest = createMockRequest()
      mockResponse = createMockResponse()
      nextMock = vi.fn()
    })

    describe('Successful Authorization', () => {
      it('should allow user with sufficient role', async () => {
        const mockUser = { id: 'user-123', email: 'admin@prioritas.com' }
        const mockProfile = {
          id: 'user-123',
          email: 'admin@prioritas.com',
          role: 'super_admin' as const
        }

        ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const middleware = requireRole('admin')
        await middleware(mockRequest as VercelRequest, mockResponse as VercelResponse, nextMock)

        expect(nextMock).toHaveBeenCalled()
        expect((mockRequest as any).userProfile).toEqual(mockProfile)
      })

      it('should attach user profile to request', async () => {
        const mockUser = { id: 'user-123', email: 'test@example.com' }
        const mockProfile = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user' as const,
          full_name: 'Test User'
        }

        ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const middleware = requireRole('user')
        await middleware(mockRequest as VercelRequest, mockResponse as VercelResponse, nextMock)

        expect((mockRequest as any).userProfile).toEqual(mockProfile)
      })

      it('should allow super_admin to access admin-only resources', async () => {
        const mockUser = { id: 'admin-123', email: 'admin@prioritas.com' }
        const mockProfile = {
          id: 'admin-123',
          email: 'admin@prioritas.com',
          role: 'super_admin' as const
        }

        ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const middleware = requireRole('admin')
        await middleware(mockRequest as VercelRequest, mockResponse as VercelResponse, nextMock)

        expect(nextMock).toHaveBeenCalled()
      })
    })

    describe('Authentication Failures', () => {
      it('should return 401 when authentication fails', async () => {
        ;(authenticate as any).mockResolvedValue({
          user: null,
          error: 'Invalid token'
        })

        const middleware = requireRole('user')
        await middleware(mockRequest as VercelRequest, mockResponse as VercelResponse, nextMock)

        expect(statusMock).toHaveBeenCalledWith(401)
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' })
        expect(nextMock).not.toHaveBeenCalled()
      })

      it('should return 401 when user is null', async () => {
        ;(authenticate as any).mockResolvedValue({ user: null, error: null })

        const middleware = requireRole('user')
        await middleware(mockRequest as VercelRequest, mockResponse as VercelResponse, nextMock)

        expect(statusMock).toHaveBeenCalledWith(401)
        expect(nextMock).not.toHaveBeenCalled()
      })
    })

    describe('Authorization Failures', () => {
      it('should return 403 when user lacks required role', async () => {
        const mockUser = { id: 'user-123', email: 'user@example.com' }
        const mockProfile = {
          id: 'user-123',
          email: 'user@example.com',
          role: 'user' as const
        }

        ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const middleware = requireRole('admin')
        await middleware(mockRequest as VercelRequest, mockResponse as VercelResponse, nextMock)

        expect(statusMock).toHaveBeenCalledWith(403)
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Insufficient permissions' })
        expect(nextMock).not.toHaveBeenCalled()
      })

      it('should prevent user from accessing super_admin resources', async () => {
        const mockUser = { id: 'user-123', email: 'user@example.com' }
        const mockProfile = {
          id: 'user-123',
          email: 'user@example.com',
          role: 'user' as const
        }

        ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const middleware = requireRole('super_admin')
        await middleware(mockRequest as VercelRequest, mockResponse as VercelResponse, nextMock)

        expect(statusMock).toHaveBeenCalledWith(403)
      })

      it('should prevent admin from accessing super_admin resources', async () => {
        const mockUser = { id: 'admin-123', email: 'manager@company.com' }
        const mockProfile = {
          id: 'admin-123',
          email: 'manager@company.com',
          role: 'admin' as const
        }

        ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const middleware = requireRole('super_admin')
        await middleware(mockRequest as VercelRequest, mockResponse as VercelResponse, nextMock)

        expect(statusMock).toHaveBeenCalledWith(403)
        expect(nextMock).not.toHaveBeenCalled()
      })
    })

    describe('Role Escalation Prevention', () => {
      it('should not allow role escalation through profile manipulation', async () => {
        const mockUser = { id: 'user-123', email: 'user@example.com' }
        const mockProfile = {
          id: 'user-123',
          email: 'user@example.com',
          role: 'user' as const
        }

        ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
        ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

        const middleware = requireRole('admin')
        await middleware(mockRequest as VercelRequest, mockResponse as VercelResponse, nextMock)

        // Even if client tries to modify request
        ;(mockRequest as any).userProfile = { role: 'admin' }

        expect(statusMock).toHaveBeenCalledWith(403)
        expect(nextMock).not.toHaveBeenCalled()
      })
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete user authorization flow', async () => {
      const userId = '12345678-1234-1234-1234-123456789abc'
      const userEmail = 'user@example.com'

      const mockProfile = {
        id: userId,
        email: userEmail,
        role: 'user' as const,
        full_name: 'Test User'
      }

      ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

      const profile = await getUserProfile(userId, userEmail)

      expect(profile).toEqual(mockProfile)
      expect(hasRole(profile.role, 'user')).toBe(true)
      expect(hasRole(profile.role, 'admin')).toBe(false)
    })

    it('should handle complete admin authorization flow', async () => {
      const adminId = '12345678-1234-1234-1234-123456789abc'
      const adminEmail = 'admin@prioritas.com'

      const mockProfile = {
        id: adminId,
        email: adminEmail,
        role: 'user' as const // Wrong in DB
      }

      ;(optimizedGetUserProfile as any).mockResolvedValue(mockProfile)

      const profile = await getUserProfile(adminId, adminEmail)

      expect(profile.role).toBe('super_admin') // Corrected by server
      expect(hasRole(profile.role, 'user')).toBe(true)
      expect(hasRole(profile.role, 'admin')).toBe(true)
      expect(hasRole(profile.role, 'super_admin')).toBe(true)
    })

    it('should handle fallback profile with correct role', async () => {
      const adminId = '12345678-1234-1234-1234-123456789abc'
      const adminEmail = 'manager@company.com'

      ;(optimizedGetUserProfile as any).mockResolvedValue(null)

      const profile = await getUserProfile(adminId, adminEmail)

      expect(profile.role).toBe('admin')
      expect(profile.email).toBe(adminEmail)
      expect(hasRole(profile.role, 'user')).toBe(true)
      expect(hasRole(profile.role, 'admin')).toBe(true)
    })
  })
})
