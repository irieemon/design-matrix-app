/**
 * Test Project Fixtures
 * Provides consistent project data for testing
 */

import { testUser, adminUser, collaboratorUsers } from './users'

export interface TestProject {
  id: string
  title: string
  description: string
  project_type: string
  owner_id: string
  visibility: 'private' | 'public'
  created_at: string
  updated_at: string
}

/**
 * Basic test project - Private, owned by test user
 */
export const basicProject: TestProject = {
  id: 'project-001',
  title: 'Test Project',
  description: 'A basic test project for development',
  project_type: 'software',
  owner_id: testUser.id,
  visibility: 'private',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
}

/**
 * Public test project - Visible to all users
 */
export const publicProject: TestProject = {
  id: 'project-002',
  title: 'Public Test Project',
  description: 'A public project for testing visibility',
  project_type: 'marketing',
  owner_id: testUser.id,
  visibility: 'public',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
}

/**
 * Admin-owned project
 */
export const adminProject: TestProject = {
  id: 'project-003',
  title: 'Admin Project',
  description: 'Project owned by admin user',
  project_type: 'software',
  owner_id: adminUser.id,
  visibility: 'private',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
}

/**
 * Collaborative project with multiple contributors
 */
export const collaborativeProject: TestProject = {
  id: 'project-004',
  title: 'Collaborative Project',
  description: 'Project with multiple collaborators',
  project_type: 'event',
  owner_id: testUser.id,
  visibility: 'private',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
}

/**
 * Project types for testing different project categories
 */
export const projectsByType: Record<string, TestProject> = {
  software: {
    id: 'project-software-001',
    title: 'Software Development Project',
    description: 'A software development project',
    project_type: 'software',
    owner_id: testUser.id,
    visibility: 'private',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  marketing: {
    id: 'project-marketing-001',
    title: 'Marketing Campaign Project',
    description: 'A marketing campaign project',
    project_type: 'marketing',
    owner_id: testUser.id,
    visibility: 'private',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  event: {
    id: 'project-event-001',
    title: 'Event Planning Project',
    description: 'An event planning project',
    project_type: 'event',
    owner_id: testUser.id,
    visibility: 'private',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  }
}

/**
 * Generate a unique test project
 */
export function createTestProject(overrides: Partial<TestProject> = {}): TestProject {
  const timestamp = Date.now()
  return {
    id: `project-${timestamp}`,
    title: `Test Project ${timestamp}`,
    description: `Test project created at ${new Date().toISOString()}`,
    project_type: 'software',
    owner_id: testUser.id,
    visibility: 'private',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Generate multiple test projects
 */
export function createTestProjects(count: number, baseOverrides: Partial<TestProject> = {}): TestProject[] {
  return Array.from({ length: count }, (_, index) =>
    createTestProject({
      ...baseOverrides,
      title: `${baseOverrides.title || 'Test Project'} ${index + 1}`
    })
  )
}

/**
 * All test projects for easy iteration
 */
export const allTestProjects = [
  basicProject,
  publicProject,
  adminProject,
  collaborativeProject,
  ...Object.values(projectsByType)
]
