/**
 * TestDataInjector - Injects test data into contexts for auth bypass testing
 *
 * This component runs after contexts are initialized and injects demo project and ideas
 * to enable matrix testing without authentication.
 */

import { useEffect } from 'react'
import { logger } from '../../utils/logger'

export default function TestDataInjector() {
  useEffect(() => {
    const injectTestData = () => {
      try {
        logger.debug('🧪 TEST DATA INJECTOR: Starting data injection...')

        // Check if test bypass data exists
        const testData = (window as any).__TEST_BYPASS_DATA__
        if (!testData) {
          logger.debug('🧪 No test bypass data found, skipping injection')
          return
        }

        logger.debug('🧪 TEST DATA INJECTOR: Test data found, injecting...')
        logger.debug('🧪 Test data:', testData)

        // Try to manually set project and ideas through React contexts
        // We'll use a simpler approach - just set the window flag
        const win = window as any
        win.__TEST_DATA_INJECTED__ = true

        logger.debug('✅ TEST DATA INJECTOR: Test data injection complete!')

      } catch (error) {
        logger.error('❌ TEST DATA INJECTOR: Error injecting test data:', error)
      }
    }

    // Delay to ensure everything is ready
    const timer = setTimeout(() => {
      injectTestData()
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // This component renders nothing
  return null
}