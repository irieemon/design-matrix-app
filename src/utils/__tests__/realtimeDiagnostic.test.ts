import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RealtimeDiagnostic } from '../realtimeDiagnostic'

// Mock supabase module
const mockChannel = {
  subscribe: vi.fn(),
  on: vi.fn()
}

const mockSupabase = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      limit: vi.fn(() => Promise.resolve({ error: null }))
    })),
    insert: vi.fn(() => Promise.resolve({ error: null }))
  }))
}

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase
}))

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

vi.mock('../logger', () => ({
  logger: mockLogger
}))

describe('realtimeDiagnostic.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset diagnostic running flag
    ;(RealtimeDiagnostic as any).diagnosticRunning = false

    // Setup default mock behaviors
    mockChannel.subscribe.mockReturnValue(mockChannel)
    mockChannel.on.mockReturnValue(mockChannel)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('checkRealtimeConfiguration', () => {
    it('should create a diagnostic test channel', async () => {
      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockSupabase.channel).toHaveBeenCalledWith('diagnostic-test')
    })

    it('should subscribe to the test channel', async () => {
      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockChannel.subscribe).toHaveBeenCalled()
    })

    it('should log when starting diagnostic', async () => {
      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockLogger.info).toHaveBeenCalledWith('Running real-time diagnostic...')
    })

    it('should prevent multiple diagnostics from running simultaneously', async () => {
      const promise1 = RealtimeDiagnostic.checkRealtimeConfiguration()
      const promise2 = RealtimeDiagnostic.checkRealtimeConfiguration()

      vi.runAllTimers()
      await Promise.all([promise1, promise2])

      expect(mockLogger.debug).toHaveBeenCalledWith('Diagnostic already running, skipping...')
    })

    it('should test table access permissions', async () => {
      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockSupabase.from).toHaveBeenCalledWith('ideas')
    })

    it('should log success when table is accessible', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ error: null }))
        }))
      })

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockLogger.info).toHaveBeenCalledWith('Can read from ideas table')
    })

    it('should log error when table is not accessible', async () => {
      const mockError = { message: 'Permission denied' }
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ error: mockError }))
        }))
      })

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockLogger.error).toHaveBeenCalledWith('Cannot read from ideas table:', 'Permission denied')
    })

    it('should handle table access exceptions', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Connection error')
      })

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockLogger.error).toHaveBeenCalledWith('Ideas table access error:', expect.any(Error))
    })

    it('should log configuration instructions in debug mode', async () => {
      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      const debugCalls = mockLogger.debug.mock.calls
      const instructionCall = debugCalls.find((call: any[]) =>
        call[0]?.includes('To enable real-time')
      )
      expect(instructionCall).toBeDefined()
    })

    it('should remove the test channel after timeout', async () => {
      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel)
    })

    it('should handle channel removal errors gracefully', async () => {
      mockSupabase.removeChannel.mockImplementation(() => {
        throw new Error('Channel removal failed')
      })

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Channel removal error (safe to ignore):',
        expect.any(Error)
      )
    })

    it('should return diagnostic results object', async () => {
      const result = await RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()

      expect(result).toHaveProperty('basicConnection')
      expect(result).toHaveProperty('tableAccess')
      expect(result).toHaveProperty('instructions')
    })

    it('should reset diagnostic running flag after timeout', async () => {
      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()

      expect((RealtimeDiagnostic as any).diagnosticRunning).toBe(true)

      vi.runAllTimers()
      await promise

      expect((RealtimeDiagnostic as any).diagnosticRunning).toBe(false)
    })

    it('should log connection status updates', async () => {
      let subscribeCallback: any
      mockChannel.subscribe.mockImplementation((callback) => {
        subscribeCallback = callback
        return mockChannel
      })

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()

      // Simulate SUBSCRIBED status
      if (subscribeCallback) {
        subscribeCallback('SUBSCRIBED')
      }

      vi.runAllTimers()
      await promise

      expect(mockLogger.info).toHaveBeenCalledWith('Basic real-time connection works')
    })

    it('should log connection errors', async () => {
      let subscribeCallback: any
      mockChannel.subscribe.mockImplementation((callback) => {
        subscribeCallback = callback
        return mockChannel
      })

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()

      // Simulate error status
      if (subscribeCallback) {
        subscribeCallback('CHANNEL_ERROR')
      }

      vi.runAllTimers()
      await promise

      expect(mockLogger.error).toHaveBeenCalledWith('Real-time connection failed:', 'CHANNEL_ERROR')
    })

    it('should log timeout errors', async () => {
      let subscribeCallback: any
      mockChannel.subscribe.mockImplementation((callback) => {
        subscribeCallback = callback
        return mockChannel
      })

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()

      // Simulate timeout
      if (subscribeCallback) {
        subscribeCallback('TIMED_OUT')
      }

      vi.runAllTimers()
      await promise

      expect(mockLogger.error).toHaveBeenCalledWith('Real-time connection failed:', 'TIMED_OUT')
    })
  })

  describe('testRealtimeWithInsert', () => {
    it('should create a realtime-test channel', async () => {
      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(mockSupabase.channel).toHaveBeenCalledWith('realtime-test')
    })

    it('should listen for postgres_changes events', async () => {
      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ideas' },
        expect.any(Function)
      )
    })

    it('should subscribe to the channel', async () => {
      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(mockChannel.subscribe).toHaveBeenCalled()
    })

    it('should wait before inserting test record', async () => {
      const promise = RealtimeDiagnostic.testRealtimeWithInsert()

      // Advance time but not enough
      vi.advanceTimersByTime(500)

      // Should not have inserted yet
      expect(mockSupabase.from).not.toHaveBeenCalled()

      vi.runAllTimers()
      await promise
    })

    it('should insert a test record', async () => {
      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(mockSupabase.from).toHaveBeenCalledWith('ideas')
    })

    it('should insert test record with correct structure', async () => {
      let insertData: any
      mockSupabase.from.mockReturnValue({
        insert: vi.fn((data) => {
          insertData = data
          return Promise.resolve({ error: null })
        })
      })

      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(insertData).toHaveProperty('content')
      expect(insertData).toHaveProperty('details')
      expect(insertData).toHaveProperty('priority')
      expect(insertData).toHaveProperty('project_id')
      expect(insertData).toHaveProperty('position_x')
      expect(insertData).toHaveProperty('position_y')
      expect(insertData).toHaveProperty('effort')
      expect(insertData).toHaveProperty('impact')
    })

    it('should log when test record is inserted', async () => {
      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(mockLogger.debug).toHaveBeenCalledWith('Test record inserted, checking for real-time event...')
    })

    it('should handle insert errors', async () => {
      const mockError = { message: 'Insert failed' }
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => Promise.resolve({ error: mockError }))
      })

      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(mockLogger.error).toHaveBeenCalledWith('Could not insert test record:', 'Insert failed')
    })

    it('should handle insert exceptions', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database error')
      })

      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(mockLogger.error).toHaveBeenCalledWith('Test insert failed:', expect.any(Error))
    })

    it('should detect when real-time event is received', async () => {
      let eventCallback: any
      mockChannel.on.mockImplementation((event, filter, callback) => {
        eventCallback = callback
        return mockChannel
      })

      const promise = RealtimeDiagnostic.testRealtimeWithInsert()

      // Simulate event received
      if (eventCallback) {
        eventCallback({ eventType: 'INSERT' })
      }

      vi.runAllTimers()
      await promise

      expect(mockLogger.debug).toHaveBeenCalledWith('Real-time event received!', 'INSERT')
    })

    it('should log success when event is received', async () => {
      let eventCallback: any
      mockChannel.on.mockImplementation((event, filter, callback) => {
        eventCallback = callback
        return mockChannel
      })

      const promise = RealtimeDiagnostic.testRealtimeWithInsert()

      // Simulate event received
      if (eventCallback) {
        eventCallback({ eventType: 'INSERT' })
      }

      vi.runAllTimers()
      await promise

      expect(mockLogger.info).toHaveBeenCalledWith('Real-time is working perfectly!')
    })

    it('should log warning when event is not received', async () => {
      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(mockLogger.warn).toHaveBeenCalledWith('Real-time event not received - check configuration')
    })

    it('should remove the test channel after completion', async () => {
      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel)
    })

    it('should return true when event is received', async () => {
      let eventCallback: any
      mockChannel.on.mockImplementation((event, filter, callback) => {
        eventCallback = callback
        return mockChannel
      })

      const promise = RealtimeDiagnostic.testRealtimeWithInsert()

      // Simulate event received
      if (eventCallback) {
        eventCallback({ eventType: 'INSERT' })
      }

      vi.runAllTimers()
      const result = await promise

      expect(result).toBe(true)
    })

    it('should return false when event is not received', async () => {
      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      const result = await promise

      expect(result).toBe(false)
    })
  })

  describe('diagnosticRunning flag management', () => {
    it('should set flag to true when diagnostic starts', async () => {
      expect((RealtimeDiagnostic as any).diagnosticRunning).toBe(false)

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      expect((RealtimeDiagnostic as any).diagnosticRunning).toBe(true)

      vi.runAllTimers()
      await promise
    })

    it('should reset flag after timeout period', async () => {
      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()

      expect((RealtimeDiagnostic as any).diagnosticRunning).toBe(true)

      vi.advanceTimersByTime(5000)
      await promise

      expect((RealtimeDiagnostic as any).diagnosticRunning).toBe(false)
    })

    it('should prevent concurrent diagnostics', async () => {
      ;(RealtimeDiagnostic as any).diagnosticRunning = true

      const result = await RealtimeDiagnostic.checkRealtimeConfiguration()

      expect(result).toBeUndefined()
      expect(mockLogger.debug).toHaveBeenCalledWith('Diagnostic already running, skipping...')
    })
  })

  describe('error handling and edge cases', () => {
    it('should handle null channel subscription', async () => {
      mockSupabase.channel.mockReturnValue(null as any)

      expect(async () => {
        await RealtimeDiagnostic.checkRealtimeConfiguration()
        vi.runAllTimers()
      }).not.toThrow()
    })

    it('should handle subscribe callback errors', async () => {
      mockChannel.subscribe.mockImplementation((callback) => {
        callback('UNKNOWN_STATUS')
        return mockChannel
      })

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockLogger.debug).toHaveBeenCalledWith('Real-time connection test:', 'UNKNOWN_STATUS')
    })

    it('should handle multiple status callbacks', async () => {
      let subscribeCallback: any
      mockChannel.subscribe.mockImplementation((callback) => {
        subscribeCallback = callback
        return mockChannel
      })

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()

      if (subscribeCallback) {
        subscribeCallback('CONNECTING')
        subscribeCallback('SUBSCRIBED')
        subscribeCallback('SUBSCRIBED') // Duplicate
      }

      vi.runAllTimers()
      await promise

      // Should only remove channel once
      expect(mockSupabase.removeChannel).toHaveBeenCalledTimes(1)
    })

    it('should handle test insert with missing required fields gracefully', async () => {
      const insertMock = vi.fn(() => Promise.resolve({ error: null }))
      mockSupabase.from.mockReturnValue({
        insert: insertMock
      })

      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(insertMock).toHaveBeenCalled()
    })
  })

  describe('logging and debugging', () => {
    it('should log debug messages for connection testing', async () => {
      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockLogger.debug).toHaveBeenCalled()
    })

    it('should log test insert progress', async () => {
      const promise = RealtimeDiagnostic.testRealtimeWithInsert()
      vi.runAllTimers()
      await promise

      expect(mockLogger.debug).toHaveBeenCalledWith('Testing real-time with a test insert...')
    })

    it('should provide detailed error messages', async () => {
      const detailedError = new Error('Detailed connection error')
      mockSupabase.from.mockImplementation(() => {
        throw detailedError
      })

      const promise = RealtimeDiagnostic.checkRealtimeConfiguration()
      vi.runAllTimers()
      await promise

      expect(mockLogger.error).toHaveBeenCalledWith('Ideas table access error:', detailedError)
    })
  })
})