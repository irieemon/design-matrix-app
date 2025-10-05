/**
 * Test Idea Fixtures
 * Provides consistent idea/card data for testing matrix functionality
 */

import { basicProject } from './projects'
import { testUser } from './users'

export interface TestIdea {
  id: string
  title: string
  description: string
  category: string
  x_position: number
  y_position: number
  project_id: string
  created_by: string
  created_at: string
  updated_at: string
  locked_by?: string | null
  locked_until?: string | null
}

/**
 * Ideas positioned in different quadrants for matrix testing
 */

// Top-Right Quadrant (High Value, High Feasibility)
export const topRightIdea: TestIdea = {
  id: 'idea-topright-001',
  title: 'Quick Win Feature',
  description: 'High value, easy to implement',
  category: 'feature',
  x_position: 75,
  y_position: 75,
  project_id: basicProject.id,
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  locked_by: null,
  locked_until: null
}

// Top-Left Quadrant (High Value, Low Feasibility)
export const topLeftIdea: TestIdea = {
  id: 'idea-topleft-001',
  title: 'Strategic Investment',
  description: 'High value but difficult to implement',
  category: 'feature',
  x_position: 25,
  y_position: 75,
  project_id: basicProject.id,
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  locked_by: null,
  locked_until: null
}

// Bottom-Right Quadrant (Low Value, High Feasibility)
export const bottomRightIdea: TestIdea = {
  id: 'idea-bottomright-001',
  title: 'Nice to Have',
  description: 'Easy but low value',
  category: 'enhancement',
  x_position: 75,
  y_position: 25,
  project_id: basicProject.id,
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  locked_by: null,
  locked_until: null
}

// Bottom-Left Quadrant (Low Value, Low Feasibility)
export const bottomLeftIdea: TestIdea = {
  id: 'idea-bottomleft-001',
  title: 'Low Priority',
  description: 'Low value and difficult',
  category: 'idea',
  x_position: 25,
  y_position: 25,
  project_id: basicProject.id,
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  locked_by: null,
  locked_until: null
}

/**
 * Center positioned idea for neutral testing
 */
export const centerIdea: TestIdea = {
  id: 'idea-center-001',
  title: 'Evaluate Further',
  description: 'Needs more analysis',
  category: 'idea',
  x_position: 50,
  y_position: 50,
  project_id: basicProject.id,
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  locked_by: null,
  locked_until: null
}

/**
 * Locked idea for concurrent edit testing
 */
export const lockedIdea: TestIdea = {
  id: 'idea-locked-001',
  title: 'Currently Being Edited',
  description: 'This idea is locked by another user',
  category: 'feature',
  x_position: 60,
  y_position: 60,
  project_id: basicProject.id,
  created_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  locked_by: 'other-user-001',
  locked_until: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
}

/**
 * Generate a grid of ideas for performance testing
 */
export function generateIdeaGrid(rows: number, cols: number): TestIdea[] {
  const ideas: TestIdea[] = []
  const xStep = 100 / (cols + 1)
  const yStep = 100 / (rows + 1)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const timestamp = Date.now() + (row * cols + col)
      ideas.push({
        id: `idea-grid-${row}-${col}`,
        title: `Idea ${row + 1},${col + 1}`,
        description: `Generated idea at position (${row}, ${col})`,
        category: ['feature', 'enhancement', 'idea', 'bug'][Math.floor(Math.random() * 4)],
        x_position: (col + 1) * xStep,
        y_position: (row + 1) * yStep,
        project_id: basicProject.id,
        created_by: testUser.id,
        created_at: new Date(timestamp).toISOString(),
        updated_at: new Date(timestamp).toISOString(),
        locked_by: null,
        locked_until: null
      })
    }
  }

  return ideas
}

/**
 * Generate a unique test idea
 */
export function createTestIdea(overrides: Partial<TestIdea> = {}): TestIdea {
  const timestamp = Date.now()
  return {
    id: `idea-${timestamp}`,
    title: `Test Idea ${timestamp}`,
    description: `Test idea created at ${new Date().toISOString()}`,
    category: 'idea',
    x_position: 50,
    y_position: 50,
    project_id: basicProject.id,
    created_by: testUser.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    locked_by: null,
    locked_until: null,
    ...overrides
  }
}

/**
 * Ideas by category for filtering tests
 */
export const ideasByCategory = {
  feature: generateIdeaGrid(2, 3).map((idea, i) => ({ ...idea, id: `feature-${i}`, category: 'feature' })),
  enhancement: generateIdeaGrid(2, 2).map((idea, i) => ({ ...idea, id: `enhancement-${i}`, category: 'enhancement' })),
  idea: generateIdeaGrid(2, 2).map((idea, i) => ({ ...idea, id: `idea-${i}`, category: 'idea' })),
  bug: generateIdeaGrid(1, 2).map((idea, i) => ({ ...idea, id: `bug-${i}`, category: 'bug' }))
}

/**
 * All test ideas for easy iteration
 */
export const allTestIdeas = [
  topRightIdea,
  topLeftIdea,
  bottomRightIdea,
  bottomLeftIdea,
  centerIdea,
  lockedIdea
]

/**
 * Large set of ideas for performance testing (100 ideas in 10x10 grid)
 */
export const performanceTestIdeas = generateIdeaGrid(10, 10)
