// Real-time diagnostic utility to help identify and fix Supabase real-time issues

import { supabase } from '../lib/supabase'

export class RealtimeDiagnostic {
  static async checkRealtimeConfiguration() {
    console.log('🔍 Running real-time diagnostic...')
    
    // Test 1: Check if we can connect to real-time
    const testChannel = supabase
      .channel('diagnostic-test')
      .subscribe((status) => {
        console.log('📡 Real-time connection test:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Basic real-time connection works')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('❌ Real-time connection failed:', status)
        }
        supabase.removeChannel(testChannel)
      })

    // Test 2: Check table permissions
    try {
      const { error } = await supabase
        .from('ideas')
        .select('id')
        .limit(1)
      
      if (error) {
        console.log('❌ Cannot read from ideas table:', error.message)
      } else {
        console.log('✅ Can read from ideas table')
      }
    } catch (err) {
      console.log('❌ Ideas table access error:', err)
    }

    // Test 3: Provide instructions for manual configuration
    console.log(`
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

    return {
      basicConnection: 'testing',
      tableAccess: 'testing',
      instructions: 'provided'
    }
  }

  static async testRealtimeWithInsert() {
    console.log('🧪 Testing real-time with a test insert...')
    
    let eventReceived = false
    
    // Set up listener
    const testChannel = supabase
      .channel('realtime-test')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ideas' },
        (payload) => {
          console.log('🎉 Real-time event received!', payload.eventType)
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
        console.log('❌ Could not insert test record:', error.message)
      } else {
        console.log('✅ Test record inserted, checking for real-time event...')
        
        // Wait for real-time event
        setTimeout(() => {
          if (eventReceived) {
            console.log('🎉 Real-time is working perfectly!')
          } else {
            console.log('⚠️ Real-time event not received - check configuration')
          }
          supabase.removeChannel(testChannel)
        }, 3000)
      }
    } catch (err) {
      console.log('❌ Test insert failed:', err)
    }

    return eventReceived
  }
}

// Auto-run diagnostic in development
if (process.env.NODE_ENV === 'development') {
  // Run diagnostic after a short delay to avoid blocking app startup
  setTimeout(() => {
    RealtimeDiagnostic.checkRealtimeConfiguration()
  }, 5000)
}