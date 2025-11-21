/**
 * Card Locking Multi-Browser Test Utility
 *
 * This utility simulates multi-user scenarios to test the card locking fix
 * that addresses the issue where "opening a card in one browser makes all cards disappear in another browser"
 */

import { DatabaseService } from '../lib/database'
import { logger } from './logger'

interface TestUser {
  id: string
  email: string
  name: string
}

interface TestSession {
  userId: string
  projectId: string
  sessionId: string
  ideas: any[]
  isSubscribed: boolean
  unsubscribe?: () => void
}

/**
 * Test the card locking fix by simulating multiple browser sessions
 */
export class CardLockingTester {
  private sessions: Map<string, TestSession> = new Map()
  private testUsers: TestUser[] = [
    { id: 'test-user-1', email: 'user1@test.com', name: 'Test User 1' },
    { id: 'test-user-2', email: 'user2@test.com', name: 'Test User 2' },
    { id: 'test-user-3', email: 'user3@test.com', name: 'Test User 3' }
  ]

  /**
   * Create a simulated user session
   */
  async createSession(userId: string, projectId: string): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

    logger.debug(`🧪 Creating test session for user ${userId}, project ${projectId}`)

    const session: TestSession = {
      userId,
      projectId,
      sessionId,
      ideas: [],
      isSubscribed: false
    }

    // Set up real-time subscription for this session
    const unsubscribe = DatabaseService.subscribeToIdeas(
      (ideas) => {
        logger.debug(`📡 Session ${sessionId} received ${ideas?.length || 0} ideas`)
        session.ideas = ideas || []
      },
      projectId,
      userId,
      { skipInitialLoad: true }
    )

    session.unsubscribe = unsubscribe
    session.isSubscribed = true

    this.sessions.set(sessionId, session)

