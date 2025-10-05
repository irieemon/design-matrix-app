import type { Project, ProjectType, ProjectStatus } from '../../../src/types';

/**
 * Test data generators and fixtures for E2E tests
 */

export const TEST_USERS = {
  owner: {
    id: 'test-owner-001',
    email: 'owner@test.com',
    name: 'Test Owner'
  },
  editor: {
    id: 'test-editor-001',
    email: 'editor@test.com',
    name: 'Test Editor'
  },
  viewer: {
    id: 'test-viewer-001',
    email: 'viewer@test.com',
    name: 'Test Viewer'
  },
  commenter: {
    id: 'test-commenter-001',
    email: 'commenter@test.com',
    name: 'Test Commenter'
  }
};

export const PROJECT_TYPES: ProjectType[] = [
  'software',
  'business_plan',
  'product_development',
  'marketing',
  'operations',
  'research',
  'other'
];

export const PROJECT_STATUSES: ProjectStatus[] = [
  'active',
  'completed',
  'paused',
  'archived'
];

/**
 * Generate a test project
 */
export function generateTestProject(overrides?: Partial<Project>): Omit<Project, 'id' | 'created_at' | 'updated_at'> {
  const timestamp = Date.now();
  return {
    name: `Test Project ${timestamp}`,
    description: 'Automated test project',
    project_type: 'software',
    status: 'active',
    visibility: 'private',
    priority_level: 'medium',
    owner_id: TEST_USERS.owner.id,
    ...overrides
  };
}

/**
 * Generate multiple test projects
 */
export function generateTestProjects(count: number, baseOverrides?: Partial<Project>): Array<Omit<Project, 'id' | 'created_at' | 'updated_at'>> {
  return Array.from({ length: count }, (_, index) =>
    generateTestProject({
      ...baseOverrides,
      name: `${baseOverrides?.name || 'Test Project'} ${index + 1}`
    })
  );
}

/**
 * Generate test collaborator data
 */
export function generateTestCollaborator(index: number) {
  return {
    email: `collaborator${index}@test.com`,
    id: `test-collaborator-${String(index).padStart(3, '0')}`,
    name: `Test Collaborator ${index}`
  };
}

/**
 * Mock project data for visual regression tests
 */
export const MOCK_PROJECTS = {
  software: {
    name: 'E-Commerce Platform',
    description: 'Full-stack web application for online retail',
    project_type: 'software' as ProjectType,
    status: 'active' as ProjectStatus,
    visibility: 'private' as const,
    priority_level: 'high' as const,
    owner_id: TEST_USERS.owner.id,
    tags: ['web', 'react', 'nodejs'],
    team_size: 5,
    budget: 50000
  },
  marketing: {
    name: 'Q4 Marketing Campaign',
    description: 'Social media and content marketing initiative',
    project_type: 'marketing' as ProjectType,
    status: 'active' as ProjectStatus,
    visibility: 'team' as const,
    priority_level: 'critical' as const,
    owner_id: TEST_USERS.owner.id,
    tags: ['social-media', 'content', 'campaign'],
    target_date: '2025-12-31'
  },
  research: {
    name: 'Market Research Study',
    description: 'Customer behavior and preferences analysis',
    project_type: 'research' as ProjectType,
    status: 'active' as ProjectStatus,
    visibility: 'private' as const,
    priority_level: 'medium' as const,
    owner_id: TEST_USERS.owner.id,
    tags: ['research', 'analysis'],
    start_date: '2025-09-01',
    target_date: '2025-12-01'
  }
};

/**
 * Generate random project name
 */
export function generateProjectName(type?: ProjectType): string {
  const adjectives = ['Innovative', 'Strategic', 'Dynamic', 'Comprehensive', 'Advanced'];
  const nouns = ['Initiative', 'Project', 'Program', 'Campaign', 'System'];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const timestamp = Date.now().toString().slice(-4);

  return `${adjective} ${type || 'Test'} ${noun} ${timestamp}`;
}

/**
 * Wait utilities
 */
export const TIMEOUTS = {
  SHORT: 1000,
  MEDIUM: 3000,
  LONG: 5000,
  NETWORK: 10000,
  MODAL: 2000,
  ANIMATION: 500
};

/**
 * Selectors
 */
export const SELECTORS = {
  PROJECT_CARD: '[data-testid="project-card"]',
  PROJECT_NAME: '[data-testid="project-name"]',
  SIDEBAR_PROJECT: '[data-testid="sidebar-project"]',
  COLLABORATOR_ROW: '[data-testid="collaborator-row"]',
  ACTIVITY_ENTRY: '[data-testid="activity-entry"]',
  ONLINE_INDICATOR: '[data-testid="online-indicator"]',
  ACTIVE_PROJECT: '[data-testid="active-project"]'
};

/**
 * Error messages for validation
 */
export const ERROR_MESSAGES = {
  DUPLICATE_COLLABORATOR: /already a collaborator|already invited/i,
  INVALID_EMAIL: /invalid email|enter a valid email/i,
  PERMISSION_DENIED: /permission denied|insufficient permissions/i,
  PROJECT_NOT_FOUND: /project not found|does not exist/i,
  REQUIRED_FIELD: /required|cannot be empty/i
};

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  PROJECT_CREATED: /project created|successfully created/i,
  COLLABORATOR_INVITED: /invitation sent|collaborator invited/i,
  ROLE_UPDATED: /role updated|permissions changed/i,
  COLLABORATOR_REMOVED: /collaborator removed|user removed/i,
  OWNERSHIP_TRANSFERRED: /ownership transferred|new owner/i
};
