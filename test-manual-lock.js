/**
 * Manual test script to verify locking functionality
 * This helps test the specific issue: "card is not locking when open in one browser"
 */

console.log('🧪 Manual Locking Test Script Loaded')
console.log('Open this in multiple browser tabs to test multi-browser locking')

// Test functions to expose in browser console
window.testLocking = {

  // Simulate opening a card (manual lock test)
  async lockCard(ideaId, userId = 'test-user-123') {
    console.log(`🔒 Testing: Lock card ${ideaId} for user ${userId}`)

    try {
      // This simulates what happens when EditIdeaModal opens
      const response = await fetch('/api/ideas/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId, userId })
      })

      console.log('Lock response:', response)
      return response.ok
    } catch (error) {
      console.error('Lock test failed:', error)

      // Fallback: Try direct database call if available
      if (window.DatabaseService) {
        console.log('Trying direct database call...')
        const result = await window.DatabaseService.lockIdeaForEditing(ideaId, userId)
        console.log('Direct lock result:', result)
        return result
      }

      return false
    }
  },

  // Simulate closing a card (manual unlock test)
  async unlockCard(ideaId, userId = 'test-user-123') {
    console.log(`🔓 Testing: Unlock card ${ideaId} for user ${userId}`)

    try {
      const response = await fetch('/api/ideas/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId, userId })
      })

      console.log('Unlock response:', response)
      return response.ok
    } catch (error) {
      console.error('Unlock test failed:', error)

      // Fallback: Try direct database call if available
      if (window.DatabaseService) {
        console.log('Trying direct database call...')
        const result = await window.DatabaseService.unlockIdea(ideaId, userId)
        console.log('Direct unlock result:', result)
        return result
      }

      return false
    }
  },

  // Check current lock state of a card
  async checkLockState(ideaId) {
    console.log(`🔍 Checking lock state for card ${ideaId}`)

    try {
      // Try to find the idea in current state
      const ideas = document.querySelectorAll('[data-testid*="idea-card"]')
      console.log(`Found ${ideas.length} idea cards on page`)

      for (const card of ideas) {
        if (card.textContent.includes(ideaId) || card.dataset.ideaId === ideaId) {
          const isLocked = card.querySelector('.editing-indicator') ||
                          card.textContent.includes('editing') ||
                          card.textContent.includes('🔒') ||
                          card.classList.contains('locked')

          console.log(`Card ${ideaId} lock state:`, {
            element: card,
            hasLockIndicator: !!isLocked,
            classList: Array.from(card.classList),
            textContent: card.textContent.substring(0, 100)
          })

          return isLocked
        }
      }

      console.log(`Card ${ideaId} not found on page`)
      return false

    } catch (error) {
      console.error('Check lock state failed:', error)
      return false
    }
  },

  // Full test scenario
  async runFullTest() {
    console.log('🚀 Running full locking test scenario...')

    // Get first available idea
    const ideas = document.querySelectorAll('[data-testid*="idea-card"]')
    if (ideas.length === 0) {
      console.error('❌ No ideas found on page. Make sure you are on the matrix page with ideas.')
      return false
    }

    const firstCard = ideas[0]
    const ideaId = firstCard.dataset.ideaId || 'test-idea-' + Date.now()

    console.log(`🎯 Testing with idea: ${ideaId}`)

    // Step 1: Check initial state
    console.log('Step 1: Check initial lock state')
    await this.checkLockState(ideaId)

    // Step 2: Lock the card
    console.log('Step 2: Lock the card')
    const lockResult = await this.lockCard(ideaId)
    console.log('Lock result:', lockResult)

    // Step 3: Check locked state
    console.log('Step 3: Check locked state (after 2 seconds)')
    setTimeout(async () => {
      await this.checkLockState(ideaId)

      // Step 4: Unlock the card
      console.log('Step 4: Unlock the card')
      const unlockResult = await this.unlockCard(ideaId)
      console.log('Unlock result:', unlockResult)

      // Step 5: Check final state
      console.log('Step 5: Check final state (after 2 seconds)')
      setTimeout(async () => {
        await this.checkLockState(ideaId)
        console.log('✅ Full test completed')
      }, 2000)

    }, 2000)

    return true
  }
}

// Instructions for user
console.log(`
🧪 MANUAL LOCKING TEST INSTRUCTIONS:

1. Open this application in TWO browser tabs/windows
2. Navigate to the matrix page with ideas in both tabs
3. In the first tab console, run: testLocking.runFullTest()
4. Watch both tabs - the second tab should show the lock state changes

Manual commands:
- testLocking.lockCard('idea-id') - Lock a specific card
- testLocking.unlockCard('idea-id') - Unlock a specific card
- testLocking.checkLockState('idea-id') - Check current lock state
- testLocking.runFullTest() - Run complete test scenario

Expected behavior:
- When you lock in tab 1, tab 2 should show the card as locked
- When you unlock in tab 1, tab 2 should show the card as unlocked
`)

export {};