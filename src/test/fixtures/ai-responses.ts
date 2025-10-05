/**
 * Test AI Response Fixtures
 * Provides consistent mock OpenAI responses for testing AI features
 */

import { basicProject } from './projects'
import { testUser } from './users'

/**
 * Mock OpenAI API response structure
 */
export interface MockOpenAIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Mock idea generation response
 */
export const mockIdeaGenerationResponse: MockOpenAIResponse = {
  id: 'chatcmpl-test-001',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify({
          ideas: [
            {
              title: 'AI-Powered Search',
              description: 'Implement semantic search using vector embeddings',
              category: 'feature',
              x_position: 75,
              y_position: 80
            },
            {
              title: 'Real-time Collaboration',
              description: 'WebSocket-based collaborative editing',
              category: 'feature',
              x_position: 60,
              y_position: 70
            },
            {
              title: 'Advanced Analytics Dashboard',
              description: 'Comprehensive project metrics and insights',
              category: 'enhancement',
              x_position: 50,
              y_position: 60
            }
          ]
        })
      },
      finish_reason: 'stop'
    }
  ],
  usage: {
    prompt_tokens: 120,
    completion_tokens: 85,
    total_tokens: 205
  }
}

/**
 * Mock roadmap generation response
 */
export const mockRoadmapGenerationResponse: MockOpenAIResponse = {
  id: 'chatcmpl-test-002',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify({
          features: [
            {
              title: 'User Authentication System',
              description: 'Implement secure JWT-based authentication',
              category: 'core',
              start_date: '2025-01-01',
              target_completion: '2025-01-15',
              dependencies: [],
              effort_estimate: 40
            },
            {
              title: 'Dashboard Development',
              description: 'Create user dashboard with project overview',
              category: 'core',
              start_date: '2025-01-16',
              target_completion: '2025-02-01',
              dependencies: ['User Authentication System'],
              effort_estimate: 80
            },
            {
              title: 'API Integration',
              description: 'Integrate third-party APIs for enhanced functionality',
              category: 'enhancement',
              start_date: '2025-02-15',
              target_completion: '2025-03-01',
              dependencies: ['Dashboard Development'],
              effort_estimate: 60
            }
          ]
        })
      },
      finish_reason: 'stop'
    }
  ],
  usage: {
    prompt_tokens: 150,
    completion_tokens: 120,
    total_tokens: 270
  }
}

/**
 * Mock insights analysis response
 */
export const mockInsightsResponse: MockOpenAIResponse = {
  id: 'chatcmpl-test-003',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify({
          insights: {
            strengths: [
              'Strong focus on core features',
              'Good balance between innovation and feasibility',
              'Clear prioritization of high-value items'
            ],
            weaknesses: [
              'Limited technical debt management',
              'Few infrastructure improvements',
              'Minimal performance optimization focus'
            ],
            opportunities: [
              'Implement caching layer for performance gains',
              'Add comprehensive monitoring and analytics',
              'Explore AI-powered features for differentiation'
            ],
            threats: [
              'Competitor moving faster on similar features',
              'Technical debt accumulation risk',
              'Scalability concerns with current architecture'
            ],
            recommendations: [
              'Allocate 20% of roadmap to technical debt',
              'Implement performance monitoring early',
              'Consider microservices for scalability'
            ]
          }
        })
      },
      finish_reason: 'stop'
    }
  ],
  usage: {
    prompt_tokens: 200,
    completion_tokens: 180,
    total_tokens: 380
  }
}

/**
 * Mock file analysis response
 */
export const mockFileAnalysisResponse: MockOpenAIResponse = {
  id: 'chatcmpl-test-004',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4-vision-preview',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify({
          analysis: {
            type: 'wireframe',
            components_identified: [
              'Navigation bar with logo and menu',
              'Hero section with CTA button',
              'Feature grid with 3 columns',
              'Footer with social links'
            ],
            suggestions: [
              {
                title: 'Responsive Navigation',
                description: 'Implement mobile-friendly hamburger menu',
                category: 'enhancement',
                priority: 'high'
              },
              {
                title: 'Feature Cards',
                description: 'Create reusable card component for features',
                category: 'feature',
                priority: 'medium'
              },
              {
                title: 'Accessibility Improvements',
                description: 'Add ARIA labels and keyboard navigation',
                category: 'enhancement',
                priority: 'high'
              }
            ],
            confidence: 0.92
          }
        })
      },
      finish_reason: 'stop'
    }
  ],
  usage: {
    prompt_tokens: 1250, // Vision models use more tokens
    completion_tokens: 95,
    total_tokens: 1345
  }
}

