/**
 * IdeaLockingService - Handles idea editing lock mechanism
 *
 * Provides distributed locking for idea editing to prevent concurrent modifications.
 * Includes debouncing, timeout management, and stale lock cleanup.
 */

import { supabase } from '../../supabase'
import { logger } from '../../../utils/logger'
import { DatabaseHelpers } from '../utils/DatabaseHelpers'

export class IdeaLockingService {
  // Debounce map to prevent rapid-fire updates
  private static lockDebounceMap = new Map<string, NodeJS.Timeout>()

  // Lock timeout: 5 minutes
  private static readonly LOCK_TIMEOUT_MS = 5 * 60 * 1000

  /**
   * Lock an idea for editing with debouncing
   */
  static async lockIdeaForEditing(ideaId: string, userId: string): Promise<boolean> {
    try {
      const debounceKey = `${ideaId}_${userId}_lock`

      // Clear existing debounce if any
      if (this.lockDebounceMap.has(debounceKey)) {
        clearTimeout(this.lockDebounceMap.get(debounceKey)!)
      }

      // First check if it's already locked by someone else
      const { data: existingIdea, error: fetchError } = await supabase
        .from('ideas')
        .select('editing_by, editing_at')
        .eq('id', ideaId)
        .single()

      if (fetchError) {
        logger.error('Error checking idea lock:', fetchError)
        return false
      }

      // Check if it's locked by someone else (within the last 5 minutes)
      if (existingIdea.editing_by && existingIdea.editing_by !== userId) {
        const editingAt = new Date(existingIdea.editing_at || '')
        const now = new Date()
        const timeDiff = now.getTime() - editingAt.getTime()

        // If locked within the last 5 minutes by someone else, deny lock
        if (timeDiff < this.LOCK_TIMEOUT_MS) {
          return false
        }
      }

      // Debounce lock updates - only update if same user hasn't locked recently
      if (existingIdea.editing_by === userId) {
        DatabaseHelpers.throttledLog(
          `lock_debounce_${ideaId}`,
          '🔒 User already has lock, skipping timestamp update to prevent flashing',
          undefined,
          10000
        )

        // DISABLE timestamp updates to prevent flashing - the initial lock is enough
        // The 5-minute timeout will be handled by UI logic instead of database heartbeat
        return true
      }

      // Lock the idea for editing (first time)
      const { error } = await supabase
        .from('ideas')
        .update({
          editing_by: userId,
          editing_at: DatabaseHelpers.formatTimestamp()
        })
        .eq('id', ideaId)

      if (error) {
        logger.error('Error locking idea:', error)
        return false
      }

      return true
    } catch (_error) {
      logger.error('Database error in lockIdeaForEditing:', error)
      return false
    }
  }

  /**
   * Unlock an idea for editing
   */
  static async unlockIdea(ideaId: string, userId: string): Promise<boolean> {
    try {
      // Only unlock if the current user is the one who locked it
      const { error } = await supabase
        .from('ideas')
        .update({
          editing_by: null,
          editing_at: null
        })
        .eq('id', ideaId)
        .eq('editing_by', userId)

      if (error) {
        logger.error('Error unlocking idea:', error)
        return false
      }

      return true
    } catch (_error) {
      logger.error('Database error in unlockIdea:', error)
      return false
    }
  }

  /**
   * Clean up stale locks (older than 5 minutes)
   */
  static async cleanupStaleLocks(): Promise<void> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - this.LOCK_TIMEOUT_MS).toISOString()

      await supabase
        .from('ideas')
        .update({
          editing_by: null,
          editing_at: null
        })
        .lt('editing_at', fiveMinutesAgo)
        .not('editing_by', 'is', null)
    } catch (_error) {
      logger.error('Error cleaning up stale locks:', error)
    }
  }

  /**
   * Get lock information for an idea
   */
  static async getLockInfo(ideaId: string): Promise<{
    isLocked: boolean
    lockedBy?: string
    lockedAt?: string
    expiresAt?: string
  }> {
    try {
      const { data, error } = await supabase
        .from('ideas')
        .select('editing_by, editing_at')
        .eq('id', ideaId)
        .single()

      if (error || !data.editing_by) {
        return { isLocked: false }
      }

      const lockedAt = new Date(data.editing_at)
      const expiresAt = new Date(lockedAt.getTime() + this.LOCK_TIMEOUT_MS)

      return {
        isLocked: true,
        lockedBy: data.editing_by,
        lockedAt: data.editing_at,
        expiresAt: expiresAt.toISOString()
      }
    } catch (_error) {
      logger.error('Error getting lock info:', error)
      return { isLocked: false }
    }
  }

  /**
   * Check if user can edit the idea (not locked or locked by same user)
   */
  static async canUserEdit(ideaId: string, userId: string): Promise<boolean> {
    const lockInfo = await this.getLockInfo(ideaId)

    if (!lockInfo.isLocked) {
      return true
    }

    // Check if lock has expired
    if (lockInfo.expiresAt) {
      const now = new Date()
      const expiresAt = new Date(lockInfo.expiresAt)
      if (now > expiresAt) {
        return true
      }
    }

    // Check if locked by same user
    return lockInfo.lockedBy === userId
  }

  /**
   * Clean up debounce timers (call on service shutdown)
   */
  static cleanup(): void {
    for (const timeout of this.lockDebounceMap.values()) {
      clearTimeout(timeout)
    }
    this.lockDebounceMap.clear()
  }
}
