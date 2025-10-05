/**
 * Intelligent Mock Data Service Tests
 *
 * Tests for realistic project scenario generation, model routing validation,
 * and mock data intelligence. Critical for testing AI optimizations and
 * ensuring model selection logic works correctly.
 */

import { describe, it, expect, vi } from 'vitest'
import { IntelligentMockDataService } from '../intelligentMockData'
import { OpenAIModelRouter } from '../openaiModelRouter'

// Mock OpenAI router
vi.mock('../openaiModelRouter', () => ({
  OpenAIModelRouter: {
    selectModel: vi.fn((context) => ({
      model: context.complexity === 'high' ? 'gpt-5' : 'gpt-5-mini',
      temperature: 1,
      maxTokens: 4000,
      reasoning: `Test reasoning for ${context.type}`,
      cost: context.complexity === 'high' ? 'medium' : 'low'
    }))
  }
}))

describe('IntelligentMockDataService', () => {
  describe('Project Scenario Generation', () => {
    it('should return array of project scenarios', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()

      expect(scenarios).toBeInstanceOf(Array)
      expect(scenarios.length).toBeGreaterThan(0)
    })

    it('should include high complexity scenarios', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const highComplexity = scenarios.filter(s => s.complexity === 'high')

      expect(highComplexity.length).toBeGreaterThan(0)
    })

    it('should include medium complexity scenarios', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const mediumComplexity = scenarios.filter(s => s.complexity === 'medium')

      expect(mediumComplexity.length).toBeGreaterThan(0)
    })

    it('should include low complexity scenarios', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const lowComplexity = scenarios.filter(s => s.complexity === 'low')

      expect(lowComplexity.length).toBeGreaterThan(0)
    })

    it('should have diverse project types', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const types = new Set(scenarios.map(s => s.type))

      expect(types.size).toBeGreaterThan(3)
      expect(types).toContain('SaaS Platform')
      expect(types).toContain('E-commerce Platform')
      expect(types).toContain('Mobile App')
    })

    it('should have diverse industries', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const industries = new Set(scenarios.map(s => s.industry))

      expect(industries.size).toBeGreaterThan(3)
    })
  })

  describe('Scenario Structure Validation', () => {
    it('should have all required scenario fields', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      expect(scenario).toHaveProperty('id')
      expect(scenario).toHaveProperty('name')
      expect(scenario).toHaveProperty('type')
      expect(scenario).toHaveProperty('description')
      expect(scenario).toHaveProperty('complexity')
      expect(scenario).toHaveProperty('industry')
      expect(scenario).toHaveProperty('teamSize')
      expect(scenario).toHaveProperty('budget')
      expect(scenario).toHaveProperty('ideas')
      expect(scenario).toHaveProperty('context')
      expect(scenario).toHaveProperty('expectedAITaskType')
      expect(scenario).toHaveProperty('expectedModelComplexity')
    })

    it('should have valid context structure', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const context = scenarios[0].context

      expect(context).toHaveProperty('marketSegment')
      expect(context).toHaveProperty('competitiveAdvantage')
      expect(context).toHaveProperty('primaryChallenges')
      expect(context).toHaveProperty('keyMetrics')

      expect(context.primaryChallenges).toBeInstanceOf(Array)
      expect(context.keyMetrics).toBeInstanceOf(Array)
    })

    it('should have valid idea structure', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const idea = scenarios[0].ideas[0]

      expect(idea).toHaveProperty('title')
      expect(idea).toHaveProperty('description')
      expect(idea).toHaveProperty('quadrant')
      expect(idea).toHaveProperty('effort')
      expect(idea).toHaveProperty('impact')

      expect(['quick-wins', 'major-projects', 'fill-ins', 'thankless-tasks']).toContain(idea.quadrant)
      expect(idea.effort).toBeGreaterThan(0)
      expect(idea.impact).toBeGreaterThan(0)
    })
  })

  describe('High Complexity Scenarios', () => {
    it('should have SaaS platform scenario with high complexity', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const saas = scenarios.find(s => s.id === 'saas-platform-complex')

      expect(saas).toBeDefined()
      expect(saas!.complexity).toBe('high')
      expect(saas!.teamSize).toBeGreaterThan(20)
      expect(saas!.budget).toBeGreaterThan(1000000)
      expect(saas!.expectedModelComplexity).toBe('high')
    })

    it('should have fintech platform scenario with high complexity', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const fintech = scenarios.find(s => s.id === 'fintech-complex')

      expect(fintech).toBeDefined()
      expect(fintech!.complexity).toBe('high')
      expect(fintech!.expectedAITaskType).toBe('risk-assessment')
      expect(fintech!.expectedModelComplexity).toBe('high')
    })

    it('should have major-projects ideas in high complexity scenarios', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const highComplexity = scenarios.filter(s => s.complexity === 'high')

      highComplexity.forEach(scenario => {
        const majorProjects = scenario.ideas.filter(i => i.quadrant === 'major-projects')
        expect(majorProjects.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Medium Complexity Scenarios', () => {
    it('should have e-commerce scenario with medium complexity', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const ecommerce = scenarios.find(s => s.id === 'ecommerce-medium')

      expect(ecommerce).toBeDefined()
      expect(ecommerce!.complexity).toBe('medium')
      expect(ecommerce!.teamSize).toBeLessThan(20)
      expect(ecommerce!.expectedModelComplexity).toBe('medium')
    })

    it('should have edtech scenario with medium complexity', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const edtech = scenarios.find(s => s.id === 'edtech-medium')

      expect(edtech).toBeDefined()
      expect(edtech!.complexity).toBe('medium')
      expect(edtech!.expectedAITaskType).toBe('idea-generation')
    })

    it('should balance quick-wins and major-projects in medium complexity', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const mediumComplexity = scenarios.filter(s => s.complexity === 'medium')

      mediumComplexity.forEach(scenario => {
        const quickWins = scenario.ideas.filter(i => i.quadrant === 'quick-wins')
        const majorProjects = scenario.ideas.filter(i => i.quadrant === 'major-projects')

        expect(quickWins.length).toBeGreaterThan(0)
        expect(majorProjects.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Low Complexity Scenarios', () => {
    it('should have mobile app scenario with low complexity', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const mobile = scenarios.find(s => s.id === 'mobile-app-simple')

      expect(mobile).toBeDefined()
      expect(mobile!.complexity).toBe('low')
      expect(mobile!.teamSize).toBeLessThan(10)
      expect(mobile!.budget).toBeLessThan(500000)
      expect(mobile!.expectedAITaskType).toBe('quick-analysis')
      expect(mobile!.expectedModelComplexity).toBe('low')
    })

    it('should prioritize quick-wins in low complexity scenarios', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const lowComplexity = scenarios.filter(s => s.complexity === 'low')

      lowComplexity.forEach(scenario => {
        const quickWins = scenario.ideas.filter(i => i.quadrant === 'quick-wins')
        expect(quickWins.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Intelligent Mock Insights Generation', () => {
    it('should generate insights for high complexity scenario', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const highScenario = scenarios.find(s => s.complexity === 'high')!

      const insights = IntelligentMockDataService.generateIntelligentMockInsights(highScenario)

      expect(insights).toHaveProperty('executiveSummary')
      expect(insights).toHaveProperty('keyInsights')
      expect(insights).toHaveProperty('priorityRecommendations')
      expect(insights).toHaveProperty('riskAssessment')
      expect(insights).toHaveProperty('_mockMetadata')
    })

    it('should include executive summary with project details', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const insights = IntelligentMockDataService.generateIntelligentMockInsights(scenario)

      expect(insights.executiveSummary).toContain(scenario.name)
      expect(insights.executiveSummary).toContain(scenario.complexity)
      expect(insights.executiveSummary).toContain(String(scenario.ideas.length))
    })

    it('should generate three key insights', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const insights = IntelligentMockDataService.generateIntelligentMockInsights(scenario)

      expect(insights.keyInsights).toBeInstanceOf(Array)
      expect(insights.keyInsights).toHaveLength(3)

      insights.keyInsights.forEach((insight: any) => {
        expect(insight).toHaveProperty('insight')
        expect(insight).toHaveProperty('impact')
      })
    })

    it('should include industry in key insights', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const insights = IntelligentMockDataService.generateIntelligentMockInsights(scenario)

      const firstInsight = insights.keyInsights[0]
      expect(firstInsight.insight).toContain(scenario.industry)
    })

    it('should generate priority recommendations with time horizons', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const insights = IntelligentMockDataService.generateIntelligentMockInsights(scenario)

      expect(insights.priorityRecommendations).toHaveProperty('immediate')
      expect(insights.priorityRecommendations).toHaveProperty('shortTerm')
      expect(insights.priorityRecommendations).toHaveProperty('longTerm')

      expect(insights.priorityRecommendations.immediate).toBeInstanceOf(Array)
      expect(insights.priorityRecommendations.shortTerm).toBeInstanceOf(Array)
      expect(insights.priorityRecommendations.longTerm).toBeInstanceOf(Array)
    })

    it('should include quick-wins in immediate recommendations', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios.find(s => s.ideas.some(i => i.quadrant === 'quick-wins'))!

      const insights = IntelligentMockDataService.generateIntelligentMockInsights(scenario)

      const quickWin = scenario.ideas.find(i => i.quadrant === 'quick-wins')!
      const immediateRecs = insights.priorityRecommendations.immediate.join(' ')

      expect(immediateRecs).toContain(quickWin.title)
    })

    it('should generate risk assessment', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const insights = IntelligentMockDataService.generateIntelligentMockInsights(scenario)

      expect(insights.riskAssessment).toHaveProperty('highRisk')
      expect(insights.riskAssessment).toHaveProperty('opportunities')

      expect(insights.riskAssessment.highRisk).toBeInstanceOf(Array)
      expect(insights.riskAssessment.opportunities).toBeInstanceOf(Array)
    })

    it('should include challenges in risk assessment', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const insights = IntelligentMockDataService.generateIntelligentMockInsights(scenario)

      expect(insights.riskAssessment.highRisk.length).toBeGreaterThan(0)
    })

    it('should include mock metadata', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const insights = IntelligentMockDataService.generateIntelligentMockInsights(scenario)

      expect(insights._mockMetadata).toHaveProperty('scenarioId')
      expect(insights._mockMetadata).toHaveProperty('selectedModel')
      expect(insights._mockMetadata).toHaveProperty('modelReasoning')
      expect(insights._mockMetadata).toHaveProperty('complexity')
      expect(insights._mockMetadata).toHaveProperty('aiTaskType')
      expect(insights._mockMetadata).toHaveProperty('generatedAt')

      expect(insights._mockMetadata.scenarioId).toBe(scenario.id)
    })
  })

  describe('IdeaCard Conversion', () => {
    it('should convert scenario to IdeaCard array', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const ideaCards = IntelligentMockDataService.convertToIdeaCards(scenario)

      expect(ideaCards).toBeInstanceOf(Array)
      expect(ideaCards.length).toBe(scenario.ideas.length)
    })

    it('should include all required IdeaCard fields', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const ideaCards = IntelligentMockDataService.convertToIdeaCards(scenario)
      const card = ideaCards[0]

      expect(card).toHaveProperty('id')
      expect(card).toHaveProperty('content')
      expect(card).toHaveProperty('details')
      expect(card).toHaveProperty('quadrant')
      expect(card).toHaveProperty('x')
      expect(card).toHaveProperty('y')
      expect(card).toHaveProperty('created_at')
      expect(card).toHaveProperty('updated_at')
      expect(card).toHaveProperty('user_id')
      expect(card).toHaveProperty('project_id')
      expect(card).toHaveProperty('priority')
      expect(card).toHaveProperty('created_by')
      expect(card).toHaveProperty('metadata')
    })

    it('should map idea title to content', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const ideaCards = IntelligentMockDataService.convertToIdeaCards(scenario)

      ideaCards.forEach((card, index) => {
        expect(card.content).toBe(scenario.ideas[index].title)
        expect(card.details).toBe(scenario.ideas[index].description)
      })
    })

    it('should position cards in correct quadrants', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const ideaCards = IntelligentMockDataService.convertToIdeaCards(scenario)

      const quickWin = ideaCards.find(c => c.quadrant === 'quick-wins')
      if (quickWin) {
        expect(quickWin.x).toBeGreaterThan(500)
        expect(quickWin.y).toBeLessThan(500)
      }

      const majorProject = ideaCards.find(c => c.quadrant === 'major-projects')
      if (majorProject) {
        expect(majorProject.x).toBeGreaterThan(500)
        expect(majorProject.y).toBeGreaterThan(500)
      }
    })

    it('should add random variation to positions', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const ideaCards1 = IntelligentMockDataService.convertToIdeaCards(scenario)
      const ideaCards2 = IntelligentMockDataService.convertToIdeaCards(scenario)

      // Should have different positions due to randomness
      const hasVariation = ideaCards1.some((card, i) =>
        card.x !== ideaCards2[i].x || card.y !== ideaCards2[i].y
      )

      expect(hasVariation).toBe(true)
    })

    it('should include effort and impact in metadata', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const ideaCards = IntelligentMockDataService.convertToIdeaCards(scenario)

      ideaCards.forEach((card, index) => {
        expect(card.metadata).toHaveProperty('effort')
        expect(card.metadata).toHaveProperty('impact')
        expect(card.metadata.effort).toBe(scenario.ideas[index].effort)
        expect(card.metadata.impact).toBe(scenario.ideas[index].impact)
      })
    })

    it('should set priority based on quadrant', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const scenario = scenarios[0]

      const ideaCards = IntelligentMockDataService.convertToIdeaCards(scenario)

      const majorProjects = ideaCards.filter(c => c.quadrant === 'major-projects')
      majorProjects.forEach(card => {
        expect(card.priority).toBe('strategic')
      })

      const quickWins = ideaCards.filter(c => c.quadrant === 'quick-wins')
      quickWins.forEach(card => {
        expect(card.priority).toBe('high')
      })
    })
  })

  describe('Scenario Selection Utilities', () => {
    it('should return random scenario', () => {
      const scenario = IntelligentMockDataService.getRandomScenario()

      expect(scenario).toBeDefined()
      expect(scenario).toHaveProperty('id')
      expect(scenario).toHaveProperty('complexity')
    })

    it('should return different scenarios on multiple calls', () => {
      const scenarios = new Set()

      for (let i = 0; i < 20; i++) {
        const scenario = IntelligentMockDataService.getRandomScenario()
        scenarios.add(scenario.id)
      }

      // Should get multiple different scenarios with 20 attempts
      expect(scenarios.size).toBeGreaterThan(1)
    })

    it('should filter scenarios by complexity', () => {
      const highScenario = IntelligentMockDataService.getScenarioByComplexity('high')
      expect(highScenario.complexity).toBe('high')

      const mediumScenario = IntelligentMockDataService.getScenarioByComplexity('medium')
      expect(mediumScenario.complexity).toBe('medium')

      const lowScenario = IntelligentMockDataService.getScenarioByComplexity('low')
      expect(lowScenario.complexity).toBe('low')
    })
  })

  describe('Model Routing Testing', () => {
    it('should test model routing for all scenarios', () => {
      const routingResults = IntelligentMockDataService.testModelRouting()

      expect(routingResults).toBeInstanceOf(Array)
      expect(routingResults.length).toBeGreaterThan(0)
    })

    it('should include scenario name and selected model', () => {
      const routingResults = IntelligentMockDataService.testModelRouting()

      routingResults.forEach(result => {
        expect(result).toHaveProperty('scenario')
        expect(result).toHaveProperty('selectedModel')
        expect(result).toHaveProperty('reasoning')
      })
    })

    it('should call OpenAI router for each scenario', () => {
      IntelligentMockDataService.testModelRouting()

      const scenarios = IntelligentMockDataService.getProjectScenarios()
      expect(OpenAIModelRouter.selectModel).toHaveBeenCalledTimes(scenarios.length)
    })

    it('should match high complexity to gpt-5', () => {
      vi.mocked(OpenAIModelRouter.selectModel).mockImplementation((context) => ({
        model: context.complexity === 'high' ? 'gpt-5' : 'gpt-5-mini',
        temperature: 1,
        maxTokens: 4000,
        reasoning: 'Test',
        cost: 'low'
      }))

      const routingResults = IntelligentMockDataService.testModelRouting()
      const highComplexityResults = routingResults.filter(r => r.scenario.includes('(high)'))

      highComplexityResults.forEach(result => {
        expect(result.selectedModel).toBe('gpt-5')
      })
    })

    it('should match low complexity to gpt-5-mini', () => {
      vi.mocked(OpenAIModelRouter.selectModel).mockImplementation((context) => ({
        model: context.complexity === 'low' ? 'gpt-5-mini' : 'gpt-5',
        temperature: 1,
        maxTokens: 4000,
        reasoning: 'Test',
        cost: 'low'
      }))

      const routingResults = IntelligentMockDataService.testModelRouting()
      const lowComplexityResults = routingResults.filter(r => r.scenario.includes('(low)'))

      lowComplexityResults.forEach(result => {
        expect(result.selectedModel).toBe('gpt-5-mini')
      })
    })
  })

  describe('Quadrant Distribution', () => {
    it('should have balanced quadrant distribution across scenarios', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()
      const quadrantCounts = {
        'quick-wins': 0,
        'major-projects': 0,
        'fill-ins': 0,
        'thankless-tasks': 0
      }

      scenarios.forEach(scenario => {
        scenario.ideas.forEach(idea => {
          quadrantCounts[idea.quadrant]++
        })
      })

      // Each quadrant should have at least one idea across all scenarios
      Object.values(quadrantCounts).forEach(count => {
        expect(count).toBeGreaterThan(0)
      })
    })

    it('should have thankless-tasks in each scenario', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()

      scenarios.forEach(scenario => {
        const thanklessTasks = scenario.ideas.filter(i => i.quadrant === 'thankless-tasks')
        expect(thanklessTasks.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Effort and Impact Validation', () => {
    it('should have valid effort scores (1-100)', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()

      scenarios.forEach(scenario => {
        scenario.ideas.forEach(idea => {
          expect(idea.effort).toBeGreaterThanOrEqual(1)
          expect(idea.effort).toBeLessThanOrEqual(100)
        })
      })
    })

    it('should have valid impact scores (1-100)', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()

      scenarios.forEach(scenario => {
        scenario.ideas.forEach(idea => {
          expect(idea.impact).toBeGreaterThanOrEqual(1)
          expect(idea.impact).toBeLessThanOrEqual(100)
        })
      })
    })

    it('should correlate high impact with major-projects', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()

      scenarios.forEach(scenario => {
        const majorProjects = scenario.ideas.filter(i => i.quadrant === 'major-projects')

        majorProjects.forEach(project => {
          expect(project.impact).toBeGreaterThan(50)
        })
      })
    })

    it('should correlate low effort with quick-wins', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()

      scenarios.forEach(scenario => {
        const quickWins = scenario.ideas.filter(i => i.quadrant === 'quick-wins')

        quickWins.forEach(win => {
          expect(win.effort).toBeLessThan(50)
        })
      })
    })
  })

  describe('Budget and Team Size Correlation', () => {
    it('should correlate team size with complexity', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()

      const highComplexity = scenarios.filter(s => s.complexity === 'high')
      const lowComplexity = scenarios.filter(s => s.complexity === 'low')

      const avgHighTeamSize = highComplexity.reduce((sum, s) => sum + s.teamSize, 0) / highComplexity.length
      const avgLowTeamSize = lowComplexity.reduce((sum, s) => sum + s.teamSize, 0) / lowComplexity.length

      expect(avgHighTeamSize).toBeGreaterThan(avgLowTeamSize)
    })

    it('should correlate budget with complexity', () => {
      const scenarios = IntelligentMockDataService.getProjectScenarios()

      const highComplexity = scenarios.filter(s => s.complexity === 'high')
      const lowComplexity = scenarios.filter(s => s.complexity === 'low')

      const avgHighBudget = highComplexity.reduce((sum, s) => sum + s.budget, 0) / highComplexity.length
      const avgLowBudget = lowComplexity.reduce((sum, s) => sum + s.budget, 0) / lowComplexity.length

      expect(avgHighBudget).toBeGreaterThan(avgLowBudget)
    })
  })
})
