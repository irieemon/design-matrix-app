// High-Performance Supabase Connection Pool
// Optimized for minimal latency and maximum throughput

import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface PoolConfig {
  maxConnections: number
  minConnections: number
  acquireTimeoutMs: number
  idleTimeoutMs: number
}

interface PooledConnection {
  client: SupabaseClient
  createdAt: number
  lastUsed: number
  inUse: boolean
  connectionId: string
}

class SupabaseConnectionPool {
  private connections: Map<string, PooledConnection> = new Map()
  private waitingQueue: Array<(client: SupabaseClient) => void> = []
  private config: PoolConfig
  private supabaseUrl: string
  private supabaseKey: string
  private cleanupInterval: NodeJS.Timeout

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config: Partial<PoolConfig> = {}
  ) {
    this.supabaseUrl = supabaseUrl
    this.supabaseKey = supabaseKey
    this.config = {
      maxConnections: 50,      // High connection limit for performance
      minConnections: 5,       // Always keep minimum connections ready
      acquireTimeoutMs: 500,   // Fast timeout for connection acquisition
      idleTimeoutMs: 30000,    // 30s idle timeout for cleanup
      ...config
    }

    // Initialize minimum connections
    this.initializePool()

    // Setup connection cleanup
    this.cleanupInterval = setInterval(() => this.cleanupIdleConnections(), 10000)
  }

  private async initializePool() {
    const initPromises = []
    for (let i = 0; i < this.config.minConnections; i++) {
      initPromises.push(this.createConnection())
    }
    await Promise.all(initPromises)
  }

  private createConnection(): PooledConnection {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const client = createClient(this.supabaseUrl, this.supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      // PERFORMANCE: Optimized headers for connection reuse
      global: {
        headers: {
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=2, max=1000',
          'Cache-Control': 'no-store',
          'X-Connection-ID': connectionId
        }
      },
      // PERFORMANCE: Database optimizations
      db: {
        schema: 'public'
      }
    })

    const connection: PooledConnection = {
      client,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      inUse: false,
      connectionId
    }

    this.connections.set(connectionId, connection)
    return connection
  }

  async acquire(): Promise<SupabaseClient> {
    return new Promise((resolve, reject) => {
      // Try to find available connection
      const availableConnection = Array.from(this.connections.values())
        .find(conn => !conn.inUse)

      if (availableConnection) {
        availableConnection.inUse = true
        availableConnection.lastUsed = Date.now()
        resolve(availableConnection.client)
        return
      }

      // Check if we can create a new connection
      if (this.connections.size < this.config.maxConnections) {
        const newConnection = this.createConnection()
        newConnection.inUse = true
        resolve(newConnection.client)
        return
      }

      // Add to waiting queue with timeout
      const timeoutId = setTimeout(() => {
        const index = this.waitingQueue.findIndex(cb => cb === resolver)
        if (index !== -1) {
          this.waitingQueue.splice(index, 1)
          reject(new Error(`Connection acquisition timeout after ${this.config.acquireTimeoutMs}ms`))
        }
      }, this.config.acquireTimeoutMs)

      const resolver = (client: SupabaseClient) => {
        clearTimeout(timeoutId)
        resolve(client)
      }

      this.waitingQueue.push(resolver)
    })
  }

  release(client: SupabaseClient) {
    const connection = Array.from(this.connections.values())
      .find(conn => conn.client === client)

    if (connection) {
      connection.inUse = false
      connection.lastUsed = Date.now()

      // Serve waiting requests
      const waitingResolver = this.waitingQueue.shift()
      if (waitingResolver) {
        connection.inUse = true
        waitingResolver(client)
      }
    }
  }

  private cleanupIdleConnections() {
    const now = Date.now()
    const connectionsToRemove: string[] = []

    for (const [connectionId, connection] of Array.from(this.connections.entries())) {
      const idleTime = now - connection.lastUsed
      const shouldRemove = !connection.inUse &&
        idleTime > this.config.idleTimeoutMs &&
        this.connections.size > this.config.minConnections

      if (shouldRemove) {
        connectionsToRemove.push(connectionId)
      }
    }

    // Remove idle connections
    connectionsToRemove.forEach(id => {
      this.connections.delete(id)
    })

    if (connectionsToRemove.length > 0) {
      console.log(`Cleaned up ${connectionsToRemove.length} idle connections. Pool size: ${this.connections.size}`)
    }
  }

  getStats() {
    const inUse = Array.from(this.connections.values()).filter(conn => conn.inUse).length
    return {
      totalConnections: this.connections.size,
      inUseConnections: inUse,
      availableConnections: this.connections.size - inUse,
      queuedRequests: this.waitingQueue.length
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.connections.clear()
    this.waitingQueue.length = 0
  }
}

// Singleton connection pool for the application
let pool: SupabaseConnectionPool | null = null

export function getConnectionPool(): SupabaseConnectionPool {
  if (!pool) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for connection pool')
    }

    pool = new SupabaseConnectionPool(supabaseUrl, supabaseKey, {
      maxConnections: 50,   // High limit for performance
      minConnections: 5,    // Always ready connections
      acquireTimeoutMs: 300,// Fast acquisition
      idleTimeoutMs: 30000  // 30s cleanup
    })

    console.log('🏊‍♂️ Supabase connection pool initialized')
  }

  return pool
}

// High-level helper for automatic connection management
export async function withPooledConnection<T>(
  operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const pool = getConnectionPool()
  let client: SupabaseClient | null = null

  try {
    client = await pool.acquire()
    return await operation(client)
  } finally {
    if (client) {
      pool.release(client)
    }
  }
}