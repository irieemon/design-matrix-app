import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTeamLaneConfig } from '../useTeamLaneConfig'
import { RoadmapFeature } from '../useTimelineFeatures'
import { Users, Monitor, Smartphone, TrendingUp, Settings, BarChart3 } from 'lucide-react'

const createMockFeatures = (teams: string[]): RoadmapFeature[] => {
  return teams.map((team, index) => ({
    id: `feature-${index + 1}`,
    title: `Feature ${index + 1}`,
    startMonth: index,
    duration: 1,
    team,
    priority: 'medium' as const,
    status: 'planned' as const
  }))
}

describe('useTeamLaneConfig', () => {
  describe('software project types', () => {
    it('should return software team lanes for software project type', () => {
      const features = createMockFeatures(['platform', 'web', 'mobile', 'testing'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'software'
      }))

      expect(result.current.teamLanes).toHaveLength(4)
      expect(result.current.teamLanes).toEqual([
        {
          id: 'platform',
          name: 'PLATFORM TEAM',
          icon: Settings,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        },
        {
          id: 'web',
          name: 'WEB TEAM',
          icon: Monitor,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        },
        {
          id: 'mobile',
          name: 'MOBILE TEAM',
          icon: Smartphone,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        },
        {
          id: 'testing',
          name: 'QA & TESTING',
          icon: BarChart3,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50'
        }
      ])
    })

    it('should handle partial software teams', () => {
      const features = createMockFeatures(['platform', 'web'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'app'
      }))

      expect(result.current.teamLanes).toHaveLength(2)
      expect(result.current.teamLanes[0].id).toBe('platform')
      expect(result.current.teamLanes[1].id).toBe('web')
    })

    it('should return default platform team for software with no matching teams', () => {
      const features = createMockFeatures(['unknown-team'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'platform'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0]).toEqual({
        id: 'platform',
        name: 'PLATFORM TEAM',
        icon: Settings,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      })
    })

    it('should handle system project type as software', () => {
      const features = createMockFeatures(['testing'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'system'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0].id).toBe('testing')
    })
  })

  describe('marketing project types', () => {
    it('should return marketing team lanes for marketing project type', () => {
      const features = createMockFeatures(['creative', 'digital', 'analytics', 'operations'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'marketing'
      }))

      expect(result.current.teamLanes).toHaveLength(4)
      expect(result.current.teamLanes).toEqual([
        {
          id: 'creative',
          name: 'CREATIVE TEAM',
          icon: Monitor,
          color: 'text-pink-600',
          bgColor: 'bg-pink-50'
        },
        {
          id: 'digital',
          name: 'DIGITAL MARKETING',
          icon: TrendingUp,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        },
        {
          id: 'analytics',
          name: 'ANALYTICS TEAM',
          icon: BarChart3,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        },
        {
          id: 'operations',
          name: 'OPERATIONS TEAM',
          icon: Settings,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        }
      ])
    })

    it('should handle campaign project type as marketing', () => {
      const features = createMockFeatures(['creative'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'campaign'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0].id).toBe('creative')
    })

    it('should handle brand project type as marketing', () => {
      const features = createMockFeatures(['digital'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'brand'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0].id).toBe('digital')
    })

    it('should return default creative team for marketing with no matching teams', () => {
      const features = createMockFeatures(['unknown-team'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'marketing'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0]).toEqual({
        id: 'creative',
        name: 'CREATIVE TEAM',
        icon: Monitor,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50'
      })
    })
  })

  describe('event project types', () => {
    it('should return event team lanes for event project type', () => {
      const features = createMockFeatures(['planning', 'marketing', 'operations', 'experience'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'event'
      }))

      expect(result.current.teamLanes).toHaveLength(4)
      expect(result.current.teamLanes).toEqual([
        {
          id: 'planning',
          name: 'PLANNING TEAM',
          icon: Settings,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        },
        {
          id: 'marketing',
          name: 'MARKETING TEAM',
          icon: TrendingUp,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50'
        },
        {
          id: 'operations',
          name: 'OPERATIONS TEAM',
          icon: Monitor,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        },
        {
          id: 'experience',
          name: 'EXPERIENCE TEAM',
          icon: Users,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        }
      ])
    })

    it('should handle conference project type as event', () => {
      const features = createMockFeatures(['planning'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'conference'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0].id).toBe('planning')
    })

    it('should handle meeting project type as event', () => {
      const features = createMockFeatures(['experience'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'meeting'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0].id).toBe('experience')
    })

    it('should return default planning team for event with no matching teams', () => {
      const features = createMockFeatures(['unknown-team'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'event'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0]).toEqual({
        id: 'planning',
        name: 'PLANNING TEAM',
        icon: Settings,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      })
    })
  })

  describe('generic project types', () => {
    it('should return generic team lanes for unknown project types', () => {
      const features = createMockFeatures(['planning', 'execution', 'coordination'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'other'
      }))

      expect(result.current.teamLanes).toHaveLength(3)
      expect(result.current.teamLanes).toEqual([
        {
          id: 'planning',
          name: 'PLANNING TEAM',
          icon: Settings,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        },
        {
          id: 'execution',
          name: 'EXECUTION TEAM',
          icon: Monitor,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        },
        {
          id: 'coordination',
          name: 'COORDINATION TEAM',
          icon: Users,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50'
        }
      ])
    })

    it('should handle all generic team mappings', () => {
      const features = createMockFeatures([
        'planning', 'execution', 'coordination', 'evaluation', 'research',
        'analysis', 'documentation', 'stakeholder', 'strategy', 'measurement'
      ])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'custom'
      }))

      expect(result.current.teamLanes).toHaveLength(10)

      // Check a few key mappings
      const planningTeam = result.current.teamLanes.find(t => t.id === 'planning')
      expect(planningTeam).toBeDefined()
      expect(planningTeam?.name).toBe('PLANNING TEAM')

      const strategyTeam = result.current.teamLanes.find(t => t.id === 'strategy')
      expect(strategyTeam).toBeDefined()
      expect(strategyTeam?.name).toBe('STRATEGY TEAM')
      expect(strategyTeam?.icon).toBe(TrendingUp)

      const measurementTeam = result.current.teamLanes.find(t => t.id === 'measurement')
      expect(measurementTeam).toBeDefined()
      expect(measurementTeam?.name).toBe('MEASUREMENT TEAM')
      expect(measurementTeam?.icon).toBe(BarChart3)
    })

    it('should return default planning team for generic with no matching teams', () => {
      const features = createMockFeatures(['unknown-team'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'other'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0]).toEqual({
        id: 'planning',
        name: 'PLANNING TEAM',
        icon: Settings,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty features array', () => {
      const { result } = renderHook(() => useTeamLaneConfig({
        features: [],
        projectType: 'software'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0]).toEqual({
        id: 'platform',
        name: 'PLATFORM TEAM',
        icon: Settings,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      })
    })

    it('should handle case-insensitive project types', () => {
      const features = createMockFeatures(['platform'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'SOFTWARE'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0].id).toBe('platform')
    })

    it('should handle mixed case project types', () => {
      const features = createMockFeatures(['creative'])
      const { result } = renderHook(() => useTeamLaneConfig({
        features,
        projectType: 'Marketing'
      }))

      expect(result.current.teamLanes).toHaveLength(1)
      expect(result.current.teamLanes[0].id).toBe('creative')
    })

    it('should memoize results for same inputs', () => {
      const features = createMockFeatures(['platform'])
      const { result, rerender } = renderHook(
        (props) => useTeamLaneConfig(props),
        { initialProps: { features, projectType: 'software' } }
      )

      const firstResult = result.current.teamLanes

      // Rerender with same props
      rerender({ features, projectType: 'software' })

      // Should be the same reference due to memoization
      expect(result.current.teamLanes).toBe(firstResult)
    })

    it('should recalculate when features change', () => {
      const initialFeatures = createMockFeatures(['platform'])
      const { result, rerender } = renderHook(
        (props) => useTeamLaneConfig(props),
        { initialProps: { features: initialFeatures, projectType: 'software' } }
      )

      expect(result.current.teamLanes).toHaveLength(1)

      // Change features
      const newFeatures = createMockFeatures(['platform', 'web'])
      rerender({ features: newFeatures, projectType: 'software' })

      expect(result.current.teamLanes).toHaveLength(2)
    })

    it('should recalculate when project type changes', () => {
      const features = createMockFeatures(['platform'])
      const { result, rerender } = renderHook(
        (props) => useTeamLaneConfig(props),
        { initialProps: { features, projectType: 'software' } }
      )

      expect(result.current.teamLanes[0].name).toBe('PLATFORM TEAM')

      // Change project type
      rerender({ features, projectType: 'other' })

      expect(result.current.teamLanes[0].name).toBe('PLANNING TEAM')
    })
  })
})