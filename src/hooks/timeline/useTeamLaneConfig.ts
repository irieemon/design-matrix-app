import { useMemo } from 'react'
import { Users, Monitor, Smartphone, TrendingUp, Settings, BarChart3 } from 'lucide-react'
import { RoadmapFeature } from './useTimelineFeatures'

interface TeamLane {
  id: string
  name: string
  icon: React.ComponentType<any>
  color: string
  bgColor: string
}

interface UseTeamLaneConfigParams {
  features: RoadmapFeature[]
  projectType: string
}

interface UseTeamLaneConfigReturn {
  teamLanes: TeamLane[]
}

export const useTeamLaneConfig = ({
  features,
  projectType
}: UseTeamLaneConfigParams): UseTeamLaneConfigReturn => {
  const teamLanes = useMemo(() => {
    const type = projectType.toLowerCase()
    const teamIds = new Set(features.map(f => f.team))

    if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
      // Software development teams
      const teams: TeamLane[] = []

      if (teamIds.has('platform')) {
        teams.push({
          id: 'platform',
          name: 'PLATFORM TEAM',
          icon: Settings,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        })
      }

      if (teamIds.has('web')) {
        teams.push({
          id: 'web',
          name: 'WEB TEAM',
          icon: Monitor,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        })
      }

      if (teamIds.has('mobile')) {
        teams.push({
          id: 'mobile',
          name: 'MOBILE TEAM',
          icon: Smartphone,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        })
      }

      if (teamIds.has('testing')) {
        teams.push({
          id: 'testing',
          name: 'QA & TESTING',
          icon: BarChart3,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50'
        })
      }

      return teams.length > 0 ? teams : [{
        id: 'platform',
        name: 'PLATFORM TEAM',
        icon: Settings,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      }]

    } else if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
      // Marketing campaign teams
      const teams: TeamLane[] = []

      if (teamIds.has('creative')) {
        teams.push({
          id: 'creative',
          name: 'CREATIVE TEAM',
          icon: Monitor,
          color: 'text-pink-600',
          bgColor: 'bg-pink-50'
        })
      }

      if (teamIds.has('digital')) {
        teams.push({
          id: 'digital',
          name: 'DIGITAL MARKETING',
          icon: TrendingUp,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        })
      }

      if (teamIds.has('analytics')) {
        teams.push({
          id: 'analytics',
          name: 'ANALYTICS TEAM',
          icon: BarChart3,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        })
      }

      if (teamIds.has('operations')) {
        teams.push({
          id: 'operations',
          name: 'OPERATIONS TEAM',
          icon: Settings,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        })
      }

      return teams.length > 0 ? teams : [{
        id: 'creative',
        name: 'CREATIVE TEAM',
        icon: Monitor,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50'
      }]

    } else if (type.includes('event') || type.includes('conference') || type.includes('meeting')) {
      // Event management teams
      const teams: TeamLane[] = []

      if (teamIds.has('planning')) {
        teams.push({
          id: 'planning',
          name: 'PLANNING TEAM',
          icon: Settings,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        })
      }

      if (teamIds.has('marketing')) {
        teams.push({
          id: 'marketing',
          name: 'MARKETING TEAM',
          icon: TrendingUp,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50'
        })
      }

      if (teamIds.has('operations')) {
        teams.push({
          id: 'operations',
          name: 'OPERATIONS TEAM',
          icon: Monitor,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        })
      }

      if (teamIds.has('experience')) {
        teams.push({
          id: 'experience',
          name: 'EXPERIENCE TEAM',
          icon: Users,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        })
      }

      return teams.length > 0 ? teams : [{
        id: 'planning',
        name: 'PLANNING TEAM',
        icon: Settings,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      }]

    } else {
      // Generic teams based on what's available
      const teams: TeamLane[] = []

      // Map common team IDs to display names
      const teamMapping = {
        'planning': { name: 'PLANNING TEAM', icon: Settings, color: 'text-blue-600', bgColor: 'bg-blue-50' },
        'execution': { name: 'EXECUTION TEAM', icon: Monitor, color: 'text-orange-600', bgColor: 'bg-orange-50' },
        'coordination': { name: 'COORDINATION TEAM', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50' },
        'evaluation': { name: 'EVALUATION TEAM', icon: BarChart3, color: 'text-green-600', bgColor: 'bg-green-50' },
        'research': { name: 'RESEARCH TEAM', icon: Monitor, color: 'text-blue-600', bgColor: 'bg-blue-50' },
        'analysis': { name: 'ANALYSIS TEAM', icon: BarChart3, color: 'text-green-600', bgColor: 'bg-green-50' },
        'documentation': { name: 'DOCUMENTATION TEAM', icon: Settings, color: 'text-orange-600', bgColor: 'bg-orange-50' },
        'stakeholder': { name: 'STAKEHOLDER TEAM', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50' },
        'strategy': { name: 'STRATEGY TEAM', icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-50' },
        'measurement': { name: 'MEASUREMENT TEAM', icon: BarChart3, color: 'text-green-600', bgColor: 'bg-green-50' }
      }

      teamIds.forEach(teamId => {
        const teamConfig = teamMapping[teamId as keyof typeof teamMapping]
        if (teamConfig) {
          teams.push({
            id: teamId,
            ...teamConfig
          })
        }
      })

      return teams.length > 0 ? teams : [{
        id: 'planning',
        name: 'PLANNING TEAM',
        icon: Settings,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      }]
    }
  }, [features, projectType])

  return {
    teamLanes
  }
}

export type { TeamLane, UseTeamLaneConfigParams, UseTeamLaneConfigReturn }