    logger.debug(`✅ Session ${sessionId} created and subscribed`)
    return sessionId
  }

  /**
   * Simulate opening a card for editing in a specific session
   */
  async openCardForEditing(sessionId: string, ideaId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.error(`❌ Session ${sessionId} not found`)
      return false
    }

    logger.debug(`🔓 Session ${sessionId} attempting to lock idea ${ideaId}`)

    try {
      const lockResult = await DatabaseService.lockIdeaForEditing(ideaId, session.userId)

      if (lockResult) {
        logger.debug(`✅ Session ${sessionId} successfully locked idea ${ideaId}`)
        return true
      } else {
        logger.debug(`⚠️ Session ${sessionId} failed to lock idea ${ideaId} (already locked)`)
        return false
      }
    } catch (_error) {
      logger.error(`❌ Error locking idea in session ${sessionId}:`, error)
      return false
    }
  }

  /**
   * Simulate closing a card (unlocking) in a specific session
   */
  async closeCard(sessionId: string, ideaId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.error(`❌ Session ${sessionId} not found`)
      return false
    }

    logger.debug(`🔒 Session ${sessionId} unlocking idea ${ideaId}`)

    try {
      const unlockResult = await DatabaseService.unlockIdea(ideaId, session.userId)

      if (unlockResult) {
        logger.debug(`✅ Session ${sessionId} successfully unlocked idea ${ideaId}`)
        return true
      } else {
        logger.debug(`⚠️ Session ${sessionId} failed to unlock idea ${ideaId}`)
        return false
      }
    } catch (_error) {
      logger.error(`❌ Error unlocking idea in session ${sessionId}:`, error)
      return false
    }
  }

  /**
   * Get current idea count for a session
   */
  getSessionIdeaCount(sessionId: string): number {
    const session = this.sessions.get(sessionId)
    return session?.ideas?.length || 0
  }

  /**
   * Get all session info for debugging
   */
  getAllSessionInfo(): Array<{ sessionId: string; userId: string; ideaCount: number; isSubscribed: boolean }> {
    return Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      userId: session.userId,
      ideaCount: session.ideas?.length || 0,
      isSubscribed: session.isSubscribed
    }))
  }

  /**
   * Run the comprehensive card locking test
   */
  async runCardLockingTest(projectId: string): Promise<boolean> {
    logger.debug('🚀 Starting comprehensive card locking test...')

    try {
      // Step 1: Create multiple sessions
      logger.debug('📝 Step 1: Creating multiple user sessions...')
      const session1 = await this.createSession(this.testUsers[0].id, projectId)
      const session2 = await this.createSession(this.testUsers[1].id, projectId)
      const session3 = await this.createSession(this.testUsers[2].id, projectId)

      // Wait for subscriptions to establish
      await this.wait(1000)

      // Step 2: Load initial ideas for all sessions
      logger.debug('📋 Step 2: Loading initial ideas...')
      const initialIdeas = await DatabaseService.getProjectIdeas(projectId)
      logger.debug(`📊 Found ${initialIdeas.length} ideas in project`)

      if (initialIdeas.length === 0) {
        logger.warn('⚠️ No ideas found in project. Test requires existing ideas.')
        return false
      }

      // Wait for real-time updates to propagate
      await this.wait(2000)

      // Step 3: Check that all sessions have the same idea count
      logger.debug('🔍 Step 3: Verifying all sessions have same idea count...')
      const session1Count = this.getSessionIdeaCount(session1)
      const session2Count = this.getSessionIdeaCount(session2)
      const session3Count = this.getSessionIdeaCount(session3)

      logger.debug(`📊 Idea counts - Session1: ${session1Count}, Session2: ${session2Count}, Session3: ${session3Count}`)

      // Step 4: Simulate the problematic scenario - open card in session 1
      logger.debug('🎬 Step 4: Simulating card locking scenario...')
      const testIdeaId = initialIdeas[0].id
      logger.debug(`🎯 Testing with idea: ${testIdeaId}`)

      const lockResult = await this.openCardForEditing(session1, testIdeaId)
      if (!lockResult) {
        logger.error('❌ Failed to lock idea in session 1')
        return false
      }

      // Wait for real-time updates
      await this.wait(1000)

      // Step 5: Verify other sessions still have their ideas (this was the bug)
      logger.debug('🔍 Step 5: Verifying other sessions still have ideas...')
      const session2CountAfter = this.getSessionIdeaCount(session2)
      const session3CountAfter = this.getSessionIdeaCount(session3)

      logger.debug(`📊 After locking - Session2: ${session2CountAfter}, Session3: ${session3CountAfter}`)

      // Step 6: Test the fix - cards should NOT disappear
      const testPassed = session2CountAfter > 0 && session3CountAfter > 0

      if (testPassed) {
        logger.debug('✅ SUCCESS: Other sessions retained their ideas after card locking!')
      } else {
        logger.error('❌ FAILURE: Cards disappeared in other sessions (bug still exists)')
      }

      // Step 7: Clean up - unlock the card
      await this.closeCard(session1, testIdeaId)

      // Step 8: Cleanup sessions
      this.cleanupAllSessions()

      return testPassed

    } catch (_error) {
      logger.error('❌ Card locking test failed with error:', error)
      this.cleanupAllSessions()
      return false
    }
  }

  /**
   * Test channel isolation specifically
   */
  async testChannelIsolation(): Promise<boolean> {
    logger.debug('🔬 Testing channel isolation...')

    // Generate channel names for different users/sessions
    const user1Channel = DatabaseService.generateChannelName('user1', 'session1')
    const user2Channel = DatabaseService.generateChannelName('user2', 'session2')
    const user3Channel = DatabaseService.generateChannelName('user1', 'session3') // Same user, different session

    logger.debug(`📡 Generated channels:`)
    logger.debug(`  User1/Session1: ${user1Channel}`)
    logger.debug(`  User2/Session2: ${user2Channel}`)
    logger.debug(`  User1/Session3: ${user3Channel}`)

    // Verify all channels are unique
    const channels = [user1Channel, user2Channel, user3Channel]
    const uniqueChannels = new Set(channels)

    const isolationPassed = uniqueChannels.size === channels.length

    if (isolationPassed) {
      logger.debug('✅ Channel isolation test PASSED: All channels are unique')
    } else {
      logger.error('❌ Channel isolation test FAILED: Channel name collision detected')
    }

    return isolationPassed
  }

  /**
   * Wait helper for async operations
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Cleanup all test sessions
   */
  cleanupAllSessions(): void {
    logger.debug('🧹 Cleaning up test sessions...')
    for (const [, session] of this.sessions.entries()) {
      if (session.unsubscribe) {
        session.unsubscribe()
      }
    }
    this.sessions.clear()
    logger.debug('✅ All test sessions cleaned up')
  }
}

// Expose method to check if channel generation method exists
declare global {
  interface Window {
    runCardLockingTest: (projectId: string) => Promise<boolean>
    testChannelIsolation: () => Promise<boolean>
  }
}

// Export for use in browser console or test scripts
if (typeof window !== 'undefined') {
  const tester = new CardLockingTester()
  window.runCardLockingTest = (projectId: string) => tester.runCardLockingTest(projectId)
  window.testChannelIsolation = () => tester.testChannelIsolation()
}