/**
 * Simple browser console test functions for locking
 * Copy and paste these into browser console
 */

// Test functions for browser console
const testLocking = {

  // Check current lock states visible on page
  checkVisibleLocks() {
    console.log('🔍 Checking visible lock states...')

    const cards = document.querySelectorAll('[class*="idea"]')
    console.log(`Found ${cards.length} potential idea elements`)

    let foundLocks = 0

    cards.forEach((card, index) => {
      const hasLockIndicator = card.textContent?.includes('🔒') ||
                              card.textContent?.includes('editing') ||
                              card.textContent?.includes('Someone editing') ||
                              card.querySelector('[class*="lock"]') ||
                              card.querySelector('[class*="edit"]')

      if (hasLockIndicator) {
        console.log(`🔒 Found locked card ${index}:`, {
          element: card,
          textContent: card.textContent?.substring(0, 100),
          classList: Array.from(card.classList)
        })
        foundLocks++
      }
    })

    console.log(`Found ${foundLocks} cards with lock indicators`)
    return foundLocks
  },

  // Check if modal is open
  checkModalOpen() {
    const modal = document.querySelector('[class*="modal"]') ||
                 document.querySelector('[class*="edit"]') ||
                 document.querySelector('div[class*="fixed"][class*="inset-0"]')

    const isOpen = !!modal
    console.log('📝 Edit modal open:', isOpen)

    if (isOpen) {
      console.log('Modal element:', modal)
      console.log('Modal content:', modal?.textContent?.substring(0, 200))
    }

    return isOpen
  },

  // Simple manual test instructions
  runManualTest() {
    console.log(`
🧪 MANUAL LOCKING TEST - INSTRUCTIONS:

Current situation: Edit modal appears to be open in this browser.

1. Keep this tab/browser open with the edit modal
2. Open another browser tab to localhost:3000 (or localhost:3001)
3. Navigate to the same project in the second tab
4. Look for lock indicators on the cards

Expected behavior:
- The card being edited in THIS tab should show as locked in the OTHER tab
- You should see a 🔒 "Someone editing" indicator

Let's check current state:
`)

    this.checkModalOpen()
    this.checkVisibleLocks()

    console.log(`
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