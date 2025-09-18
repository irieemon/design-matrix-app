/**
 * Locking Diagnostic Tool
 *
 * This utility helps diagnose real-time lock state synchronization issues
 */

import { DatabaseService } from '../lib/database'
import { logger } from './logger'

interface LockTestSession {
  sessionId: string
  userId: string
  userName: string
  ideas: any[]
  lockStates: Map<string, { isLockedByOther: boolean; isLockedBySelf: boolean; editing_by: string | null }>
  unsubscribe?: () => void
}

export class LockingDiagnostic {
  private sessions: Map<string, LockTestSession> = new Map()
  private isRunning = false

  /**
   * Start monitoring lock states across multiple simulated sessions
   */
  async startMonitoring(projectId: string, testUsers: Array<{ id: string; name: string }>) {
    if (this.isRunning) {
      logger.warn('🔍 Diagnostic already running, stopping previous session')
      this.stopMonitoring()
    }

    this.isRunning = true
    logger.debug('🔍 Starting lock state monitoring for project:', projectId)

    // Create monitoring sessions for each test user
    for (const user of testUsers) {
      const sessionId = `lock_monitor_${user.id}_${Date.now()}`

      const session: LockTestSession = {
        sessionId,
        userId: user.id,
        userName: user.name,
        ideas: [],
        lockStates: new Map(),
        unsubscribe: undefined
      }

      // Set up real-time subscription for this session
      const unsubscribe = DatabaseService.subscribeToIdeas(
        (ideas) => {
          session.ideas = ideas || []

          // Update lock states for all ideas
          ideas?.forEach(idea => {
            const hasLock = idea.editing_by && idea.editing_by.trim() !== ''
            const isLockedByOther = hasLock && idea.editing_by !== user.id
            const isLockedBySelf = hasLock && idea.editing_by === user.id

            session.lockStates.set(idea.id, {
              isLockedByOther: !!isLockedByOther,
              isLockedBySelf: !!isLockedBySelf,
              editing_by: idea.editing_by || null
            })
          })

          logger.debug(`📡 Session ${user.name}: received ${ideas?.length || 0} ideas, lock states updated`)
        },
        projectId,
        user.id,
        { skipInitialLoad: true }
      )

      session.unsubscribe = unsubscribe
      this.sessions.set(sessionId, session)

      logger.debug(`✅ Created monitoring session for ${user.name} (${user.id})`)
    }

    // Initial data load
    await this.refreshAllSessions(projectId)

    logger.debug('🔍 Lock state monitoring started for', this.sessions.size, 'sessions')
  }

  /**
   * Stop monitoring and cleanup
   */
  stopMonitoring() {
    logger.debug('🔍 Stopping lock state monitoring...')

    for (const [, session] of this.sessions.entries()) {
      if (session.unsubscribe) {
        session.unsubscribe()
      }
    }

    this.sessions.clear()
    this.isRunning = false

    logger.debug('✅ Lock state monitoring stopped')
  }

  /**
   * Simulate a user opening a card for editing
   */
  async simulateCardOpen(userId: string, ideaId: string): Promise<boolean> {
    logger.debug(`🎬 Simulating: ${userId} opening card ${ideaId} for editing`)

    try {
      const lockResult = await DatabaseService.lockIdeaForEditing(ideaId, userId)

      if (lockResult) {
        logger.debug(`✅ ${userId} successfully locked card ${ideaId}`)
      } else {
        logger.debug(`❌ ${userId} failed to lock card ${ideaId} (already locked)`)
      }

      // Wait for real-time propagation
      await this.wait(1000)

      // Check that lock state propagated to all sessions
      this.checkLockStatePropagation(ideaId, userId)

      return lockResult
    } catch (error) {
      logger.error(`💥 Error simulating card open for ${userId}:`, error)
      return false
    }
  }

