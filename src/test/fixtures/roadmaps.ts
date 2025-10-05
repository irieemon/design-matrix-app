/**
 * Test Roadmap Fixtures
 * Provides consistent roadmap data for testing timeline functionality
 */

import { basicProject, publicProject } from './projects'
import { testUser } from './users'

export interface TestRoadmapFeature {
  id: string
  title: string
  description: string
  category: 'core' | 'enhancement' | 'research' | 'infrastructure'
  start_date: string
  target_completion: string
  dependencies: string[]
  status: 'planned' | 'in_progress' | 'completed' | 'blocked'
  assigned_to?: string
  effort_estimate?: number
}

export interface TestRoadmap {
  id: string
  project_id: string
  title: string
  description: string
  features: TestRoadmapFeature[]
  version: string
  created_by: string
  created_at: string
  updated_at: string
}

/**
 * Sample features for roadmap testing
 */
export const sampleFeatures: TestRoadmapFeature[] = [
  {
    id: 'feature-001',
    title: 'User Authentication',
    description: 'Implement JWT-based authentication',
    category: 'core',
    start_date: '2025-01-01',
    target_completion: '2025-01-15',
    dependencies: [],
    status: 'completed',
    assigned_to: testUser.id,
    effort_estimate: 40
  },
  {
    id: 'feature-002',
    title: 'Project Dashboard',
    description: 'Create project overview dashboard',
    category: 'core',
    start_date: '2025-01-16',
    target_completion: '2025-02-01',
    dependencies: ['feature-001'],
    status: 'in_progress',
    assigned_to: testUser.id,
    effort_estimate: 80
  },
  {
    id: 'feature-003',
    title: 'Advanced Analytics',
    description: 'Implement analytics and reporting',
    category: 'enhancement',
    start_date: '2025-02-15',
    target_completion: '2025-03-15',
    dependencies: ['feature-002'],
    status: 'planned',
    effort_estimate: 120
  },
  {
    id: 'feature-004',
    title: 'Performance Optimization',
    description: 'Optimize database queries and caching',
    category: 'infrastructure',
    start_date: '2025-03-01',
    target_completion: '2025-03-31',
    dependencies: ['feature-002'],
    status: 'planned',
    effort_estimate: 60
  }
]

/**
 * Basic roadmap for standard testing
 */
export const basicRoadmap: TestRoadmap = {
  id: 'roadmap-001',
  project_id: basicProject.id,
  title: 'Q1 2025 Product Roadmap',
  description: 'First quarter feature development plan',
  features: sampleFeatures,
  version: '1.0.0',
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
}

/**
 * Empty roadmap for testing roadmap creation
 */
export const emptyRoadmap: TestRoadmap = {
  id: 'roadmap-empty-001',
  project_id: basicProject.id,
  title: 'New Roadmap',
  description: 'A newly created roadmap with no features',
  features: [],
  version: '1.0.0',
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
}

/**
 * Complex roadmap with dependencies for testing dependency chains
 */
export const complexRoadmap: TestRoadmap = {
  id: 'roadmap-complex-001',
  project_id: publicProject.id,
  title: 'Complex Feature Dependencies',
  description: 'Roadmap with intricate feature dependencies',
  features: [
    {
      id: 'feature-foundation-001',
      title: 'Database Schema',
      description: 'Core database design',
      category: 'infrastructure',
      start_date: '2025-01-01',
      target_completion: '2025-01-10',
      dependencies: [],
      status: 'completed',
      effort_estimate: 40
    },
    {
      id: 'feature-api-001',
      title: 'REST API',
      description: 'Build REST API endpoints',
      category: 'core',
      start_date: '2025-01-11',
      target_completion: '2025-01-25',
      dependencies: ['feature-foundation-001'],
      status: 'completed',
      effort_estimate: 80
    },
    {
      id: 'feature-frontend-001',
      title: 'Frontend UI',
      description: 'Build user interface',
      category: 'core',
      start_date: '2025-01-26',
      target_completion: '2025-02-15',
      dependencies: ['feature-api-001'],
      status: 'in_progress',
      effort_estimate: 120
    },
    {
      id: 'feature-auth-001',
      title: 'Authentication',
      description: 'Implement auth system',
      category: 'core',
      start_date: '2025-01-15',
      target_completion: '2025-02-01',
      dependencies: ['feature-foundation-001'],
      status: 'in_progress',
      effort_estimate: 60
    },
    {
      id: 'feature-integration-001',
      title: 'Frontend Auth Integration',
      description: 'Integrate auth with frontend',
      category: 'core',
      start_date: '2025-02-16',
      target_completion: '2025-03-01',
      dependencies: ['feature-frontend-001', 'feature-auth-001'],
      status: 'planned',
      effort_estimate: 40
    },
    {
      id: 'feature-blocked-001',
      title: 'Blocked Feature',
      description: 'Feature blocked by external dependency',
      category: 'enhancement',
      start_date: '2025-03-01',
      target_completion: '2025-03-31',
      dependencies: ['feature-integration-001'],
      status: 'blocked',
      effort_estimate: 80
    }
  ],
  version: '2.1.0',
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-15T00:00:00.000Z'
}

