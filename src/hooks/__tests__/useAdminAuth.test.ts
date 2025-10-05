import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAdminAuth } from '../useAdminAuth'
import { mockAdminUser } from '../../test/utils/test-utils'

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}))

// Mock Supabase
const mockSupabase = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    getUser: vi.fn()
  },
  from: vi.fn(() => ({
    upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({
          data: { role: 'super_admin' },
          error: null
        }))
      }))
    }))
  }))
}

const mockSupabaseAdmin = {
  auth: {
    admin: {
      createUser: vi.fn(),
      listUsers: vi.fn(),
      updateUserById: vi.fn()
    }
  },
  from: vi.fn(() => ({
    upsert: vi.fn(() => Promise.resolve({ data: null, error: null }))
  }))
}

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
  supabaseAdmin: mockSupabaseAdmin
}))

describe('useAdminAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to development mode by default
    vi.stubEnv('DEV', true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAdminAuth())

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.signInAdmin).toBe('function')
      expect(typeof result.current.ensureAdminUser).toBe('function')
      expect(typeof result.current.checkAdminStatus).toBe('function')
      expect(typeof result.current.clearError).toBe('function')
    })

    it('should respect developmentMode option', () => {
      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      expect(result.current).toBeDefined()
    })

    it('should respect bypassEmailConfirmation option', () => {
      const { result } = renderHook(() => useAdminAuth({ bypassEmailConfirmation: true }))

      expect(result.current).toBeDefined()
    })

    it('should use default development mode from env', () => {
      vi.stubEnv('DEV', true)
      const { result } = renderHook(() => useAdminAuth())

      expect(result.current).toBeDefined()
    })
  })

  describe('ensureAdminUser', () => {
    it('should create new admin user with confirmed email in development', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            email: mockAdminUser.email,
            created_at: new Date().toISOString(),
            email_confirmed_at: new Date().toISOString()
          }
        },
        error: null
      })

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      let adminUser
      await act(async () => {
        adminUser = await result.current.ensureAdminUser('admin@test.com', 'password123')
      })

      expect(adminUser).toEqual({
        id: mockAdminUser.id,
        email: mockAdminUser.email,
        role: 'super_admin',
        email_confirmed: true
      })
      expect(mockSupabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'password123',
        email_confirm: true,
        user_metadata: {
          full_name: 'Admin User',
          role: 'super_admin'
        }
      })
    })

    it('should handle existing user and confirm email', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'User already exists' }
      })

      mockSupabaseAdmin.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [{
            id: mockAdminUser.id,
            email: 'admin@test.com',
            email_confirmed_at: null
          }]
        },
        error: null
      })

      mockSupabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error: null
      })

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      let adminUser
      await act(async () => {
        adminUser = await result.current.ensureAdminUser('admin@test.com', 'password123')
      })

      expect(adminUser).toEqual({
        id: mockAdminUser.id,
        email: 'admin@test.com',
        role: 'super_admin',
        email_confirmed: true
      })
      expect(mockSupabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
        mockAdminUser.id,
        { email_confirm: true }
      )
    })

    it('should handle already confirmed user', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'User already exists' }
      })

      mockSupabaseAdmin.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [{
            id: mockAdminUser.id,
            email: 'admin@test.com',
            email_confirmed_at: new Date().toISOString()
          }]
        },
        error: null
      })

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      let adminUser
      await act(async () => {
        adminUser = await result.current.ensureAdminUser('admin@test.com', 'password123')
      })

      expect(adminUser).toEqual({
        id: mockAdminUser.id,
        email: 'admin@test.com',
        role: 'super_admin',
        email_confirmed: true
      })
      expect(mockSupabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled()
    })

    it('should handle list users error', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'User already exists' }
      })

      mockSupabaseAdmin.auth.admin.listUsers.mockResolvedValue({
        data: null,
        error: { message: 'Failed to list users' }
      })

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      await expect(async () => {
        await result.current.ensureAdminUser('admin@test.com', 'password123')
      }).rejects.toThrow('Failed to list users')
    })

    it('should handle user not found in list', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'User already exists' }
      })

      mockSupabaseAdmin.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null
      })

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      await expect(async () => {
        await result.current.ensureAdminUser('admin@test.com', 'password123')
      }).rejects.toThrow('User exists but not found in list')
    })

    it('should fall back to regular signup if service role not available', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            email: mockAdminUser.email,
            email_confirmed_at: new Date().toISOString()
          }
        },
        error: null
      })

      const { result } = renderHook(() => useAdminAuth({
        developmentMode: false,
        bypassEmailConfirmation: false
      }))

      let adminUser
      await act(async () => {
        adminUser = await result.current.ensureAdminUser('admin@test.com', 'password123')
      })

      expect(adminUser).toEqual({
        id: mockAdminUser.id,
        email: mockAdminUser.email,
        role: 'super_admin',
        email_confirmed: true
      })
      expect(mockSupabase.auth.signUp).toHaveBeenCalled()
    })

    it('should handle already registered user in regular signup', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' }
      })

      const { result } = renderHook(() => useAdminAuth({
        developmentMode: false
      }))

      let adminUser
      await act(async () => {
        adminUser = await result.current.ensureAdminUser('admin@test.com', 'password123')
      })

      expect(adminUser).toBeNull()
    })

    it('should handle regular signup error', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'Registration failed' }
      })

      const { result } = renderHook(() => useAdminAuth({
        developmentMode: false
      }))

      await expect(async () => {
        await result.current.ensureAdminUser('admin@test.com', 'password123')
      }).rejects.toThrow('Registration failed')
    })

    it('should handle email confirmation warning gracefully', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'User already exists' }
      })

      mockSupabaseAdmin.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [{
            id: mockAdminUser.id,
            email: 'admin@test.com',
            email_confirmed_at: null
          }]
        },
        error: null
      })

      mockSupabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error: { message: 'Could not confirm email' }
      })

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      let adminUser
      await act(async () => {
        adminUser = await result.current.ensureAdminUser('admin@test.com', 'password123')
      })

      // Should still return user even with confirmation warning
      expect(adminUser).toEqual({
        id: mockAdminUser.id,
        email: 'admin@test.com',
        role: 'super_admin',
        email_confirmed: true
      })
    })
  })

  describe('signInAdmin', () => {
    it('should sign in admin user successfully', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            email: mockAdminUser.email,
            email_confirmed_at: new Date().toISOString()
          }
        },
        error: null
      })

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            email: mockAdminUser.email,
            email_confirmed_at: new Date().toISOString()
          }
        },
        error: null
      })

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      let adminUser
      await act(async () => {
        adminUser = await result.current.signInAdmin('admin@test.com', 'password123')
      })

      expect(adminUser).toEqual({
        id: mockAdminUser.id,
        email: mockAdminUser.email,
        role: 'super_admin',
        email_confirmed: true
      })
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should set loading state during sign in', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            email: mockAdminUser.email,
            email_confirmed_at: new Date().toISOString()
          }
        },
        error: null
      })

      let resolveSignIn: any
      mockSupabase.auth.signInWithPassword.mockImplementation(() =>
        new Promise((resolve) => { resolveSignIn = resolve })
      )

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      act(() => {
        result.current.signInAdmin('admin@test.com', 'password123')
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true)
      })

      act(() => {
        resolveSignIn({
          data: {
            user: {
              id: mockAdminUser.id,
              email: mockAdminUser.email,
              email_confirmed_at: new Date().toISOString()
            }
          },
          error: null
        })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle email confirmation retry', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            email: mockAdminUser.email,
            email_confirmed_at: new Date().toISOString()
          }
        },
        error: null
      })

      mockSupabase.auth.signInWithPassword
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Email not confirmed' }
        })
        .mockResolvedValueOnce({
          data: {
            user: {
              id: mockAdminUser.id,
              email: mockAdminUser.email,
              email_confirmed_at: new Date().toISOString()
            }
          },
          error: null
        })

      vi.useFakeTimers()
      const { result } = renderHook(() => useAdminAuth({
        developmentMode: true,
        bypassEmailConfirmation: true
      }))

      let adminUser
      const promise = act(async () => {
        adminUser = await result.current.signInAdmin('admin@test.com', 'password123')
      })

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      await promise

      expect(adminUser).toEqual({
        id: mockAdminUser.id,
        email: mockAdminUser.email,
        role: 'super_admin',
        email_confirmed: true
      })
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('should handle sign in error without bypass', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            email: mockAdminUser.email,
            email_confirmed_at: new Date().toISOString()
          }
        },
        error: null
      })

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' }
      })

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      let adminUser
      await act(async () => {
        adminUser = await result.current.signInAdmin('admin@test.com', 'wrongpassword')
      })

      expect(adminUser).toBeNull()
      expect(result.current.error).toBe('Login failed: Invalid credentials')
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle retry failure after confirmation', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            email: mockAdminUser.email,
            email_confirmed_at: new Date().toISOString()
          }
        },
        error: null
      })

      mockSupabase.auth.signInWithPassword
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Email not confirmed' }
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Still not confirmed' }
        })

      vi.useFakeTimers()
      const { result } = renderHook(() => useAdminAuth({
        developmentMode: true,
        bypassEmailConfirmation: true
      }))

      let adminUser
      const promise = act(async () => {
        adminUser = await result.current.signInAdmin('admin@test.com', 'password123')
      })

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      await promise

      expect(adminUser).toBeNull()
      expect(result.current.error).toContain('Still not confirmed')

      vi.useRealTimers()
    })

    it('should handle ensureAdminUser error during sign in', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      let adminUser
      await act(async () => {
        adminUser = await result.current.signInAdmin('admin@test.com', 'password123')
      })

      expect(adminUser).toBeNull()
      expect(result.current.error).toBeTruthy()
    })
  })

  describe('checkAdminStatus', () => {
    it('should return true for super_admin user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            user_metadata: { role: 'super_admin' }
          }
        },
        error: null
      })

      const { result } = renderHook(() => useAdminAuth())

      let isAdmin
      await act(async () => {
        isAdmin = await result.current.checkAdminStatus()
      })

      expect(isAdmin).toBe(true)
    })

    it('should return true for admin user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            user_metadata: { role: 'admin' }
          }
        },
        error: null
      })

      const { result } = renderHook(() => useAdminAuth())

      let isAdmin
      await act(async () => {
        isAdmin = await result.current.checkAdminStatus()
      })

      expect(isAdmin).toBe(true)
    })

    it('should return false for regular user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            user_metadata: { role: 'user' }
          }
        },
        error: null
      })

      const { result } = renderHook(() => useAdminAuth())

      let isAdmin
      await act(async () => {
        isAdmin = await result.current.checkAdminStatus()
      })

      expect(isAdmin).toBe(false)
    })

    it('should return false when no user is logged in', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const { result } = renderHook(() => useAdminAuth())

      let isAdmin
      await act(async () => {
        isAdmin = await result.current.checkAdminStatus()
      })

      expect(isAdmin).toBe(false)
    })

    it('should check user_profiles table if metadata has no role', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            user_metadata: {}
          }
        },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { role: 'super_admin' },
              error: null
            }))
          }))
        }))
      })

      const { result } = renderHook(() => useAdminAuth())

      let isAdmin
      await act(async () => {
        isAdmin = await result.current.checkAdminStatus()
      })

      expect(isAdmin).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles')
    })

    it('should handle database query error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            user_metadata: {}
          }
        },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.reject(new Error('Database error')))
          }))
        }))
      })

      const { result } = renderHook(() => useAdminAuth())

      let isAdmin
      await act(async () => {
        isAdmin = await result.current.checkAdminStatus()
      })

      expect(isAdmin).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should clear error when clearError is called', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: mockAdminUser.id,
            email: mockAdminUser.email,
            email_confirmed_at: new Date().toISOString()
          }
        },
        error: null
      })

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Test error' }
      })

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      await act(async () => {
        await result.current.signInAdmin('admin@test.com', 'password123')
      })

      expect(result.current.error).toBeTruthy()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })

    it('should handle generic error objects', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockRejectedValue('String error')

      const { result } = renderHook(() => useAdminAuth({ developmentMode: true }))

      await act(async () => {
        await result.current.signInAdmin('admin@test.com', 'password123')
      })

      expect(result.current.error).toBe('Unknown error')
    })
  })
})