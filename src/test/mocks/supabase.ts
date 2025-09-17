import { vi } from 'vitest'
import { mockUser, mockProject, mockIdeas, mockIdea } from '../utils/test-utils'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  insert: vi.fn(() => mockSupabaseClient),
  update: vi.fn(() => mockSupabaseClient),
  delete: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  in: vi.fn(() => mockSupabaseClient),
  lt: vi.fn(() => mockSupabaseClient),
  order: vi.fn(() => mockSupabaseClient),
  limit: vi.fn(() => mockSupabaseClient),
  single: vi.fn(() => Promise.resolve({ data: mockIdea, error: null })),

  // Auth methods
  auth: {
    getSession: vi.fn(() => Promise.resolve({
      data: { session: { user: mockUser, access_token: 'mock-token' } },
      error: null
    })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } }
    }))
  },

  // Real-time methods
  channel: vi.fn(() => ({
    on: vi.fn(() => ({
      subscribe: vi.fn((callback) => {
        // Simulate successful subscription
        callback('SUBSCRIBED')
        return {
          unsubscribe: vi.fn()
        }
      })
    }))
  })),
  removeChannel: vi.fn(),

  // Storage methods
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
      download: vi.fn(() => Promise.resolve({ data: new Blob(), error: null })),
      remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
      list: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  }
}

// Mock successful database operations by default
mockSupabaseClient.from.mockImplementation((table: string) => {
  const query = {
    ...mockSupabaseClient,
    // Override then method to handle promises
    then: vi.fn((resolve) => {
      let data
      switch (table) {
        case 'ideas':
          data = mockIdeas
          break
        case 'projects':
          data = [mockProject]
          break
        case 'project_collaborators':
          data = []
          break
        default:
          data = []
      }
      resolve({ data, error: null })
      return Promise.resolve({ data, error: null })
    }),
    catch: vi.fn()
  }
  return query
})

// Helper to mock database errors
export const mockDatabaseError = (errorMessage = 'Database error') => {
  mockSupabaseClient.from.mockImplementation(() => ({
    ...mockSupabaseClient,
    then: vi.fn((_, reject) => {
      const error = new Error(errorMessage)
      reject?.(error)
      return Promise.reject(error)
    }),
    catch: vi.fn((handler) => {
      const error = new Error(errorMessage)
      handler(error)
      return Promise.resolve()
    })
  }))
}

// Helper to reset mocks
export const resetSupabaseMocks = () => {
  vi.clearAllMocks()
  // Reset to default successful behavior
  mockSupabaseClient.from.mockImplementation((table: string) => {
    const query = {
      ...mockSupabaseClient,
      then: vi.fn((resolve) => {
        let data
        switch (table) {
          case 'ideas':
            data = mockIdeas
            break
          case 'projects':
            data = [mockProject]
            break
          default:
            data = []
        }
        resolve({ data, error: null })
        return Promise.resolve({ data, error: null })
      }),
      catch: vi.fn()
    }
    return query
  })
}

export default mockSupabaseClient