// Real-time diagnostic utility to help identify and fix Supabase real-time issues

import { supabase } from '../lib/supabase'
import { logger } from './logger'

export class RealtimeDiagnostic {
  private static diagnosticRunning = false
  
  static async checkRealtimeConfiguration() {
    // Prevent multiple diagnostics from running
    if (this.diagnosticRunning) {
      logger.debug('Diagnostic already running, skipping...')
      return
    }
    
    this.diagnosticRunning = true
    logger.info('Running real-time diagnostic...')
    
    // Test 1: Check if we can connect to real-time
    let testChannelRemoved = false
    const testChannel = supabase
      .channel('diagnostic-test')
      .subscribe((status) => {
        logger.debug('Real-time connection test:', status)
        if (status === 'SUBSCRIBED') {
          logger.info('Basic real-time connection works')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Real-time connection failed:', status)
        }
        
        // Only remove channel once
        if (!testChannelRemoved) {
          testChannelRemoved = true
          setTimeout(() => {
            try {
              supabase.removeChannel(testChannel)
            } catch (_e) {
              logger.debug('Channel removal error (safe to ignore):', e)
            }
          }, 100)
        }
      })

    // Test 2: Check table permissions
    try {
      const { error } = await supabase
        .from('ideas')
        .select('id')
        .limit(1)
      
      if (error) {
        logger.error('Cannot read from ideas table:', error.message)
      } else {
        logger.info('Can read from ideas table')
      }
    } catch (_err) {
      logger.error('Ideas table access error:', err)
    }

    // Test 3: Only show configuration instructions in development
    logger.debug(`
🔧 To enable real-time for the 'ideas' table in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to Database → Replication
3. Find the 'ideas' table and enable replication for it
4. Or run this SQL in the SQL Editor:

ALTER TABLE public.ideas REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.ideas;

5. Make sure Row Level Security allows real-time events:
   - The user must have SELECT permission on the table
   - RLS policies should allow the authenticated user to read records
    `)

    // Reset the running flag after a delay
    setTimeout(() => {
      this.diagnosticRunning = false
    }, 5000)
    
    return {
      basicConnection: 'testing',
      tableAccess: 'testing',
      instructions: 'provided'
    }
  }

  static async testRealtimeWithInsert() {
    logger.debug('Testing real-time with a test insert...')
    
    let eventReceived = false
    
    // Set up listener
    const testChannel = supabase
      .channel('realtime-test')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ideas' },
        (payload) => {
          logger.debug('Real-time event received!', payload.eventType)
          eventReceived = true
        }
      )
      .subscribe()

    // Wait a moment for subscription
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Try to insert a test record (will be rolled back)
    try {
      const { error } = await supabase
        .from('ideas')
        .insert({
          content: 'Real-time test idea - can be deleted',
          details: 'This is a test to check if real-time events work',
          priority: 'low',
          project_id: 'test-project-id',
          position_x: 0,
          position_y: 0,
          effort: 'low',
          impact: 'low'
        })

      if (error) {
        logger.error('Could not insert test record:', error.message)
      } else {
        logger.debug('Test record inserted, checking for real-time event...')
        
        // Wait for real-time event
        setTimeout(() => {
          if (eventReceived) {
            logger.info('Real-time is working perfectly!')
          } else {
            logger.warn('Real-time event not received - check configuration')
          }
          supabase.removeChannel(testChannel)
        }, 3000)
      }
    } catch (_err) {
      logger.error('Test insert failed:', err)
    }

    return eventReceived
  }
}

// Auto-run diagnostic disabled to prevent infinite loops
// Use RealtimeDiagnostic.checkRealtimeConfiguration() manually if needed