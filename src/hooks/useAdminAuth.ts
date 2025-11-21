import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'

// ✅ SECURITY FIX: supabaseAdmin removed from frontend
// Admin email bypass now requires backend API endpoint
// Development mode will use regular signup/signin flow

interface AdminAuthOptions {
  bypassEmailConfirmation?: boolean
  developmentMode?: boolean
}

interface AdminUser {
  id: string
  email: string
  role: 'admin' | 'super_admin'
  email_confirmed: boolean
}

/**
 * Admin Authentication Hook
 * Handles admin-specific authentication with email confirmation bypass for development
 */
export const useAdminAuth = (options: AdminAuthOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDevelopment = options.developmentMode ?? import.meta.env.DEV
  const shouldBypassEmailConfirmation = options.bypassEmailConfirmation ?? isDevelopment

  /**
   * Create or ensure admin user exists with confirmed email
   */
  const ensureAdminUser = useCallback(async (email: string, password: string): Promise<AdminUser | null> => {
    logger.debug('🔐 Ensuring admin user exists:', { email, isDevelopment, shouldBypassEmailConfirmation })

    try {
      // ✅ SECURITY FIX: Email confirmation bypass removed
      // Admin users must confirm email via regular Supabase flow
      // For development, manually confirm via Supabase Dashboard
      logger.debug('📝 Using regular signup for admin user')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: 'Admin User',
            role: 'super_admin'
          }
        }
      })

      if (error) {
        if (error.message.includes('already registered')) {
          logger.debug('✅ Admin user already registered')
          return null // User exists, can proceed with login
        }
        throw new Error(`Registration failed: ${error.message}`)
      }

      if (data.user) {
        return {
          id: data.user.id,
          email: data.user.email!,
          role: 'super_admin',
          email_confirmed: !!data.user.email_confirmed_at
        }
      }

      return null
    } catch (_error) {
      logger.error('❌ Failed to ensure admin user:', error)
      throw error
    }
  }, [shouldBypassEmailConfirmation])

  /**
   * Sign in admin user with automatic email confirmation bypass if needed
   */
  const signInAdmin = useCallback(async (email: string, password: string): Promise<AdminUser | null> => {
    setIsLoading(true)
    setError(null)

    try {
      logger.debug('🔐 Attempting admin sign in:', { email })

      // Ensure admin user exists and is confirmed
      await ensureAdminUser(email, password)

      // Now try to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        if (error.message.includes('Email not confirmed') && shouldBypassEmailConfirmation) {
          logger.debug('📧 Email confirmation required, attempting bypass')
          // The ensureAdminUser should have confirmed the email, retry once
          await new Promise(resolve => setTimeout(resolve, 1000)) // Brief delay

          const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
            email,
            password
          })

          if (retryError) {
            throw new Error(`Login failed after confirmation: ${retryError.message}`)
          }

          if (retryData.user) {
            return {
              id: retryData.user.id,
              email: retryData.user.email!,
              role: 'super_admin',
              email_confirmed: true
            }
          }
        } else {
          throw new Error(`Login failed: ${error.message}`)
        }
      }

      if (data.user) {
        logger.debug('✅ Admin sign in successful')
        return {
          id: data.user.id,
          email: data.user.email!,
          role: 'super_admin',
          email_confirmed: !!data.user.email_confirmed_at
        }
      }

      return null
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('❌ Admin sign in failed:', errorMessage)
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [ensureAdminUser, shouldBypassEmailConfirmation])

  /**
   * Check if current user has admin privileges
   */
  const checkAdminStatus = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      // Check role in user metadata
      const role = user.user_metadata?.role
      if (role === 'admin' || role === 'super_admin') {
        return true
      }

      // Check role in user profiles table
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      return profile?.role === 'admin' || profile?.role === 'super_admin'
    } catch (_error) {
      logger.error('❌ Failed to check admin status:', error)
      return false
    }
  }, [])

  return {
    signInAdmin,
    ensureAdminUser,
    checkAdminStatus,
    isLoading,
    error,
    clearError: () => setError(null)
  }
}