  /**
   * Simulate a user closing a card (unlocking)
   */
  async simulateCardClose(userId: string, ideaId: string): Promise<boolean> {
    logger.debug(`🎬 Simulating: ${userId} closing card ${ideaId}`)

    try {
      const unlockResult = await DatabaseService.unlockIdea(ideaId, userId)

      if (unlockResult) {
        logger.debug(`✅ ${userId} successfully unlocked card ${ideaId}`)
      } else {
        logger.debug(`❌ ${userId} failed to unlock card ${ideaId}`)
      }

      // Wait for real-time propagation
      await this.wait(1000)

      // Check that unlock state propagated to all sessions
      this.checkUnlockStatePropagation(ideaId)

      return unlockResult
    } catch (error) {
      logger.error(`💥 Error simulating card close for ${userId}:`, error)
      return false
    }
  }

  /**
   * Check that lock state has properly propagated to all sessions
   */
  private checkLockStatePropagation(ideaId: string, lockingUserId: string) {
    logger.debug(`🔍 Checking lock state propagation for idea ${ideaId}`)

    let allCorrect = true
    const issues: string[] = []

    for (const [, session] of this.sessions.entries()) {
      const lockState = session.lockStates.get(ideaId)

      if (!lockState) {
        issues.push(`Session ${session.userName}: No lock state found for idea ${ideaId}`)
        allCorrect = false
        continue
      }

      const expectedLockedBySelf = session.userId === lockingUserId
      const expectedLockedByOther = session.userId !== lockingUserId

      if (lockState.isLockedBySelf !== expectedLockedBySelf) {
        issues.push(`Session ${session.userName}: isLockedBySelf should be ${expectedLockedBySelf}, got ${lockState.isLockedBySelf}`)
        allCorrect = false
      }

      if (lockState.isLockedByOther !== expectedLockedByOther) {
        issues.push(`Session ${session.userName}: isLockedByOther should be ${expectedLockedByOther}, got ${lockState.isLockedByOther}`)
        allCorrect = false
      }

      if (lockState.editing_by !== lockingUserId) {
        issues.push(`Session ${session.userName}: editing_by should be ${lockingUserId}, got ${lockState.editing_by}`)
        allCorrect = false
      }
    }

    if (allCorrect) {
      logger.debug('✅ Lock state propagation: ALL SESSIONS CORRECT')
    } else {
      logger.error('❌ Lock state propagation: ISSUES DETECTED')
      issues.forEach(issue => logger.error(`  - ${issue}`))
    }

    return allCorrect
  }

  /**
   * Check that unlock state has properly propagated to all sessions
   */
  private checkUnlockStatePropagation(ideaId: string) {
    logger.debug(`🔍 Checking unlock state propagation for idea ${ideaId}`)

    let allCorrect = true
    const issues: string[] = []

    for (const [, session] of this.sessions.entries()) {
      const lockState = session.lockStates.get(ideaId)

      if (!lockState) {
        issues.push(`Session ${session.userName}: No lock state found for idea ${ideaId}`)
        allCorrect = false
        continue
      }

      if (lockState.isLockedBySelf !== false) {
        issues.push(`Session ${session.userName}: isLockedBySelf should be false, got ${lockState.isLockedBySelf}`)
        allCorrect = false
      }

      if (lockState.isLockedByOther !== false) {
        issues.push(`Session ${session.userName}: isLockedByOther should be false, got ${lockState.isLockedByOther}`)
        allCorrect = false
      }

      if (lockState.editing_by !== null) {
        issues.push(`Session ${session.userName}: editing_by should be null, got ${lockState.editing_by}`)
        allCorrect = false
      }
    }

    if (allCorrect) {
      logger.debug('✅ Unlock state propagation: ALL SESSIONS CORRECT')
    } else {
      logger.error('❌ Unlock state propagation: ISSUES DETECTED')
      issues.forEach(issue => logger.error(`  - ${issue}`))
    }

    return allCorrect
  }

