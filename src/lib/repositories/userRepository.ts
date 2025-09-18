import { supabase } from '../supabase'
import { User, AuthUser } from '../../types'
import { logger } from '../../utils/logger'

/**
 * User Repository
 *
 * Handles all database operations related to users including
 * authentication, user profiles, and user management.
 */
export class UserRepository {
  /**
   * Get current authenticated user
   */
  static async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error) {
        logger.error('Error getting current user:', error)
        return null
      }

      return user as AuthUser | null
    } catch (error) {
      logger.error('Failed to get current user:', error)
      return null
    }
  }

  /**
   * Get user profile by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null
        }
        logger.error('Error fetching user profile:', error)
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      logger.error('Failed to get user by ID:', error)
      return null
    }
  }

  /**
   * Get user profile by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        logger.error('Error fetching user by email:', error)
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      logger.error('Failed to get user by email:', error)
      return null
    }
  }

  /**
   * Create or update user profile
   */
  static async upsertUserProfile(
    userId: string,
    profile: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<User | null> {
    try {
      logger.debug('Upserting user profile:', userId)

      const userData = {
        id: userId,
        ...profile,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('users')
        .upsert([userData], { onConflict: 'id' })
        .select()
        .single()

      if (error) {
        logger.error('Error upserting user profile:', error)
        throw new Error(error.message)
      }

      logger.debug('User profile upserted successfully:', userId)
      return data
    } catch (error) {
      logger.error('Failed to upsert user profile:', error)
      return null
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(
    userId: string,
    updates: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<User | null> {
    try {
      logger.debug('Updating user profile:', userId, updates)

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        logger.error('Error updating user profile:', error)
        throw new Error(error.message)
      }

      logger.debug('User profile updated successfully:', userId)
      return data
    } catch (error) {
      logger.error('Failed to update user profile:', error)
      return null
    }
  }

  /**
   * Delete user profile
   */
  static async deleteUserProfile(userId: string): Promise<boolean> {
    try {
      logger.debug('Deleting user profile:', userId)

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) {
        logger.error('Error deleting user profile:', error)
        return false
      }

      logger.debug('User profile deleted successfully:', userId)
      return true
    } catch (error) {
      logger.error('Failed to delete user profile:', error)
      return false
    }
  }

  /**
   * Get all users (admin function)
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching all users:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (error) {
      logger.error('Failed to get all users:', error)
      throw error
    }
  }

  /**
   * Search users by name or email
   */
  static async searchUsers(query: string): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('full_name', { ascending: true })

      if (error) {
        logger.error('Error searching users:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (error) {
      logger.error('Failed to search users:', error)
      return []
    }
  }

  /**
   * Update user last login time
   */
  static async updateLastLogin(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId)

      if (error) {
        logger.error('Error updating last login:', error)
      }
    } catch (error) {
      logger.error('Failed to update last login:', error)
    }
  }

  /**
   * Get user activity statistics
   */
  static async getUserStats(userId: string): Promise<{
    projectCount: number
    ideaCount: number
    joinDate: string | null
    lastActivity: string | null
  }> {
    try {
      // Get project count
      const { count: projectCount, error: projectError } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId)

      if (projectError) {
        logger.error('Error getting project count:', projectError)
      }

      // Get idea count
      const { count: ideaCount, error: ideaError } = await supabase
        .from('ideas')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId)

      if (ideaError) {
        logger.error('Error getting idea count:', ideaError)
      }

      // Get user join date
      const { data: userProfile } = await supabase
        .from('users')
        .select('created_at, last_login')
        .eq('id', userId)
        .single()

      return {
        projectCount: projectCount || 0,
        ideaCount: ideaCount || 0,
        joinDate: userProfile?.created_at || null,
        lastActivity: userProfile?.last_login || null
      }
    } catch (error) {
      logger.error('Failed to get user stats:', error)
      return {
        projectCount: 0,
        ideaCount: 0,
        joinDate: null,
        lastActivity: null
      }
    }
  }

  /**
   * Check if user has admin privileges
   */
  static async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const user = await UserRepository.getUserById(userId)
      return user?.role === 'admin' || user?.role === 'super_admin'
    } catch (error) {
      logger.error('Failed to check admin status:', error)
      return false
    }
  }

  /**
   * Update user role (admin function)
   */
  static async updateUserRole(
    userId: string,
    role: 'user' | 'admin' | 'super_admin'
  ): Promise<boolean> {
    try {
      logger.debug('Updating user role:', userId, role)

      const { error } = await supabase
        .from('users')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) {
        logger.error('Error updating user role:', error)
        return false
      }

      logger.debug('User role updated successfully:', userId, role)
      return true
    } catch (error) {
      logger.error('Failed to update user role:', error)
      return false
    }
  }

  /**
   * Deactivate user account
   */
  static async deactivateUser(userId: string): Promise<boolean> {
    try {
      logger.debug('Deactivating user:', userId)

      const { error } = await supabase
        .from('users')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        logger.error('Error deactivating user:', error)
        return false
      }

      logger.debug('User deactivated successfully:', userId)
      return true
    } catch (error) {
      logger.error('Failed to deactivate user:', error)
      return false
    }
  }

  /**
   * Reactivate user account
   */
  static async reactivateUser(userId: string): Promise<boolean> {
    try {
      logger.debug('Reactivating user:', userId)

      const { error } = await supabase
        .from('users')
        .update({
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        logger.error('Error reactivating user:', error)
        return false
      }

      logger.debug('User reactivated successfully:', userId)
      return true
    } catch (error) {
      logger.error('Failed to reactivate user:', error)
      return false
    }
  }
}