/**
 * Generate a roadmap with custom features
 */
export function createTestRoadmap(overrides: Partial<TestRoadmap> = {}): TestRoadmap {
  const timestamp = Date.now()
  return {
    id: `roadmap-${timestamp}`,
    project_id: basicProject.id,
    title: `Test Roadmap ${timestamp}`,
    description: `Test roadmap created at ${new Date().toISOString()}`,
    features: [],
    version: '1.0.0',
    created_by: testUser.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Generate a test feature
 */
export function createTestFeature(overrides: Partial<TestRoadmapFeature> = {}): TestRoadmapFeature {
  const timestamp = Date.now()
  const startDate = new Date()
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 14) // 2 weeks default

  return {
    id: `feature-${timestamp}`,
    title: `Test Feature ${timestamp}`,
    description: `Test feature created at ${new Date().toISOString()}`,
    category: 'core',
    start_date: startDate.toISOString().split('T')[0],
    target_completion: endDate.toISOString().split('T')[0],
    dependencies: [],
    status: 'planned',
    effort_estimate: 40,
    ...overrides
  }
}

/**
 * Generate multiple features with dependencies
 */
export function createFeatureChain(count: number): TestRoadmapFeature[] {
  const features: TestRoadmapFeature[] = []
  const baseDate = new Date('2025-01-01')

  for (let i = 0; i < count; i++) {
    const startDate = new Date(baseDate)
    startDate.setDate(startDate.getDate() + i * 14)

    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 14)

    features.push({
      id: `feature-chain-${i}`,
      title: `Chained Feature ${i + 1}`,
      description: `Feature ${i + 1} in dependency chain`,
      category: 'core',
      start_date: startDate.toISOString().split('T')[0],
      target_completion: endDate.toISOString().split('T')[0],
      dependencies: i > 0 ? [`feature-chain-${i - 1}`] : [],
      status: i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'planned',
      effort_estimate: 40 + i * 20
    })
  }

  return features
}

/**
 * Roadmap with all feature statuses for testing filters
 */
export const statusTestRoadmap: TestRoadmap = {
  id: 'roadmap-status-test-001',
  project_id: basicProject.id,
  title: 'Status Testing Roadmap',
  description: 'Roadmap with features in all possible statuses',
  features: [
    createTestFeature({ id: 'feature-planned-001', status: 'planned', title: 'Planned Feature' }),
    createTestFeature({ id: 'feature-progress-001', status: 'in_progress', title: 'In Progress Feature' }),
    createTestFeature({ id: 'feature-completed-001', status: 'completed', title: 'Completed Feature' }),
    createTestFeature({ id: 'feature-blocked-001', status: 'blocked', title: 'Blocked Feature' })
  ],
  version: '1.0.0',
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
}

/**
 * All test roadmaps for easy iteration
 */
export const allTestRoadmaps = [
  basicRoadmap,
  emptyRoadmap,
  complexRoadmap,
  statusTestRoadmap
]

/**
 * Performance testing - large roadmap with many features
 */
export const largeRoadmap: TestRoadmap = {
  id: 'roadmap-large-001',
  project_id: basicProject.id,
  title: 'Large Roadmap for Performance Testing',
  description: 'Roadmap with 50 features for performance testing',
  features: createFeatureChain(50),
  version: '1.0.0',
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
}
