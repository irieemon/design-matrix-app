import { http, HttpResponse } from 'msw'

export const handlers = [
  // AI API endpoints
  http.post('/api/ai', ({ request }) => {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (action === 'generate-ideas') {
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
    }

    if (action === 'generate-insights') {
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
    }

    if (action === 'generate-roadmap') {
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
    }

    if (action === 'analyze-file') {
      return HttpResponse.json({
        analysis: {
          content: 'Test file analysis content',
          insights: ['Test insight from file'],
          type: 'document'
        }
      })
    }

    if (action === 'transcribe-audio') {
      return HttpResponse.json({
        transcription: 'Test audio transcription',
        confidence: 0.95
      })
    }

    return new HttpResponse(null, { status: 404 })
  }),

  // Admin API endpoints
  http.post('/api/admin', ({ request }) => {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (action === 'migrate-database') {
      return HttpResponse.json({ success: true, message: 'Database migrated successfully' })
    }

    if (action === 'enable-realtime') {
      return HttpResponse.json({ success: true, message: 'Real-time enabled successfully' })
    }

    return new HttpResponse(null, { status: 404 })
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