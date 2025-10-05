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
    
    console.log('🔧 Enabling real-time for project_files table using SQL...')
    
    const results = []
    
    // Step 1: Set replica identity to FULL (required for UPDATE events to include old and new values)
    try {
      console.log('📋 Setting replica identity to FULL...')
      const { data: _data, error } = await supabase.rpc('sql', {
        query: 'ALTER TABLE public.project_files REPLICA IDENTITY FULL;'
      })
      
      if (error) {
        console.log('⚠️ Replica identity error (may already be set):', error.message)
        results.push({ step: 'replica_identity', success: false, error: error.message })
      } else {
        console.log('✅ Replica identity set to FULL')
        results.push({ step: 'replica_identity', success: true })
      }
    } catch (error) {
      console.error('❌ Error setting replica identity:', error)
      results.push({ step: 'replica_identity', success: false, error: String(error) })
    }
    
    // Step 2: Add table to realtime publication
    try {
      console.log('📡 Adding table to realtime publication...')
      const { data: _data2, error } = await supabase.rpc('sql', {
        query: 'ALTER publication supabase_realtime ADD TABLE public.project_files;'
      })
      
      if (error) {
        console.log('⚠️ Publication error (may already be added):', error.message)
        results.push({ step: 'add_to_publication', success: false, error: error.message })
      } else {
        console.log('✅ Table added to realtime publication')
        results.push({ step: 'add_to_publication', success: true })
      }
    } catch (error) {
      console.error('❌ Error adding to publication:', error)
      results.push({ step: 'add_to_publication', success: false, error: String(error) })
    }
    
    // Step 3: Verify the publication includes our table
    try {
      console.log('🔍 Verifying table is in publication...')
      const { data, error } = await supabase.rpc('sql', {
        query: `
          SELECT schemaname, tablename 
          FROM pg_publication_tables 
          WHERE pubname = 'supabase_realtime' 
          AND tablename = 'project_files';
        `
      })
      
      if (error) {
        console.log('⚠️ Verification error:', error.message)
        results.push({ step: 'verify_publication', success: false, error: error.message })
      } else {
        console.log('✅ Publication verification:', data)
        results.push({ step: 'verify_publication', success: true, data })
      }
    } catch (error) {
      console.error('❌ Error verifying publication:', error)
      results.push({ step: 'verify_publication', success: false, error: String(error) })
    }
    
    // Step 4: Test subscription
    try {
      console.log('🧪 Testing real-time subscription...')
      
      const testChannel = supabase
        .channel('realtime_test_sql')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'project_files'
        }, (payload) => {
          console.log('✅ Test subscription received:', payload.eventType)
        })
      
      const subscribePromise = new Promise((resolve) => {
        testChannel.subscribe((status, err) => {
          console.log('🔔 Test subscription status:', status, err)
          if (status === 'SUBSCRIBED') {
            results.push({ step: 'test_subscription', success: true, status })
            resolve(true)
          } else if (status === 'CHANNEL_ERROR') {
            results.push({ step: 'test_subscription', success: false, error: err })
            resolve(false)
          }
        })
        
        // Timeout after 5 seconds
        setTimeout(() => {
          testChannel.unsubscribe()
          resolve(false)
        }, 5000)
      })
      
      await subscribePromise
      
    } catch (error) {
      console.error('❌ Error testing subscription:', error)
      results.push({ step: 'test_subscription', success: false, error: String(error) })
    }
    
    const successCount = results.filter(r => r.success).length
    const totalSteps = results.length
    
    console.log(`🎯 Real-time enablement completed: ${successCount}/${totalSteps} steps successful`)
    
    return res.status(200).json({ 
      success: successCount > 0, 
      message: `Real-time SQL commands executed: ${successCount}/${totalSteps} successful`,
      results,
      instructions: [
        'Real-time should now be enabled for project_files table.',
        'Upload a file and check if the status updates in real-time.',
        'Check browser console for real-time subscription logs.'
      ]
    })
    
  } catch (error) {
    console.error('❌ Error enabling real-time with SQL:', error)
    return res.status(500).json({ 
      error: 'Failed to enable real-time with SQL', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}