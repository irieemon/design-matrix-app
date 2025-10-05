/* eslint-disable no-console */
/**
 * Simple browser console test functions for locking
 * Copy and paste these into browser console
 */

import { logger } from '../lib/logging'

// Test functions for browser console
const testLocking = {

  // Check current lock states visible on page
  checkVisibleLocks() {
    logger.debug('Checking visible lock states')

    const cards = document.querySelectorAll('[class*="idea"]')
    logger.debug('Found potential idea elements', { count: cards.length })

    let foundLocks = 0

    cards.forEach((card, index) => {
      const hasLockIndicator = card.textContent?.includes('🔒') ||
                              card.textContent?.includes('editing') ||
                              card.textContent?.includes('Someone editing') ||
                              card.querySelector('[class*="lock"]') ||
                              card.querySelector('[class*="edit"]')

      if (hasLockIndicator) {
        logger.debug('Found locked card', {
          index,
          element: card,
          textContent: card.textContent?.substring(0, 100),
          classList: Array.from(card.classList)
        })
        foundLocks++
      }
    })

    logger.debug('Cards with lock indicators found', { count: foundLocks })
    return foundLocks
  },

  // Check if modal is open
  checkModalOpen() {
    const modal = document.querySelector('[class*="modal"]') ||
                 document.querySelector('[class*="edit"]') ||
                 document.querySelector('div[class*="fixed"][class*="inset-0"]')

    const isOpen = !!modal
    logger.debug('Edit modal open', { isOpen })

    if (isOpen) {
      logger.debug('Modal element', { modal })
      logger.debug('Modal content', { content: modal?.textContent?.substring(0, 200) })
    }

    return isOpen
  },

  // Simple manual test instructions
  runManualTest() {
    logger.info(`
MANUAL LOCKING TEST - INSTRUCTIONS:

Current situation: Edit modal appears to be open in this browser.

1. Keep this tab/browser open with the edit modal
2. Open another browser tab to localhost:3000 (or localhost:3001)
3. Navigate to the same project in the second tab
4. Look for lock indicators on the cards

Expected behavior:
- The card being edited in THIS tab should show as locked in the OTHER tab
- You should see a lock "Someone editing" indicator

Let's check current state:
`)

    this.checkModalOpen()
    this.checkVisibleLocks()

    logger.info(`
Next steps:
1. Open second browser tab
2. Run: testLocking.checkVisibleLocks() in the second tab
3. Compare results between tabs
`)
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).testLocking = testLocking
}

export default testLocking