/**
 * Mock transcription response
 */
export const mockTranscriptionResponse = {
  text: 'This is a test transcription of an audio file. The user is describing a new feature idea for implementing real-time collaboration in the design matrix application. They mention wanting WebSocket support and optimistic UI updates for a smooth user experience.'
}

/**
 * Mock error response - rate limit
 */
export const mockRateLimitError = {
  error: {
    message: 'Rate limit exceeded. Please try again later.',
    type: 'rate_limit_error',
    code: 'rate_limit_exceeded'
  }
}

/**
 * Mock error response - invalid request
 */
export const mockInvalidRequestError = {
  error: {
    message: 'Invalid request: missing required field "prompt"',
    type: 'invalid_request_error',
    code: 'invalid_request'
  }
}

/**
 * Mock error response - server error
 */
export const mockServerError = {
  error: {
    message: 'The server had an error processing your request. Please try again.',
    type: 'server_error',
    code: 'internal_server_error'
  }
}

/**
 * Test AI request payload
 */
export interface TestAIRequest {
  project_id: string
  user_id: string
  type: 'generate_ideas' | 'generate_roadmap' | 'analyze_insights' | 'analyze_file' | 'transcribe_audio'
  payload: Record<string, any>
}

/**
 * Sample AI request - generate ideas
 */
export const sampleGenerateIdeasRequest: TestAIRequest = {
  project_id: basicProject.id,
  user_id: testUser.id,
  type: 'generate_ideas',
  payload: {
    title: 'SaaS Platform',
    description: 'Building a project management SaaS platform',
    context: 'Target audience: small to medium businesses',
    count: 5
  }
}

/**
 * Sample AI request - generate roadmap
 */
export const sampleGenerateRoadmapRequest: TestAIRequest = {
  project_id: basicProject.id,
  user_id: testUser.id,
  type: 'generate_roadmap',
  payload: {
    ideas: [
      {
        id: 'idea-001',
        title: 'User Authentication',
        description: 'Secure login system',
        category: 'feature'
      },
      {
        id: 'idea-002',
        title: 'Project Dashboard',
        description: 'Overview of all projects',
        category: 'feature'
      }
    ],
    timeline: '3 months',
    team_size: 3
  }
}

/**
 * Sample AI request - analyze insights
 */
export const sampleAnalyzeInsightsRequest: TestAIRequest = {
  project_id: basicProject.id,
  user_id: testUser.id,
  type: 'analyze_insights',
  payload: {
    ideas: [
      { title: 'Feature A', category: 'core', x_position: 80, y_position: 75 },
      { title: 'Feature B', category: 'enhancement', x_position: 60, y_position: 50 },
      { title: 'Feature C', category: 'research', x_position: 30, y_position: 40 }
    ],
    roadmap: {
      features: [
        { title: 'Phase 1', status: 'completed' },
        { title: 'Phase 2', status: 'in_progress' }
      ]
    }
  }
}

/**
 * Factory function to create mock OpenAI response
 */
export function createMockOpenAIResponse(
  content: any,
  overrides: Partial<MockOpenAIResponse> = {}
): MockOpenAIResponse {
  return {
    id: `chatcmpl-test-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: typeof content === 'string' ? content : JSON.stringify(content)
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150
    },
    ...overrides
  }
}

/**
 * All test AI responses for easy iteration
 */
export const allTestAIResponses = [
  mockIdeaGenerationResponse,
  mockRoadmapGenerationResponse,
  mockInsightsResponse,
  mockFileAnalysisResponse
]

/**
 * All test AI errors for error handling tests
 */
export const allTestAIErrors = [
  mockRateLimitError,
  mockInvalidRequestError,
  mockServerError
]

/**
 * All test AI requests for API tests
 */
export const allTestAIRequests = [
  sampleGenerateIdeasRequest,
  sampleGenerateRoadmapRequest,
  sampleAnalyzeInsightsRequest
]