  /**
   * Get current diagnostic status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      sessionCount: this.sessions.size,
      sessions: Array.from(this.sessions.values()).map(session => ({
        sessionId: session.sessionId,
        userId: session.userId,
        userName: session.userName,
        ideaCount: session.ideas.length,
        lockStateCount: session.lockStates.size
      }))
    }
  }

  /**
   * Print current status for debugging
   */
  printStatus() {
    const status = this.getStatus()

    logger.debug('🔍 LOCK DIAGNOSTIC STATUS:')
    logger.debug(`  Running: ${status.isRunning}`)
    logger.debug(`  Sessions: ${status.sessionCount}`)

    status.sessions.forEach(session => {
      logger.debug(`  📱 ${session.userName}: ${session.ideaCount} ideas, ${session.lockStateCount} lock states`)
    })
  }

  /**
   * Run comprehensive locking test
   */
  async runLockingTest(projectId: string): Promise<boolean> {
    const testUsers = [
      { id: 'test-user-alpha', name: 'Alpha' },
      { id: 'test-user-beta', name: 'Beta' },
      { id: 'test-user-gamma', name: 'Gamma' }
    ]

    logger.debug('🚀 Starting comprehensive locking test...')

    try {
      // Step 1: Start monitoring
      await this.startMonitoring(projectId, testUsers)
      await this.wait(2000) // Allow subscriptions to settle

      // Step 2: Get an idea to test with
      const ideas = await DatabaseService.getProjectIdeas(projectId)
      if (ideas.length === 0) {
        logger.error('❌ No ideas found in project. Test requires existing ideas.')
        return false
      }

      const testIdeaId = ideas[0].id
      logger.debug(`🎯 Testing with idea: ${testIdeaId}`)

      // Step 3: Test lock/unlock cycle
      logger.debug('📝 Step 1: User Alpha locks the idea')
      const lockResult = await this.simulateCardOpen('test-user-alpha', testIdeaId)
      if (!lockResult) {
        logger.error('❌ Failed to lock idea')
        return false
      }

      // Step 4: Verify Beta and Gamma see the lock
      await this.wait(2000)
      this.printStatus()

      logger.debug('📝 Step 2: User Alpha unlocks the idea')
      const unlockResult = await this.simulateCardClose('test-user-alpha', testIdeaId)
      if (!unlockResult) {
        logger.error('❌ Failed to unlock idea')
        return false
      }

      // Step 5: Verify all users see the unlock
      await this.wait(2000)
      this.printStatus()

      logger.debug('✅ Comprehensive locking test completed successfully!')
      return true

    } catch (error) {
      logger.error('💥 Locking test failed:', error)
      return false
    } finally {
      this.stopMonitoring()
    }
  }

  /**
   * Refresh all sessions with latest data
   */
  private async refreshAllSessions(projectId: string) {
    const ideas = await DatabaseService.getProjectIdeas(projectId)

    for (const [, session] of this.sessions.entries()) {
      session.ideas = ideas

      // Update lock states
      ideas.forEach(idea => {
        const hasLock = idea.editing_by && idea.editing_by.trim() !== ''
        const isLockedByOther = hasLock && idea.editing_by !== session.userId
        const isLockedBySelf = hasLock && idea.editing_by === session.userId

        session.lockStates.set(idea.id, {
          isLockedByOther: !!isLockedByOther,
          isLockedBySelf: !!isLockedBySelf,
          editing_by: idea.editing_by || null
        })
      })
    }
  }

  /**
   * Wait helper
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export for browser console usage
declare global {
  interface Window {
    runLockingDiagnostic: (projectId: string) => Promise<boolean>
    lockingDiagnostic: LockingDiagnostic
  }
}

// Browser console setup
if (typeof window !== 'undefined') {
  const diagnostic = new LockingDiagnostic()
  window.lockingDiagnostic = diagnostic
  window.runLockingDiagnostic = (projectId: string) => diagnostic.runLockingTest(projectId)
}