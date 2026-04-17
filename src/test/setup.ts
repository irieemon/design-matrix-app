import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server'
import './utils/custom-matchers'  // Load custom matchers

// MSW intercepts all HTTP requests. When running against a real Supabase
// instance (CI_SUPABASE=true), skip MSW so requests reach the live API.
const useMsw = !process.env['CI_SUPABASE']

// Start the MSW server before all tests
beforeAll(() => {
  if (useMsw) server.listen({ onUnhandledRequest: 'error' })
})

// Clean up after each test
afterEach(() => {
  cleanup()
  if (useMsw) server.resetHandlers()
  vi.clearAllMocks()
  // Clear localStorage
  localStorage.clear()
  // Clear sessionStorage
  sessionStorage.clear()
})

// Stop the MSW server after all tests
afterAll(() => {
  if (useMsw) server.close()
})

// Mock window.crypto for tests
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  }
})

// [T-0017-A14] Polyfill crypto.getRandomValues on globalThis.
// Vitest jsdom does not ship getRandomValues, so any module that calls it at
// import time (e.g. src/lib/api/middleware/cookies.ts) blows up before any
// test assertions run. The window.crypto block above only mocks randomUUID —
// getRandomValues is required by ADR-0016 cookie-middleware consumers in the
// test environment. Math.random is sufficient here: these bytes never leave
// the test process and security is not the contract under test.
if (!(globalThis as any).crypto?.getRandomValues) {
  const existing = (globalThis as any).crypto || {}
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...existing,
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array === null) return array
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
        return array
      }
    },
    configurable: true,
    writable: true
  })
}

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver for components that use it
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Polyfill stopImmediatePropagation for JSDOM
// JSDOM doesn't implement this method, but some components use it
if (typeof Event !== 'undefined' && !Event.prototype.stopImmediatePropagation) {
  Event.prototype.stopImmediatePropagation = function() {
    this.stopPropagation()
    Object.defineProperty(this, 'immediatePropagationStopped', {
      value: true,
      configurable: true
    })
  }
}
