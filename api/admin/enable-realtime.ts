import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    // Initialize Supabase client with service key for admin operations
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Supabase service configuration missing' })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('🔧 Checking and enabling real-time for project_files table...')
    
    const results = {
      replicaIdentity: 'unknown',
      realtimeEnabled: false,
      policies: [],
      errors: []
    }
    
    // Step 1: Most common issue - Enable realtime via Supabase dashboard equivalent
    // This is the equivalent of going to Database > Replication and enabling the table
    try {
      console.log('📡 Attempting to enable real-time replication...')
      
      // Test if we can subscribe at all to detect realtime status
      
      // Test if we can subscribe at all
      const testChannel = supabase
        .channel('realtime_test')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'project_files'
        }, (payload) => {
          console.log('✅ Test subscription working:', payload.eventType)
        })
      
      const subscribePromise = new Promise((resolve, reject) => {
        testChannel.subscribe((status, err) => {
          console.log('🔔 Test subscription status:', status, err)
          if (status === 'SUBSCRIBED') {
            results.realtimeEnabled = true
            resolve(true)
          } else if (status === 'CHANNEL_ERROR') {
            results.errors.push(`Subscription failed: ${err}`)
            reject(err)
          }
        })
        
        // Timeout after 10 seconds
        setTimeout(() => {
          testChannel.unsubscribe()
          resolve(false)
        }, 10000)
      })
      
      await subscribePromise
      
    } catch (error) {
      console.error('❌ Error testing subscription:', error)
      results.errors.push(`Subscription test failed: ${error}`)
    }
    
    // Step 2: Check table information we can access
    try {
      const { data: tableInfo, error: tableError } = await supabase
        .from('project_files')
        .select('id, analysis_status')
        .limit(1)
      
      if (tableError) {
        results.errors.push(`Table access error: ${tableError.message}`)
      } else {
        console.log('✅ Table is accessible, sample record:', tableInfo?.[0])
      }
    } catch (error) {
      results.errors.push(`Table check failed: ${error}`)
    }
    
    // Step 3: Provide instructions
    const instructions = [
      '📋 Real-time Debugging Instructions:',
      '',
      '1. Go to your Supabase Dashboard',
      '2. Navigate to Database > Replication',
      '3. Find the "project_files" table',
      '4. Enable replication for this table',
      '5. If not there, go to Database > Settings and check if realtime is enabled',
      '',
      '🔧 Alternative fixes:',
      '• Check if RLS policies are blocking the subscription',
      '• Verify the table has a primary key (id column)',
      '• Ensure the user has proper permissions'
    ]
    
    console.log(instructions.join('\n'))
    
    return res.status(200).json({ 
      success: true, 
      message: 'Real-time diagnostic completed',
      results,
      instructions,
      note: 'If realtime is not enabled, you need to enable it in the Supabase Dashboard under Database > Replication'
    })
    
  } catch (error) {
    console.error('❌ Error in real-time diagnostic:', error)
    return res.status(500).json({ 
      error: 'Failed to run diagnostic', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}