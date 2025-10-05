/**
 * Test User Fixtures
 * Provides consistent user data for testing across the application
 */

export interface TestUser {
  id: string
  email: string
  password: string
  full_name: string
  role: 'user' | 'admin' | 'super_admin'
  created_at: string
}

/**
 * Standard test user - Regular authenticated user
 */
export const testUser: TestUser = {
  id: 'test-user-001',
  email: 'test@example.com',
  password: 'SecurePassword123!',
  full_name: 'Test User',
  role: 'user',
  created_at: '2025-01-01T00:00:00.000Z'
}

/**
 * Admin test user - Has administrative privileges
 */
export const adminUser: TestUser = {
  id: 'admin-user-001',
  email: 'admin@example.com',
  password: 'AdminPassword123!',
  full_name: 'Admin User',
  role: 'admin',
  created_at: '2025-01-01T00:00:00.000Z'
}

/**
 * Super admin test user - Has full system access
 */
export const superAdminUser: TestUser = {
  id: 'superadmin-001',
  email: 'superadmin@example.com',
  password: 'SuperAdminPassword123!',
  full_name: 'Super Admin',
  role: 'super_admin',
  created_at: '2025-01-01T00:00:00.000Z'
}

/**
 * Array of multiple test users for collaboration testing
 */
export const collaboratorUsers: TestUser[] = [
  {
    id: 'collaborator-001',
    email: 'alice@example.com',
    password: 'AlicePassword123!',
    full_name: 'Alice Collaborator',
    role: 'user',
    created_at: '2025-01-02T00:00:00.000Z'
  },
  {
    id: 'collaborator-002',
    email: 'bob@example.com',
    password: 'BobPassword123!',
    full_name: 'Bob Collaborator',
    role: 'user',
    created_at: '2025-01-02T00:00:00.000Z'
  },
  {
    id: 'collaborator-003',
    email: 'charlie@example.com',
    password: 'CharliePassword123!',
    full_name: 'Charlie Collaborator',
    role: 'user',
    created_at: '2025-01-02T00:00:00.000Z'
  }
]

/**
 * User for testing unauthorized access scenarios
 */
export const unauthorizedUser: TestUser = {
  id: 'unauthorized-001',
  email: 'unauthorized@example.com',
  password: 'NoAccessPassword123!',
  full_name: 'Unauthorized User',
  role: 'user',
  created_at: '2025-01-03T00:00:00.000Z'
}

/**
 * User with invalid/expired credentials for negative testing
 */
export const expiredUser: TestUser = {
  id: 'expired-001',
  email: 'expired@example.com',
  password: 'ExpiredPassword123!',
  full_name: 'Expired User',
  role: 'user',
  created_at: '2023-01-01T00:00:00.000Z' // Old date
}

/**
 * Generate a unique test user with custom properties
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const timestamp = Date.now()
  return {
    id: `test-user-${timestamp}`,
    email: `test-${timestamp}@example.com`,
    password: 'TestPassword123!',
    full_name: `Test User ${timestamp}`,
    role: 'user',
    created_at: new Date().toISOString(),
    ...overrides
  }
}

/**
 * All test users for easy iteration
 */
export const allTestUsers = [
  testUser,
  adminUser,
  superAdminUser,
  ...collaboratorUsers,
  unauthorizedUser,
  expiredUser
]
