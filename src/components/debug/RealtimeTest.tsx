import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

const RealtimeTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Starting test...')
  const [logs, setLogs] = useState<string[]>([])
  const [subscription, setSubscription] = useState<any>(null)

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    const logMessage = `[${timestamp}] ${message}`
    setLogs(prev => [...prev.slice(-10), logMessage]) // Keep last 10 logs
    logger.debug('🧪 Realtime Test:', message)
  }

  useEffect(() => {
    const testRealtime = async () => {
      try {
        addLog('Testing authentication...')
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        
        if (authError) {
          addLog(`❌ Auth error: ${authError.message}`)
          return
        }
        
        if (!session) {
          addLog('❌ No active session')
          return
        }
        
        addLog(`✅ Authenticated as: ${session.user.email}`)
        
        // Test basic select
        addLog('Testing SELECT permission...')
        const { data: testSelect, error: selectError } = await supabase
          .from('ideas')
          .select('id, content')
          .limit(1)
          
        if (selectError) {
          addLog(`❌ SELECT error: ${selectError.message}`)
          return
        }
        
        addLog(`✅ SELECT works, found ${testSelect?.length || 0} records`)
        
        // Test real-time subscription
        addLog('Setting up real-time subscription...')
        
        const channel = supabase
          .channel('realtime-test')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'ideas'
            },
            (payload) => {
              addLog(`🔥 Real-time event: ${payload.eventType} - ${JSON.stringify(payload.new?.content || payload.old?.content)}`)
              setStatus('✅ Real-time is working!')
            }
          )
          .subscribe((status) => {
            addLog(`📡 Subscription status: ${status}`)
            setStatus(`Subscription: ${status}`)
          })
        
        setSubscription(channel)
        
        // Test with a sample update after 3 seconds
        setTimeout(async () => {
          if (testSelect && testSelect.length > 0) {
            addLog('Testing real-time with sample update...')
            const testId = testSelect[0].id
            const { error: updateError } = await supabase
              .from('ideas')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', testId)
              
            if (updateError) {
              addLog(`❌ Update test failed: ${updateError.message}`)
            } else {
              addLog('✅ Update test sent')
            }
          }
        }, 3000)
        
      } catch (error) {
        addLog(`❌ Unexpected error: ${error}`)
      }
    }

    testRealtime()

    return () => {
      if (subscription) {
        addLog('🔌 Cleaning up subscription')
        subscription.unsubscribe()
      }
    }
  }, [])

  return (
    <div className="fixed top-4 right-4 bg-white border rounded-lg p-4 shadow-lg max-w-md z-50">
      <h3 className="font-bold text-sm mb-2">🧪 Real-time Diagnostic</h3>
      <div className="text-xs mb-2">
        <strong>Status:</strong> {status}
      </div>
      <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
        {logs.map((log, index) => (
          <div key={index} className="font-mono text-xs">{log}</div>
        ))}
      </div>
      <button 
        onClick={() => setLogs([])}
        className="mt-2 text-xs bg-gray-200 px-2 py-1 rounded"
      >
        Clear Logs
      </button>
    </div>
  )
}

export default RealtimeTest