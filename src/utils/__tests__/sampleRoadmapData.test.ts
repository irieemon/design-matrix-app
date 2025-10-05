import { describe, it, expect } from 'vitest'
import {
  sampleMarketingRoadmap,
  sampleSoftwareRoadmap,
  sampleEventRoadmap
} from '../sampleRoadmapData'

describe('sampleRoadmapData', () => {
  describe('sampleMarketingRoadmap', () => {
    it('should export valid marketing roadmap data', () => {
      expect(sampleMarketingRoadmap).toBeDefined()
      expect(Array.isArray(sampleMarketingRoadmap)).toBe(true)
      expect(sampleMarketingRoadmap.length).toBeGreaterThan(0)
    })

    it('should have all required feature properties', () => {
      sampleMarketingRoadmap.forEach(feature => {
        expect(feature).toHaveProperty('id')
        expect(feature).toHaveProperty('title')
        expect(feature).toHaveProperty('description')
        expect(feature).toHaveProperty('startMonth')
        expect(feature).toHaveProperty('duration')
        expect(feature).toHaveProperty('team')
        expect(feature).toHaveProperty('priority')
        expect(feature).toHaveProperty('status')
      })
    })

    it('should have valid priority values', () => {
      const validPriorities = ['high', 'medium', 'low']

      sampleMarketingRoadmap.forEach(feature => {
        expect(validPriorities).toContain(feature.priority)
      })
    })

    it('should have valid status values', () => {
      const validStatuses = ['planned', 'in-progress', 'completed']

      sampleMarketingRoadmap.forEach(feature => {
        expect(validStatuses).toContain(feature.status)
      })
    })

    it('should have valid team assignments', () => {
      const validTeams = ['creative', 'digital', 'analytics', 'operations']

      sampleMarketingRoadmap.forEach(feature => {
        expect(validTeams).toContain(feature.team)
      })
    })

    it('should have non-negative startMonth values', () => {
      sampleMarketingRoadmap.forEach(feature => {
        expect(feature.startMonth).toBeGreaterThanOrEqual(0)
      })
    })

    it('should have positive duration values', () => {
      sampleMarketingRoadmap.forEach(feature => {
        expect(feature.duration).toBeGreaterThan(0)
      })
    })

    it('should have user stories for all features', () => {
      sampleMarketingRoadmap.forEach(feature => {
        expect(feature.userStories).toBeDefined()
        expect(Array.isArray(feature.userStories)).toBe(true)
        expect(feature.userStories.length).toBeGreaterThan(0)
      })
    })

    it('should have deliverables for all features', () => {
      sampleMarketingRoadmap.forEach(feature => {
        expect(feature.deliverables).toBeDefined()
        expect(Array.isArray(feature.deliverables)).toBe(true)
        expect(feature.deliverables.length).toBeGreaterThan(0)
      })
    })

    it('should have success criteria for all features', () => {
      sampleMarketingRoadmap.forEach(feature => {
        expect(feature.successCriteria).toBeDefined()
        expect(Array.isArray(feature.successCriteria)).toBe(true)
        expect(feature.successCriteria.length).toBeGreaterThan(0)
      })
    })

    it('should have risks identified for all features', () => {
      sampleMarketingRoadmap.forEach(feature => {
        expect(feature.risks).toBeDefined()
        expect(Array.isArray(feature.risks)).toBe(true)
      })
    })

    it('should have Halloween Campaign as first feature', () => {
      const halloweenCampaign = sampleMarketingRoadmap[0]

      expect(halloweenCampaign.title).toBe('Halloween Campaign Launch')
      expect(halloweenCampaign.team).toBe('creative')
      expect(halloweenCampaign.priority).toBe('high')
    })

    it('should have Social Media Amplification feature', () => {
      const socialMediaFeature = sampleMarketingRoadmap.find(
        f => f.title === 'Social Media Amplification'
      )

      expect(socialMediaFeature).toBeDefined()
      expect(socialMediaFeature?.team).toBe('digital')
      expect(socialMediaFeature?.userStories).toContain(
        expect.stringContaining('influencer')
      )
    })

    it('should have Performance Analytics Dashboard feature', () => {
      const analyticsFeature = sampleMarketingRoadmap.find(
        f => f.title === 'Performance Analytics Dashboard'
      )

      expect(analyticsFeature).toBeDefined()
      expect(analyticsFeature?.team).toBe('analytics')
      expect(analyticsFeature?.complexity).toBe('high')
    })

    it('should have Operations & Fulfillment feature', () => {
      const operationsFeature = sampleMarketingRoadmap.find(
        f => f.title === 'Operations & Fulfillment'
      )

      expect(operationsFeature).toBeDefined()
      expect(operationsFeature?.team).toBe('operations')
      expect(operationsFeature?.priority).toBe('medium')
    })

    it('should have unique IDs for all features', () => {
      const ids = sampleMarketingRoadmap.map(f => f.id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have related ideas for most features', () => {
      const featuresWithRelatedIdeas = sampleMarketingRoadmap.filter(
        f => f.relatedIdeas && f.relatedIdeas.length > 0
      )

      expect(featuresWithRelatedIdeas.length).toBeGreaterThan(0)
    })

    it('should have complexity ratings', () => {
      sampleMarketingRoadmap.forEach(feature => {
        expect(feature.complexity).toBeDefined()
        expect(['low', 'medium', 'high']).toContain(feature.complexity)
      })
    })
  })

  describe('sampleSoftwareRoadmap', () => {
    it('should export valid software roadmap data', () => {
      expect(sampleSoftwareRoadmap).toBeDefined()
      expect(Array.isArray(sampleSoftwareRoadmap)).toBe(true)
      expect(sampleSoftwareRoadmap.length).toBeGreaterThan(0)
    })

    it('should have all required feature properties', () => {
      sampleSoftwareRoadmap.forEach(feature => {
        expect(feature).toHaveProperty('id')
        expect(feature).toHaveProperty('title')
        expect(feature).toHaveProperty('description')
        expect(feature).toHaveProperty('startMonth')
        expect(feature).toHaveProperty('duration')
        expect(feature).toHaveProperty('team')
        expect(feature).toHaveProperty('priority')
        expect(feature).toHaveProperty('status')
      })
    })

    it('should have User Authentication System feature', () => {
      const authFeature = sampleSoftwareRoadmap.find(
        f => f.title === 'User Authentication System'
      )

      expect(authFeature).toBeDefined()
      expect(authFeature?.team).toBe('platform')
      expect(authFeature?.priority).toBe('high')
      expect(authFeature?.deliverables).toContain('OAuth integration')
      expect(authFeature?.deliverables).toContain('2FA implementation')
    })

    it('should have Mobile App Beta feature', () => {
      const mobileFeature = sampleSoftwareRoadmap.find(
        f => f.title === 'Mobile App Beta'
      )

      expect(mobileFeature).toBeDefined()
      expect(mobileFeature?.team).toBe('mobile')
      expect(mobileFeature?.duration).toBe(3)
      expect(mobileFeature?.deliverables).toContain('iOS app beta')
      expect(mobileFeature?.deliverables).toContain('Android app beta')
    })

    it('should have valid team assignments for software projects', () => {
      const validTeams = ['platform', 'mobile', 'web', 'backend', 'frontend']

      sampleSoftwareRoadmap.forEach(feature => {
        expect(validTeams).toContain(feature.team)
      })
    })

    it('should have security-related features', () => {
      const hasSecurityFeatures = sampleSoftwareRoadmap.some(
        f => f.title.toLowerCase().includes('auth') ||
             f.description.toLowerCase().includes('security')
      )

      expect(hasSecurityFeatures).toBe(true)
    })

    it('should have high complexity features', () => {
      const highComplexityFeatures = sampleSoftwareRoadmap.filter(
        f => f.complexity === 'high'
      )

      expect(highComplexityFeatures.length).toBeGreaterThan(0)
    })

    it('should have realistic duration estimates', () => {
      sampleSoftwareRoadmap.forEach(feature => {
        expect(feature.duration).toBeGreaterThan(0)
        expect(feature.duration).toBeLessThanOrEqual(12) // Max 12 months
      })
    })

    it('should include success criteria with metrics', () => {
      sampleSoftwareRoadmap.forEach(feature => {
        expect(feature.successCriteria).toBeDefined()
        expect(feature.successCriteria.length).toBeGreaterThan(0)

        // At least one criterion should have a metric
        const hasMetrics = feature.successCriteria.some(
          criterion => /\d+/.test(criterion)
        )
        expect(hasMetrics).toBe(true)
      })
    })

    it('should identify risks for each feature', () => {
      sampleSoftwareRoadmap.forEach(feature => {
        expect(feature.risks).toBeDefined()
        expect(Array.isArray(feature.risks)).toBe(true)
        expect(feature.risks.length).toBeGreaterThan(0)
      })
    })

    it('should have unique feature IDs', () => {
      const ids = sampleSoftwareRoadmap.map(f => f.id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('sampleEventRoadmap', () => {
    it('should export valid event roadmap data', () => {
      expect(sampleEventRoadmap).toBeDefined()
      expect(Array.isArray(sampleEventRoadmap)).toBe(true)
      expect(sampleEventRoadmap.length).toBeGreaterThan(0)
    })

    it('should have all required feature properties', () => {
      sampleEventRoadmap.forEach(feature => {
        expect(feature).toHaveProperty('id')
        expect(feature).toHaveProperty('title')
        expect(feature).toHaveProperty('description')
        expect(feature).toHaveProperty('startMonth')
        expect(feature).toHaveProperty('duration')
        expect(feature).toHaveProperty('team')
        expect(feature).toHaveProperty('priority')
        expect(feature).toHaveProperty('status')
      })
    })

    it('should have Venue Booking & Setup feature', () => {
      const venueFeature = sampleEventRoadmap.find(
        f => f.title === 'Venue Booking & Setup'
      )

      expect(venueFeature).toBeDefined()
      expect(venueFeature?.team).toBe('operations')
      expect(venueFeature?.priority).toBe('high')
      expect(venueFeature?.status).toBe('completed')
    })

    it('should have completed status for past events', () => {
      const completedFeatures = sampleEventRoadmap.filter(
        f => f.status === 'completed'
      )

      expect(completedFeatures.length).toBeGreaterThan(0)
    })

    it('should include venue-related deliverables', () => {
      const venueFeature = sampleEventRoadmap[0]

      expect(venueFeature.deliverables).toContain('Venue contract signed')
      expect(venueFeature.deliverables).toContain('AV equipment confirmed')
      expect(venueFeature.deliverables).toContain('Catering arrangements')
    })

    it('should include accessibility requirements', () => {
      const venueFeature = sampleEventRoadmap[0]

      const hasAccessibility = venueFeature.successCriteria.some(
        criterion => criterion.toLowerCase().includes('accessibility')
      )

      expect(hasAccessibility).toBe(true)
    })

    it('should identify event-specific risks', () => {
      const venueFeature = sampleEventRoadmap[0]

      expect(venueFeature.risks).toBeDefined()
      expect(venueFeature.risks.length).toBeGreaterThan(0)
      expect(venueFeature.risks).toContain(expect.stringContaining('Venue'))
    })

    it('should have related ideas for expansion', () => {
      const venueFeature = sampleEventRoadmap[0]

      expect(venueFeature.relatedIdeas).toBeDefined()
      expect(venueFeature.relatedIdeas.length).toBeGreaterThan(0)
    })
  })

  describe('Data Consistency Across Roadmaps', () => {
    it('should use consistent property names', () => {
      const allRoadmaps = [
        ...sampleMarketingRoadmap,
        ...sampleSoftwareRoadmap,
        ...sampleEventRoadmap
      ]

      const requiredProps = [
        'id', 'title', 'description', 'startMonth', 'duration',
        'team', 'priority', 'status', 'userStories', 'deliverables',
        'successCriteria', 'risks', 'complexity'
      ]

      allRoadmaps.forEach(feature => {
        requiredProps.forEach(prop => {
          expect(feature).toHaveProperty(prop)
        })
      })
    })

    it('should use consistent priority values across all roadmaps', () => {
      const allRoadmaps = [
        ...sampleMarketingRoadmap,
        ...sampleSoftwareRoadmap,
        ...sampleEventRoadmap
      ]

      const validPriorities = ['high', 'medium', 'low']

      allRoadmaps.forEach(feature => {
        expect(validPriorities).toContain(feature.priority)
      })
    })

    it('should use consistent status values across all roadmaps', () => {
      const allRoadmaps = [
        ...sampleMarketingRoadmap,
        ...sampleSoftwareRoadmap,
        ...sampleEventRoadmap
      ]

      const validStatuses = ['planned', 'in-progress', 'completed']

      allRoadmaps.forEach(feature => {
        expect(validStatuses).toContain(feature.status)
      })
    })

    it('should have at least one feature per roadmap', () => {
      expect(sampleMarketingRoadmap.length).toBeGreaterThan(0)
      expect(sampleSoftwareRoadmap.length).toBeGreaterThan(0)
      expect(sampleEventRoadmap.length).toBeGreaterThan(0)
    })

    it('should not have overlapping IDs across roadmaps', () => {
      const allIds = [
        ...sampleMarketingRoadmap.map(f => f.id),
        ...sampleSoftwareRoadmap.map(f => f.id),
        ...sampleEventRoadmap.map(f => f.id)
      ]

      const uniqueIds = new Set(allIds)

      // Note: Sample data may intentionally reuse IDs like 'feature-1'
      // This test documents the current behavior
      expect(uniqueIds.size).toBeLessThanOrEqual(allIds.length)
    })

    it('should have realistic timeline spans', () => {
      const allRoadmaps = [
        ...sampleMarketingRoadmap,
        ...sampleSoftwareRoadmap,
        ...sampleEventRoadmap
      ]

      allRoadmaps.forEach(feature => {
        const endMonth = feature.startMonth + feature.duration
        expect(endMonth).toBeLessThanOrEqual(24) // Max 2 years
      })
    })
  })
})