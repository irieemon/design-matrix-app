/**
 * Detailed Analytics Component
 *
 * Provides tabular drill-down into platform metrics:
 * - Top Users Table (by token usage and cost)
 * - Top Projects Table (by activity and token consumption)
 * - Endpoint Metrics Table (API performance)
 *
 * Features:
 * - Sortable columns
 * - Pagination (10 per page)
 * - CSV export per table
 * - Responsive design
 * - Click to view details
 * - Color-coded performance indicators
 */

import React from 'react'
import DataTable, { TableColumn } from './DataTable'
import { Users, FolderKanban, Activity, Mail, Calendar, DollarSign, Zap } from 'lucide-react'

// ============================================================================
// TYPE DEFINITIONS (matching API response)
// ============================================================================

interface TopUserMetric {
  userId: string
  email: string
  fullName: string | null
  projectCount: number
  ideaCount: number
  totalTokens: number
  totalCost: number
  lastActive: string | null
}

interface TopProjectMetric {
  projectId: string
  name: string
  ownerEmail: string
  ideaCount: number
  tokenUsage: number
  cost: number
  lastUpdated: string
}

interface EndpointMetric {
  endpoint: string
  callCount: number
  totalTokens: number
  avgTokensPerCall: number
  totalCost: number
}

interface DetailedAnalyticsProps {
  topUsers: TopUserMetric[]
  topProjects: TopProjectMetric[]
  topEndpoints: EndpointMetric[]
  onUserClick?: (userId: string) => void
  onProjectClick?: (projectId: string) => void
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return date.toLocaleDateString()
  } catch {
    return dateStr
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

interface SectionHeaderProps {
  title: string
  icon: React.ElementType
  iconColor: string
  count: number
}

function SectionHeader({ title, icon: Icon, iconColor, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 ${iconColor} bg-opacity-10 rounded-lg`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">{count} total results</p>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DetailedAnalytics({
  topUsers,
  topProjects,
  topEndpoints,
  onUserClick,
  onProjectClick
}: DetailedAnalyticsProps) {
  // ============================================================================
  // TOP USERS TABLE CONFIGURATION
  // ============================================================================

  const userColumns: TableColumn<TopUserMetric>[] = [
    {
      key: 'email',
      label: 'User',
      sortable: true,
      width: '25%',
      render: (email, row) => (
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-slate-400" />
          <div>
            <div className="font-medium text-slate-900">{email}</div>
            {row.fullName && row.fullName !== email && (
              <div className="text-xs text-slate-500">{row.fullName}</div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'projectCount',
      label: 'Projects',
      sortable: true,
      align: 'center' as const,
      width: '10%',
      render: (count) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded">
          {count}
        </span>
      )
    },
    {
      key: 'ideaCount',
      label: 'Ideas',
      sortable: true,
      align: 'center' as const,
      width: '10%',
      render: (count) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
          {count}
        </span>
      )
    },
    {
      key: 'totalTokens',
      label: 'Tokens',
      sortable: true,
      align: 'right' as const,
      width: '15%',
      render: (tokens) => (
        <div className="flex items-center justify-end gap-1">
          <Zap className="w-3 h-3 text-green-600" />
          <span className="font-mono text-sm">{formatNumber(tokens)}</span>
        </div>
      )
    },
    {
      key: 'totalCost',
      label: 'Cost',
      sortable: true,
      align: 'right' as const,
      width: '15%',
      render: (cost) => (
        <div className="flex items-center justify-end gap-1">
          <DollarSign className="w-3 h-3 text-red-600" />
          <span className="font-mono text-sm font-semibold">{formatCurrency(cost)}</span>
        </div>
      )
    },
    {
      key: 'lastActive',
      label: 'Last Active',
      sortable: true,
      align: 'right' as const,
      width: '15%',
      render: (lastActive) => (
        <div className="flex items-center justify-end gap-1">
          <Calendar className="w-3 h-3 text-slate-400" />
          <span className="text-sm text-slate-600">{formatDate(lastActive)}</span>
        </div>
      )
    }
  ]

  // ============================================================================
  // TOP PROJECTS TABLE CONFIGURATION
  // ============================================================================

  const projectColumns: TableColumn<TopProjectMetric>[] = [
    {
      key: 'name',
      label: 'Project Name',
      sortable: true,
      width: '30%',
      render: (name) => (
        <div className="font-medium text-slate-900 truncate" title={name}>
          {name}
        </div>
      )
    },
    {
      key: 'ownerEmail',
      label: 'Owner',
      sortable: true,
      width: '25%',
      render: (email) => (
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <Mail className="w-3 h-3 text-slate-400" />
          {email}
        </div>
      )
    },
    {
      key: 'ideaCount',
      label: 'Ideas',
      sortable: true,
      align: 'center' as const,
      width: '10%',
      render: (count) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
          {count}
        </span>
      )
    },
    {
      key: 'tokenUsage',
      label: 'Tokens',
      sortable: true,
      align: 'right' as const,
      width: '15%',
      render: (tokens) => (
        <div className="flex items-center justify-end gap-1">
          <Zap className="w-3 h-3 text-green-600" />
          <span className="font-mono text-sm">{formatNumber(tokens)}</span>
        </div>
      )
    },
    {
      key: 'cost',
      label: 'Cost',
      sortable: true,
      align: 'right' as const,
      width: '12%',
      render: (cost) => (
        <div className="flex items-center justify-end gap-1">
          <DollarSign className="w-3 h-3 text-red-600" />
          <span className="font-mono text-sm font-semibold">{formatCurrency(cost)}</span>
        </div>
      )
    },
    {
      key: 'lastUpdated',
      label: 'Updated',
      sortable: true,
      align: 'right' as const,
      width: '12%',
      render: (date) => (
        <span className="text-sm text-slate-600">{formatDate(date)}</span>
      )
    }
  ]

  // ============================================================================
  // ENDPOINT METRICS TABLE CONFIGURATION
  // ============================================================================

  const endpointColumns: TableColumn<EndpointMetric>[] = [
    {
      key: 'endpoint',
      label: 'Endpoint',
      sortable: true,
      width: '35%',
      render: (endpoint) => (
        <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">
          {endpoint}
        </code>
      )
    },
    {
      key: 'callCount',
      label: 'Calls',
      sortable: true,
      align: 'center' as const,
      width: '15%',
      render: (count) => (
        <div className="flex items-center justify-center gap-1">
          <Activity className="w-3 h-3 text-blue-600" />
          <span className="font-mono text-sm">{formatNumber(count)}</span>
        </div>
      )
    },
    {
      key: 'totalTokens',
      label: 'Total Tokens',
      sortable: true,
      align: 'right' as const,
      width: '15%',
      render: (tokens) => (
        <span className="font-mono text-sm">{formatNumber(tokens)}</span>
      )
    },
    {
      key: 'avgTokensPerCall',
      label: 'Avg Tokens',
      sortable: true,
      align: 'right' as const,
      width: '15%',
      render: (avg) => (
        <span className="font-mono text-sm text-slate-600">{Math.round(avg).toLocaleString()}</span>
      )
    },
    {
      key: 'totalCost',
      label: 'Total Cost',
      sortable: true,
      align: 'right' as const,
      width: '20%',
      render: (cost) => (
        <div className="flex items-center justify-end gap-1">
          <DollarSign className="w-3 h-3 text-red-600" />
          <span className="font-mono text-sm font-semibold">{formatCurrency(cost)}</span>
        </div>
      )
    }
  ]

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleUserClick = (user: TopUserMetric) => {
    onUserClick?.(user.userId)
  }

  const handleProjectClick = (project: TopProjectMetric) => {
    onProjectClick?.(project.projectId)
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-8">
      {/* Top Users Table */}
      <div>
        <SectionHeader
          title="Top Users by Token Usage"
          icon={Users}
          iconColor="text-blue-600"
          count={topUsers.length}
        />
        <DataTable
          columns={userColumns}
          data={topUsers}
          keyField="userId"
          onRowClick={handleUserClick}
          pageSize={10}
          showExport={true}
          exportFileName="top-users"
          emptyMessage="No user data available for the selected period"
        />
      </div>

      {/* Top Projects Table */}
      <div>
        <SectionHeader
          title="Top Projects by Activity"
          icon={FolderKanban}
          iconColor="text-purple-600"
          count={topProjects.length}
        />
        <DataTable
          columns={projectColumns}
          data={topProjects}
          keyField="projectId"
          onRowClick={handleProjectClick}
          pageSize={10}
          showExport={true}
          exportFileName="top-projects"
          emptyMessage="No project data available for the selected period"
        />
      </div>

      {/* Endpoint Metrics Table */}
      <div>
        <SectionHeader
          title="API Endpoint Performance"
          icon={Activity}
          iconColor="text-green-600"
          count={topEndpoints.length}
        />
        <DataTable
          columns={endpointColumns}
          data={topEndpoints}
          keyField="endpoint"
          pageSize={10}
          showExport={true}
          exportFileName="endpoint-metrics"
          emptyMessage="No endpoint metrics available for the selected period"
        />
      </div>
    </div>
  )
}
