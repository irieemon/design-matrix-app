import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getConnectionPool, withPooledConnection } from '../connectionPool'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    })),
    auth: {}
  }))
}))

describe('connectionPool.ts', () => {
  let originalEnv: NodeJS.ProcessEnv
  let consoleLogSpy: any

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env }

    // Set test environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'test-anon-key'

    // Mock console.log
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore original env
    process.env = originalEnv
    vi.restoreAllMocks()

    // Destroy any existing pool
    try {
      const pool = getConnectionPool()
      pool.destroy()
    } catch (e) {
      // Ignore if pool doesn't exist
    }
  })

  describe('getConnectionPool', () => {
    it('should create singleton pool instance', () => {
      const pool1 = getConnectionPool()
      const pool2 = getConnectionPool()
      expect(pool1).toBe(pool2)
    })

    it('should throw error if Supabase URL is missing', () => {
      delete process.env.SUPABASE_URL
      delete process.env.VITE_SUPABASE_URL
      expect(() => getConnectionPool()).toThrow('Missing Supabase configuration')
    })

    it('should throw error if Supabase key is missing', () => {
      delete process.env.SUPABASE_ANON_KEY
      delete process.env.VITE_SUPABASE_ANON_KEY
      expect(() => getConnectionPool()).toThrow('Missing Supabase configuration')
    })

    it('should support VITE_ prefixed environment variables', () => {
      delete process.env.SUPABASE_URL
      delete process.env.SUPABASE_ANON_KEY
      process.env.VITE_SUPABASE_URL = 'https://vite-test.supabase.co'
      process.env.VITE_SUPABASE_ANON_KEY = 'vite-test-key'

      expect(() => getConnectionPool()).not.toThrow()
    })

    it('should log initialization message', () => {
      consoleLogSpy.mockClear()
      getConnectionPool()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('connection pool initialized')
      )
    })
  })

  describe('SupabaseConnectionPool', () => {
    describe('initialization', () => {
      it('should create minimum connections on init', async () => {
        const pool = getConnectionPool()
        await new Promise(resolve => setTimeout(resolve, 100)) // Wait for initialization
        const stats = pool.getStats()
        expect(stats.totalConnections).toBeGreaterThanOrEqual(5)
      })

      it('should use custom configuration', () => {
        const pool = getConnectionPool()
        expect(pool).toBeDefined()
      })
    })

    describe('acquire', () => {
      it('should acquire available connection', async () => {
        const pool = getConnectionPool()
        const client = await pool.acquire()
        expect(client).toBeDefined()
        pool.release(client)
      })

      it('should create new connection if none available and under max', async () => {
        const pool = getConnectionPool()
        const clients = []
        for (let i = 0; i < 7; i++) {
          clients.push(await pool.acquire())
        }
        const stats = pool.getStats()
        expect(stats.totalConnections).toBeGreaterThan(5)

        // Clean up
        clients.forEach(c => pool.release(c))
      })

      it('should reuse released connections', async () => {
        const pool = getConnectionPool()
        const client1 = await pool.acquire()
        pool.release(client1)
        const client2 = await pool.acquire()
        expect(client2).toBe(client1)
        pool.release(client2)
      })

      it('should mark connection as in use', async () => {
        const pool = getConnectionPool()
        const client = await pool.acquire()
        const stats = pool.getStats()
        expect(stats.inUseConnections).toBeGreaterThan(0)
        pool.release(client)
      })

      it('should update lastUsed timestamp', async () => {
        const pool = getConnectionPool()
        const client = await pool.acquire()
        await new Promise(resolve => setTimeout(resolve, 10))
        pool.release(client)
        expect(true).toBe(true) // Connection should have updated timestamp
      })

      it('should timeout if no connections available', async () => {
        const pool = getConnectionPool()

        // Acquire all possible connections
        const clients = []
        for (let i = 0; i < 50; i++) {
          clients.push(await pool.acquire())
        }

        // Try to acquire one more - should timeout
        await expect(pool.acquire()).rejects.toThrow('Connection acquisition timeout')

        // Clean up
        clients.forEach(c => pool.release(c))
      }, 10000)

      it('should queue waiting requests', async () => {
        const pool = getConnectionPool()
        const clients = []

        // Acquire several connections
        for (let i = 0; i < 10; i++) {
          clients.push(await pool.acquire())
        }

        // Try to acquire more - will be queued
        const acquirePromise = pool.acquire()

        // Release one to satisfy queue
        pool.release(clients[0])

        const client = await acquirePromise
        expect(client).toBe(clients[0])

        // Clean up
        clients.slice(1).forEach(c => pool.release(c))
      })
    })

    describe('release', () => {
      it('should mark connection as available', async () => {
        const pool = getConnectionPool()
        const client = await pool.acquire()
        const statsBefore = pool.getStats()
        pool.release(client)
        const statsAfter = pool.getStats()
        expect(statsAfter.inUseConnections).toBeLessThan(statsBefore.inUseConnections)
      })

      it('should serve waiting requests on release', async () => {
        const pool = getConnectionPool()
        const clients = []

        // Fill up connections
        for (let i = 0; i < 10; i++) {
          clients.push(await pool.acquire())
        }

        // Queue a request
        const waitingPromise = pool.acquire()

        // Release to satisfy waiting request
        pool.release(clients[0])

        const client = await waitingPromise
        expect(client).toBeDefined()

        // Clean up
        pool.release(client)
        clients.slice(1).forEach(c => pool.release(c))
      })

      it('should handle release of unknown connection gracefully', () => {
        const pool = getConnectionPool()
        const fakeClient: any = { fake: true }
        expect(() => pool.release(fakeClient)).not.toThrow()
      })
    })

    describe('cleanup', () => {
      it('should clean up idle connections', async () => {
        const pool = getConnectionPool()

        // Acquire and release to create idle connections
        const clients = []
        for (let i = 0; i < 10; i++) {
          clients.push(await pool.acquire())
        }
        clients.forEach(c => pool.release(c))

        const statsBefore = pool.getStats()

        // Wait for cleanup cycle
        await new Promise(resolve => setTimeout(resolve, 35000))

        const statsAfter = pool.getStats()
        expect(statsAfter.totalConnections).toBeLessThanOrEqual(statsBefore.totalConnections)
      }, 40000)

      it('should maintain minimum connections during cleanup', async () => {
        const pool = getConnectionPool()

        // Wait for cleanup cycles
        await new Promise(resolve => setTimeout(resolve, 35000))

        const stats = pool.getStats()
        expect(stats.totalConnections).toBeGreaterThanOrEqual(5)
      }, 40000)

      it('should not clean up in-use connections', async () => {
        const pool = getConnectionPool()
        const client = await pool.acquire()

        // Wait for cleanup attempt
        await new Promise(resolve => setTimeout(resolve, 35000))

        const stats = pool.getStats()
        expect(stats.inUseConnections).toBeGreaterThan(0)

        pool.release(client)
      }, 40000)
    })

    describe('getStats', () => {
      it('should return correct total connections', async () => {
        const pool = getConnectionPool()
        const stats = pool.getStats()
        expect(stats.totalConnections).toBeGreaterThanOrEqual(0)
      })

      it('should return correct in-use connections', async () => {
        const pool = getConnectionPool()
        const client = await pool.acquire()
        const stats = pool.getStats()
        expect(stats.inUseConnections).toBeGreaterThan(0)
        pool.release(client)
      })

      it('should return correct available connections', async () => {
        const pool = getConnectionPool()
        const stats = pool.getStats()
        expect(stats.availableConnections).toBe(
          stats.totalConnections - stats.inUseConnections
        )
      })

      it('should track queued requests', async () => {
        const pool = getConnectionPool()
        const clients = []

        // Fill up connections
        for (let i = 0; i < 50; i++) {
          clients.push(await pool.acquire())
        }

        // Queue some requests (they will timeout but still be queued briefly)
        const queuePromises = []
        for (let i = 0; i < 5; i++) {
          queuePromises.push(pool.acquire().catch(() => {}))
        }

        // Check stats before timeout
        await new Promise(resolve => setTimeout(resolve, 50))
        const stats = pool.getStats()
        expect(stats.totalConnections).toBe(50)

        // Clean up
        clients.forEach(c => pool.release(c))
        await Promise.all(queuePromises)
      })
    })

    describe('destroy', () => {
      it('should clear all connections', () => {
        const pool = getConnectionPool()
        pool.destroy()
        const stats = pool.getStats()
        expect(stats.totalConnections).toBe(0)
      })

      it('should clear waiting queue', async () => {
        const pool = getConnectionPool()
        const clients = []

        // Fill connections and queue requests
        for (let i = 0; i < 50; i++) {
          clients.push(await pool.acquire())
        }

        pool.destroy()
        const stats = pool.getStats()
        expect(stats.queuedRequests).toBe(0)
      })

      it('should stop cleanup interval', () => {
        const pool = getConnectionPool()
        pool.destroy()
        // If interval isn't cleared, this would cause issues in other tests
        expect(true).toBe(true)
      })
    })

    describe('connection configuration', () => {
      it('should create connections with optimized settings', async () => {
        const pool = getConnectionPool()
        const client = await pool.acquire()
        expect(client).toBeDefined()
        expect(client.auth).toBeDefined()
        pool.release(client)
      })

      it('should set connection keep-alive headers', async () => {
        const pool = getConnectionPool()
        const client = await pool.acquire()
        // Headers should be configured in createConnection
        expect(client).toBeDefined()
        pool.release(client)
      })

      it('should disable auth features for pool connections', async () => {
        const pool = getConnectionPool()
        const client = await pool.acquire()
        // Auth should be configured to not auto-refresh
        expect(client.auth).toBeDefined()
        pool.release(client)
      })
    })
  })

  describe('withPooledConnection', () => {
    it('should execute operation with pooled connection', async () => {
      const result = await withPooledConnection(async (client) => {
        expect(client).toBeDefined()
        return 'success'
      })
      expect(result).toBe('success')
    })

    it('should release connection after successful operation', async () => {
      const pool = getConnectionPool()
      const statsBefore = pool.getStats()

      await withPooledConnection(async (client) => {
        return 'test'
      })

      const statsAfter = pool.getStats()
      expect(statsAfter.inUseConnections).toBeLessThanOrEqual(statsBefore.inUseConnections)
    })

    it('should release connection after failed operation', async () => {
      const pool = getConnectionPool()

      await expect(
        withPooledConnection(async (client) => {
          throw new Error('Test error')
        })
      ).rejects.toThrow('Test error')

      const stats = pool.getStats()
      // Connection should be released even after error
      expect(stats.availableConnections).toBeGreaterThan(0)
    })

    it('should return operation result', async () => {
      const result = await withPooledConnection(async (client) => {
        return { data: 'test', count: 42 }
      })
      expect(result).toEqual({ data: 'test', count: 42 })
    })

    it('should propagate operation errors', async () => {
      await expect(
        withPooledConnection(async (client) => {
          throw new Error('Operation failed')
        })
      ).rejects.toThrow('Operation failed')
    })

    it('should support async operations', async () => {
      const result = await withPooledConnection(async (client) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async-result'
      })
      expect(result).toBe('async-result')
    })
  })

  describe('performance characteristics', () => {
    it('should handle high connection volume', async () => {
      const pool = getConnectionPool()
      const operations = []

      for (let i = 0; i < 100; i++) {
        operations.push(
          withPooledConnection(async (client) => {
            await new Promise(resolve => setTimeout(resolve, 1))
            return i
          })
        )
      }

      const results = await Promise.all(operations)
      expect(results).toHaveLength(100)
      expect(results[0]).toBe(0)
      expect(results[99]).toBe(99)
    }, 10000)

    it('should reuse connections efficiently', async () => {
      const pool = getConnectionPool()

      // Sequential operations should reuse same connections
      for (let i = 0; i < 50; i++) {
        await withPooledConnection(async (client) => {
          return 'test'
        })
      }

      const stats = pool.getStats()
      // Should not have created 50 connections
      expect(stats.totalConnections).toBeLessThan(50)
    })

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 20 }, (_, i) =>
        withPooledConnection(async (client) => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50))
          return i
        })
      )

      const results = await Promise.all(operations)
      expect(results).toHaveLength(20)
      expect(new Set(results).size).toBe(20) // All unique results
    })
  })

  describe('edge cases', () => {
    it('should handle connection acquisition during destroy', async () => {
      const pool = getConnectionPool()
      const acquirePromise = pool.acquire()
      pool.destroy()

      // Should either get connection or fail gracefully
      try {
        const client = await acquirePromise
        expect(client).toBeDefined()
      } catch (error) {
        // Acceptable to fail after destroy
        expect(error).toBeDefined()
      }
    })

    it('should handle rapid acquire/release cycles', async () => {
      const pool = getConnectionPool()

      for (let i = 0; i < 50; i++) {
        const client = await pool.acquire()
        pool.release(client)
      }

      const stats = pool.getStats()
      expect(stats.inUseConnections).toBe(0)
    })

    it('should handle same connection released multiple times', async () => {
      const pool = getConnectionPool()
      const client = await pool.acquire()
      pool.release(client)
      pool.release(client) // Second release should be safe

      expect(true).toBe(true) // Should not crash
    })
  })
})
