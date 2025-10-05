import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'
import { IdeaCard, User, Project } from '../../types'
import { generateDemoUUID } from '../../utils/uuid'

// Mock user data
export const mockUser: User = {
  id: generateDemoUUID('1'),
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'user',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
}

export const mockAdminUser: User = {
  id: generateDemoUUID('9'),
  email: 'admin@prioritas.com',
  full_name: 'Admin User',
  role: 'super_admin',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
}

// Mock project data
export const mockProject: Project = {
  id: generateDemoUUID('2'),
  name: 'Test Project',
  description: 'A test project for unit testing',
  project_type: 'Software',
  status: 'active',
  owner_id: generateDemoUUID('1'),
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
}

// Mock idea data
export const mockIdea: IdeaCard = {
  id: generateDemoUUID('3'),
  content: 'Test Idea',
  details: 'A test idea for unit testing',
  x: 200,
  y: 150,
  priority: 'high',
  project_id: generateDemoUUID('2'),
  created_by: generateDemoUUID('1'),
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
}

export const mockIdeas: IdeaCard[] = [
  mockIdea,
  {
    ...mockIdea,
    id: generateDemoUUID('4'),
    content: 'Second Test Idea',
    x: 400,
    y: 300,
    priority: 'moderate'
  },
  {
    ...mockIdea,
    id: generateDemoUUID('5'),
    content: 'Third Test Idea',
    x: 100,
    y: 450,
    priority: 'low'
  }
]

// Custom render function that includes common providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialUser?: User | null
  initialProject?: Project | null
}

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div>
      {children}
    </div>
  )
}

const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Helper functions for testing
export const createMockResponse = <T,>(data: T, success = true) => ({
  success,
  data: success ? data : undefined,
  error: success ? undefined : { type: 'test', message: 'Test error', code: 'TEST_ERROR' },
  timestamp: new Date().toISOString(),
  meta: { total: Array.isArray(data) ? data.length : 1 }
})

// Mock drag event helper
export const createMockDragEndEvent = (ideaId: string, deltaX = 0, deltaY = 0) => ({
  active: { id: ideaId },
  delta: { x: deltaX, y: deltaY },
  over: null,
  activatorEvent: new Event('pointerdown'),
  collisions: null
})

// Wait for async operations in tests
export const waitForAsyncOperations = () => new Promise(resolve => setTimeout(resolve, 0))

// Mock localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  }
}

// Mock console methods for testing
export const mockConsole = () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
})