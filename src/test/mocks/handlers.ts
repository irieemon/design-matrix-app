import { http, HttpResponse } from 'msw'

export const handlers = [
  // AI API endpoints
  http.post('/api/ai/generate-ideas', () => {
    return HttpResponse.json({
      ideas: [
        {
          title: 'Test Idea 1',
          description: 'A test idea for unit testing',
          impact: 'high',
          effort: 'low'
        },
        {
          title: 'Test Idea 2',
          description: 'Another test idea for unit testing',
          impact: 'medium',
          effort: 'medium'
        }
      ]
    })
  }),

  http.post('/api/ai/generate-insights', () => {
    return HttpResponse.json({
      insights: {
        executiveSummary: 'Test executive summary for unit testing',
        keyInsights: [
          {
            insight: 'Test Insight 1',
            impact: 'Test impact description'
          }
        ],
        priorityRecommendations: {
          immediate: ['Test immediate action'],
          shortTerm: ['Test short term action'],
          longTerm: ['Test long term action']
        },
        riskAssessment: {
          highRisk: ['Test high risk'],
          opportunities: ['Test opportunity']
        }
      }
    })
  }),

  http.post('/api/ai/generate-roadmap-v2', () => {
    return HttpResponse.json({
      roadmap: {
        roadmapAnalysis: {
          totalDuration: '12 weeks',
          phases: [
            {
              phase: 'Foundation',
              duration: '4 weeks',
              description: 'Test phase description'
            }
          ]
        },
        executionStrategy: {
          methodology: 'Agile',
          sprintLength: '2 weeks',
          teamRecommendations: 'Test team recommendations'
        }
      }
    })
  }),

  // Admin API endpoints
  http.post('/api/admin/migrate-database', () => {
    return HttpResponse.json({ success: true, message: 'Database migrated successfully' })
  }),

  http.post('/api/admin/enable-realtime', () => {
    return HttpResponse.json({ success: true, message: 'Real-time enabled successfully' })
  }),

  // File processing endpoints
  http.post('/api/ai/analyze-file', () => {
    return HttpResponse.json({
      analysis: {
        content: 'Test file analysis content',
        insights: ['Test insight from file'],
        type: 'document'
      }
    })
  }),

  http.post('/api/ai/transcribe-audio', () => {
    return HttpResponse.json({
      transcription: 'Test audio transcription',
      confidence: 0.95
    })
  }),

  // Rate limiting test endpoint
  http.post('/api/test-rate-limit', ({ request }) => {
    // Simulate rate limiting
    const userAgent = request.headers.get('user-agent')
    if (userAgent?.includes('rate-limit-test')) {
      return new HttpResponse(null, { status: 429 })
    }
    return HttpResponse.json({ success: true })
  })
]