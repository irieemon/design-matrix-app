# Admin System Specification - Prioritas

## Executive Summary

**Purpose**: Comprehensive admin system for user management, project oversight, usage analytics, and token spend tracking
**Integration**: Within main app at `/admin/*` with admin-only visibility
**Tech Stack**: React/TypeScript, Supabase, Recharts/Tremor, TanStack Table
**Priority Features**: User accounts, project visibility, usage analytics, OpenAI token tracking

---

## 1. Database Schema Extensions

### 1.1 New Table: `ai_token_usage`

Track actual OpenAI API token consumption for cost analysis.

```sql
-- ============================================================================
-- AI TOKEN USAGE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  -- API Call Details
  endpoint VARCHAR(100) NOT NULL, -- 'generate-ideas', 'generate-insights', etc.
  model VARCHAR(50) NOT NULL,     -- 'gpt-5', 'gpt-5-mini', etc.

  -- Token Counts (from OpenAI response)
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Cost Calculation (USD)
  input_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  output_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,

  -- Metadata
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  response_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (total_tokens >= 0),
  CHECK (total_cost >= 0)
);

-- Indexes for performance
CREATE INDEX idx_ai_token_usage_user_id ON public.ai_token_usage(user_id);
CREATE INDEX idx_ai_token_usage_created_at ON public.ai_token_usage(created_at DESC);
CREATE INDEX idx_ai_token_usage_user_date ON public.ai_token_usage(user_id, created_at DESC);
CREATE INDEX idx_ai_token_usage_project ON public.ai_token_usage(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_ai_token_usage_endpoint ON public.ai_token_usage(endpoint);

-- Comments
COMMENT ON TABLE public.ai_token_usage IS 'Track OpenAI API token consumption and costs per request';
COMMENT ON COLUMN public.ai_token_usage.endpoint IS 'API endpoint called: generate-ideas, generate-insights, generate-roadmap, analyze-file, analyze-image, transcribe-audio';
COMMENT ON COLUMN public.ai_token_usage.total_cost IS 'Total cost in USD for this API call';
```

### 1.2 RLS Policies for Admin Access

Enable admins to bypass RLS restrictions for read-only access.

```sql
-- ============================================================================
-- ADMIN RLS POLICIES
-- ============================================================================

-- Helper function: Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();

  RETURN user_role IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin can view all users
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (is_admin());

-- Admin can view all projects
CREATE POLICY "Admins can view all projects"
ON public.projects
FOR SELECT
USING (is_admin());

-- Admin can view all ideas
CREATE POLICY "Admins can view all ideas"
ON public.ideas
FOR SELECT
USING (is_admin());

-- Admin can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.subscriptions
FOR SELECT
USING (is_admin());

-- Admin can view all usage tracking
CREATE POLICY "Admins can view all usage tracking"
ON public.usage_tracking
FOR SELECT
USING (is_admin());

-- Enable RLS on ai_token_usage
ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own token usage
CREATE POLICY "Users can view their own token usage"
ON public.ai_token_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Backend can insert token usage (service role)
CREATE POLICY "Service role can insert token usage"
ON public.ai_token_usage
FOR INSERT
WITH CHECK (true); -- Only service role can insert

-- Admins can view all token usage
CREATE POLICY "Admins can view all token usage"
ON public.ai_token_usage
FOR SELECT
USING (is_admin());
```

### 1.3 Materialized Views for Performance

Pre-aggregate common admin queries for dashboard performance.

```sql
-- ============================================================================
-- ADMIN ANALYTICS MATERIALIZED VIEWS
-- ============================================================================

-- User Statistics Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS public.admin_user_stats AS
SELECT
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.created_at as join_date,
  u.last_login,
  s.tier as subscription_tier,
  s.status as subscription_status,

  -- Project counts
  COALESCE(p.project_count, 0) as project_count,

  -- Idea counts
  COALESCE(i.idea_count, 0) as idea_count,

  -- Usage counts (current month)
  COALESCE(ut_ai.ai_usage, 0) as monthly_ai_usage,
  COALESCE(ut_export.export_usage, 0) as monthly_export_usage,

  -- Token usage (all time)
  COALESCE(tokens.total_tokens, 0) as total_tokens_used,
  COALESCE(tokens.total_cost, 0) as total_cost_usd,

  -- Token usage (current month)
  COALESCE(tokens_month.monthly_tokens, 0) as monthly_tokens,
  COALESCE(tokens_month.monthly_cost, 0) as monthly_cost_usd

FROM public.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
LEFT JOIN (
  SELECT owner_id, COUNT(*) as project_count
  FROM public.projects
  GROUP BY owner_id
) p ON p.owner_id = u.id
LEFT JOIN (
  SELECT created_by, COUNT(*) as idea_count
  FROM public.ideas
  GROUP BY created_by
) i ON i.created_by = u.id
LEFT JOIN (
  SELECT user_id, SUM(count) as ai_usage
  FROM public.usage_tracking
  WHERE resource_type = 'ai_idea'
    AND period_start >= date_trunc('month', NOW())
  GROUP BY user_id
) ut_ai ON ut_ai.user_id = u.id
LEFT JOIN (
  SELECT user_id, SUM(count) as export_usage
  FROM public.usage_tracking
  WHERE resource_type = 'export'
    AND period_start >= date_trunc('month', NOW())
  GROUP BY user_id
) ut_export ON ut_export.user_id = u.id
LEFT JOIN (
  SELECT user_id, SUM(total_tokens) as total_tokens, SUM(total_cost) as total_cost
  FROM public.ai_token_usage
  GROUP BY user_id
) tokens ON tokens.user_id = u.id
LEFT JOIN (
  SELECT user_id, SUM(total_tokens) as monthly_tokens, SUM(total_cost) as monthly_cost
  FROM public.ai_token_usage
  WHERE created_at >= date_trunc('month', NOW())
  GROUP BY user_id
) tokens_month ON tokens_month.user_id = u.id;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_admin_user_stats_id ON public.admin_user_stats(id);
CREATE INDEX idx_admin_user_stats_tier ON public.admin_user_stats(subscription_tier);
CREATE INDEX idx_admin_user_stats_cost ON public.admin_user_stats(total_cost_usd DESC);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_admin_user_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.admin_user_stats;
END;
$$ LANGUAGE plpgsql;

-- Auto-refresh every hour
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('refresh-admin-stats', '0 * * * *', 'SELECT refresh_admin_user_stats()');
```

---

## 2. Backend API Modifications

### 2.1 Token Tracking Integration

Modify `api/ai.ts` to track token usage after each OpenAI API call.

```typescript
// api/ai.ts - Add after OpenAI API call

/**
 * Track OpenAI token usage and cost
 */
async function trackTokenUsage(
  userId: string,
  projectId: string | null,
  endpoint: string,
  model: string,
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  },
  responseTimeMs: number,
  success: boolean = true,
  errorMessage?: string
) {
  try {
    // Calculate costs based on model
    const costs = getModelCosts(model)
    const inputCost = (usage.prompt_tokens / 1000000) * costs.input
    const outputCost = (usage.completion_tokens / 1000000) * costs.output
    const totalCost = inputCost + outputCost

    // Insert into ai_token_usage table (using service role client)
    const { error } = await supabaseAdmin
      .from('ai_token_usage')
      .insert({
        user_id: userId,
        project_id: projectId,
        endpoint,
        model,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        input_cost: inputCost,
        output_cost: outputCost,
        total_cost: totalCost,
        response_time_ms: responseTimeMs,
        success,
        error_message: errorMessage
      })

    if (error) {
      console.error('Failed to track token usage:', error)
    }
  } catch (error) {
    console.error('Token tracking error:', error)
    // Don't throw - tracking failures shouldn't break user flow
  }
}

// Model cost mapping (from openaiModelRouter.ts)
function getModelCosts(model: string): { input: number; output: number } {
  const costs: Record<string, { input: number; output: number }> = {
    'gpt-5': { input: 1.25, output: 10.00 },
    'gpt-5-mini': { input: 0.08, output: 0.30 },
    'gpt-5-nano': { input: 0.04, output: 0.15 },
    'gpt-5-chat-latest': { input: 1.25, output: 10.00 },
    'o1-preview': { input: 15.00, output: 60.00 },
    'o1-mini': { input: 3.00, output: 12.00 },
    'o3-deep-research': { input: 20.00, output: 80.00 },
    'o4-mini-deep-research': { input: 8.00, output: 32.00 },
    'gpt-realtime': { input: 6.00, output: 18.00 }
  }
  return costs[model] || { input: 0, output: 0 }
}

// Example usage in handleGenerateIdeas:
const startTime = Date.now()
const response = await fetch('https://api.openai.com/v1/chat/completions', {...})
const responseTimeMs = Date.now() - startTime
const data = await response.json()

// Track token usage
await trackTokenUsage(
  userId,
  req.body.projectId || null,
  'generate-ideas',
  selectedModel,
  data.usage, // { prompt_tokens, completion_tokens, total_tokens }
  responseTimeMs
)
```

### 2.2 Admin Repository

Create `src/lib/repositories/adminRepository.ts` for admin-specific queries.

```typescript
import { supabase } from '../supabase'
import { logger } from '../../utils/logger'

export interface AdminUserStats {
  id: string
  email: string
  full_name: string | null
  role: string
  join_date: string
  last_login: string | null
  subscription_tier: string
  subscription_status: string
  project_count: number
  idea_count: number
  monthly_ai_usage: number
  monthly_export_usage: number
  total_tokens_used: number
  total_cost_usd: number
  monthly_tokens: number
  monthly_cost_usd: number
}

export interface AdminDashboardStats {
  totalUsers: number
  activeUsers30d: number
  freeUsers: number
  teamUsers: number
  enterpriseUsers: number
  totalProjects: number
  totalIdeas: number
  monthlyAICalls: number
  monthlyTokens: number
  monthlyRevenue: number
  monthlyAPIcost: number
}

export interface TokenUsageByDay {
  date: string
  tokens: number
  cost: number
  calls: number
}

export class AdminRepository {
  /**
   * Get all users with comprehensive stats (from materialized view)
   */
  static async getAllUserStats(): Promise<AdminUserStats[]> {
    try {
      const { data, error } = await supabase
        .from('admin_user_stats')
        .select('*')
        .order('join_date', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Failed to get user stats:', error)
      return []
    }
  }

  /**
   * Get dashboard summary statistics
   */
  static async getDashboardStats(): Promise<AdminDashboardStats> {
    try {
      // Total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // Active users (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { count: activeUsers30d } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('last_login', thirtyDaysAgo.toISOString())

      // Subscription tiers
      const { data: tiers } = await supabase
        .from('subscriptions')
        .select('tier')

      const tierCounts = tiers?.reduce((acc, { tier }) => {
        acc[tier] = (acc[tier] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      // Total projects and ideas
      const { count: totalProjects } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })

      const { count: totalIdeas } = await supabase
        .from('ideas')
        .select('*', { count: 'exact', head: true })

      // Monthly metrics
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const { data: monthlyUsage } = await supabase
        .from('usage_tracking')
        .select('resource_type, count')
        .gte('period_start', monthStart.toISOString())

      const monthlyAICalls = monthlyUsage
        ?.filter(u => u.resource_type === 'ai_idea')
        .reduce((sum, u) => sum + u.count, 0) || 0

      // Monthly token costs
      const { data: monthlyTokenData } = await supabase
        .from('ai_token_usage')
        .select('total_tokens, total_cost')
        .gte('created_at', monthStart.toISOString())

      const monthlyTokens = monthlyTokenData?.reduce((sum, t) => sum + t.total_tokens, 0) || 0
      const monthlyAPIcost = monthlyTokenData?.reduce((sum, t) => sum + t.total_cost, 0) || 0

      // Monthly revenue (placeholder - integrate with Stripe later)
      const monthlyRevenue = 0

      return {
        totalUsers: totalUsers || 0,
        activeUsers30d: activeUsers30d || 0,
        freeUsers: tierCounts.free || 0,
        teamUsers: tierCounts.team || 0,
        enterpriseUsers: tierCounts.enterprise || 0,
        totalProjects: totalProjects || 0,
        totalIdeas: totalIdeas || 0,
        monthlyAICalls,
        monthlyTokens,
        monthlyRevenue,
        monthlyAPIcost
      }
    } catch (error) {
      logger.error('Failed to get dashboard stats:', error)
      throw error
    }
  }

  /**
   * Get token usage by day (last 30 days)
   */
  static async getTokenUsageByDay(days: number = 30): Promise<TokenUsageByDay[]> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data, error } = await supabase
        .from('ai_token_usage')
        .select('created_at, total_tokens, total_cost')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      // Group by day
      const byDay = (data || []).reduce((acc, item) => {
        const date = new Date(item.created_at).toISOString().split('T')[0]
        if (!acc[date]) {
          acc[date] = { date, tokens: 0, cost: 0, calls: 0 }
        }
        acc[date].tokens += item.total_tokens
        acc[date].cost += item.total_cost
        acc[date].calls += 1
        return acc
      }, {} as Record<string, TokenUsageByDay>)

      return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
    } catch (error) {
      logger.error('Failed to get token usage by day:', error)
      return []
    }
  }

  /**
   * Get all projects across all users (admin view)
   */
  static async getAllProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          owner:users!owner_id(id, email, full_name),
          idea_count:ideas(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Failed to get all projects:', error)
      return []
    }
  }

  /**
   * Search users with filters
   */
  static async searchUsers(filters: {
    query?: string
    tier?: string
    role?: string
    minCost?: number
  }) {
    try {
      let query = supabase
        .from('admin_user_stats')
        .select('*')

      if (filters.query) {
        query = query.or(`email.ilike.%${filters.query}%,full_name.ilike.%${filters.query}%`)
      }

      if (filters.tier) {
        query = query.eq('subscription_tier', filters.tier)
      }

      if (filters.role) {
        query = query.eq('role', filters.role)
      }

      if (filters.minCost) {
        query = query.gte('total_cost_usd', filters.minCost)
      }

      const { data, error } = await query.order('total_cost_usd', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Failed to search users:', error)
      return []
    }
  }
}
```

---

## 3. Frontend UI Components

### 3.1 Admin Route Structure

```
src/
├── components/
│   └── admin/
│       ├── AdminLayout.tsx          # Layout wrapper with sidebar
│       ├── AdminDashboard.tsx       # Main dashboard with key metrics
│       ├── AdminUsers.tsx           # User management table
│       ├── AdminUserDetail.tsx      # Individual user detail view
│       ├── AdminProjects.tsx        # All projects view
│       ├── AdminAnalytics.tsx       # Usage analytics & graphs
│       ├── AdminTokenSpend.tsx      # Token spend tracking & charts
│       ├── FAQAdmin.tsx             # FAQ management (already exists)
│       └── AdminSettings.tsx        # Admin configuration
└── components/
    └── pages/
        └── PageRouter.tsx           # Add admin routes
```

### 3.2 Admin Layout Component

```tsx
// src/components/admin/AdminLayout.tsx

import React from 'react'
import { Navigate, Link, useLocation } from 'react-router-dom'
import { UserRepository } from '../../lib/repositories/userRepository'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  BarChart3,
  DollarSign,
  HelpCircle,
  Settings
} from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null)
  const location = useLocation()

  React.useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    const user = await UserRepository.getCurrentUser()
    if (!user) {
      setIsAdmin(false)
      return
    }
    const adminStatus = await UserRepository.isUserAdmin(user.id)
    setIsAdmin(adminStatus)
  }

  if (isAdmin === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (isAdmin === false) {
    return <Navigate to="/" replace />
  }

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/users', icon: Users, label: 'Users' },
    { path: '/admin/projects', icon: FolderKanban, label: 'Projects' },
    { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/admin/tokens', icon: DollarSign, label: 'Token Spend' },
    { path: '/admin/faq', icon: HelpCircle, label: 'FAQ' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' }
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
          <p className="text-sm text-gray-500">Prioritas</p>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

### 3.3 Admin Dashboard Component

```tsx
// src/components/admin/AdminDashboard.tsx

import React from 'react'
import { AdminRepository, AdminDashboardStats } from '../../lib/repositories/adminRepository'
import { Users, FolderKanban, Lightbulb, DollarSign, TrendingUp, Cpu } from 'lucide-react'

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = React.useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    loadDashboardStats()
  }, [])

  const loadDashboardStats = async () => {
    try {
      const data = await AdminRepository.getDashboardStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to load dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>
  }

  if (!stats) {
    return <div className="p-8">Failed to load dashboard</div>
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      subtitle: `${stats.activeUsers30d} active (30d)`,
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Total Projects',
      value: stats.totalProjects.toLocaleString(),
      subtitle: `${stats.totalIdeas.toLocaleString()} ideas`,
      icon: FolderKanban,
      color: 'green'
    },
    {
      title: 'Monthly AI Calls',
      value: stats.monthlyAICalls.toLocaleString(),
      subtitle: `${stats.monthlyTokens.toLocaleString()} tokens`,
      icon: Cpu,
      color: 'purple'
    },
    {
      title: 'Monthly API Cost',
      value: `$${stats.monthlyAPIcost.toFixed(2)}`,
      subtitle: `Revenue: $${stats.monthlyRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'orange'
    }
  ]

  const tierStats = [
    { name: 'Free', count: stats.freeUsers, color: 'gray' },
    { name: 'Team', count: stats.teamUsers, color: 'blue' },
    { name: 'Enterprise', count: stats.enterpriseUsers, color: 'purple' }
  ]

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.title} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-${stat.color}-50`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Subscription Tiers */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription Tiers</h2>
        <div className="space-y-3">
          {tierStats.map((tier) => (
            <div key={tier.name} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{tier.name}</span>
              <div className="flex items-center gap-3">
                <div className="w-48 bg-gray-200 rounded-full h-2">
                  <div
                    className={`bg-${tier.color}-500 h-2 rounded-full`}
                    style={{
                      width: `${(tier.count / stats.totalUsers) * 100}%`
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                  {tier.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickLinkCard
          title="User Management"
          description="View and manage all users"
          href="/admin/users"
        />
        <QuickLinkCard
          title="Token Analytics"
          description="Track AI token spend and usage"
          href="/admin/tokens"
        />
        <QuickLinkCard
          title="FAQ Management"
          description="Update help documentation"
          href="/admin/faq"
        />
      </div>
    </div>
  )
}

const QuickLinkCard: React.FC<{ title: string; description: string; href: string }> = ({
  title,
  description,
  href
}) => (
  <a
    href={href}
    className="block p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
  >
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-sm text-gray-600">{description}</p>
  </a>
)
```

---

## 4. Implementation Roadmap

### Phase 1: Database & Backend (2-3 days)

**Goals**: Create foundation for token tracking and admin queries

1. **Database Schema** (1 day)
   - Create `ai_token_usage` table
   - Add admin RLS policies with `is_admin()` function
   - Create `admin_user_stats` materialized view
   - Test RLS policies with admin and non-admin users

2. **Token Tracking Integration** (1 day)
   - Modify `api/ai.ts` to capture OpenAI token usage
   - Implement `trackTokenUsage()` function
   - Test with all AI endpoints (ideas, insights, roadmap, etc.)
   - Verify token costs are calculated correctly

3. **Admin Repository** (0.5 days)
   - Create `adminRepository.ts` with core queries
   - Implement `getDashboardStats()`, `getAllUserStats()`, `getTokenUsageByDay()`
   - Add unit tests for admin queries

### Phase 2: Admin UI Foundation (2-3 days)

**Goals**: Build admin layout and dashboard

1. **Admin Layout** (1 day)
   - Create `AdminLayout.tsx` with sidebar navigation
   - Add admin access check using `isUserAdmin()`
   - Integrate into `PageRouter.tsx`
   - Style sidebar with Tailwind

2. **Admin Dashboard** (1 day)
   - Create `AdminDashboard.tsx` with stat cards
   - Display user counts, project counts, token metrics
   - Add subscription tier breakdown
   - Implement quick links to other admin pages

3. **Admin Button in Main App** (0.5 days)
   - Add conditional admin button to main navigation
   - Only visible to admin/super_admin users
   - Link to `/admin` route

### Phase 3: User Management (2 days)

**Goals**: Complete user administration interface

1. **User List Table** (1 day)
   - Create `AdminUsers.tsx` with TanStack Table
   - Display all users from `admin_user_stats`
   - Add search, filter, sort capabilities
   - Show key metrics: tier, usage, cost

2. **User Detail Page** (1 day)
   - Create `AdminUserDetail.tsx`
   - Display comprehensive user info
   - Show project list, usage history, token spend over time
   - Add actions: Change role, view as user, etc.

### Phase 4: Analytics & Token Tracking (2-3 days)

**Goals**: Build comprehensive analytics dashboard

1. **Usage Analytics** (1 day)
   - Create `AdminAnalytics.tsx`
   - Add Recharts/Tremor for visualizations
   - Display DAU/MAU trends, feature usage, retention metrics
   - Show user growth over time

2. **Token Spend Dashboard** (1 day)
   - Create `AdminTokenSpend.tsx`
   - Display token usage by day (line chart)
   - Show cost by endpoint (pie chart)
   - Add top users by cost (bar chart)
   - Display cost trends and projections

3. **Project Visibility** (1 day)
   - Create `AdminProjects.tsx`
   - Display all projects across all users
   - Add search, filter by owner, activity status
   - Show idea count, last activity, owner info

### Phase 5: Polish & Testing (1-2 days)

**Goals**: Production readiness

1. **FAQ Admin Integration** (0.5 days)
   - Ensure existing `FAQAdmin.tsx` integrates with admin layout
   - Test CRUD operations

2. **E2E Testing** (1 day)
   - Create Playwright tests for admin flows
   - Test admin access control (non-admin can't access)
   - Test dashboard data accuracy
   - Test user search and filtering

3. **Documentation** (0.5 days)
   - Create admin user guide
   - Document RLS policies and security model
   - Add deployment checklist

---

## 5. Security Considerations

### 5.1 Access Control

- **Admin Role Check**: All admin routes protected by `isUserAdmin()` check
- **RLS Enforcement**: Admin policies use SECURITY DEFINER function
- **No Client-Side Admin Operations**: All admin writes go through service role
- **Audit Logging**: Consider adding admin_audit_log table for tracking admin actions

### 5.2 Token Tracking Security

- **Service Role Only**: Token insertion uses service role (backend only)
- **No User Modification**: Users can view their own token usage, not modify
- **Cost Protection**: Token costs calculated server-side, never from client

### 5.3 Data Privacy

- **Email Privacy**: Consider masking emails in some admin views
- **Project Content**: Admins can see project names, not idea content (unless necessary)
- **Usage Anonymization**: Option to anonymize usage data for analytics

---

## 6. Technology Stack

### Frontend
- **React 18.2.0** - UI framework (existing)
- **TypeScript 5.2.2** - Type safety (existing)
- **TanStack Table v8** - User/project tables with sorting, filtering
- **Recharts** - Charts and graphs (lightweight, good for admin dashboards)
- **Lucide React** - Icons (existing)
- **Tailwind CSS** - Styling (existing)

### Backend
- **Supabase** - Database, RLS, auth (existing)
- **Vercel Edge Functions** - API endpoints (existing)
- **PostgreSQL** - Database with materialized views for performance

### Optional Enhancements
- **Tremor** - Pre-built dashboard components (alternative to Recharts)
- **AG Grid** - Advanced table features (if TanStack Table insufficient)
- **PostgreSQL pg_cron** - Auto-refresh materialized views

---

## 7. Next Steps

1. **Approve Specification**: Review and approve this spec
2. **Prioritize Phases**: Confirm phase order or adjust priorities
3. **Begin Implementation**: Start with Phase 1 (Database & Backend)
4. **Iterative Development**: Build incrementally, test each phase
5. **Production Deployment**: Deploy with feature flag for gradual rollout

---

## Appendix A: SQL Migration File

Complete migration file for Phase 1:

```sql
-- File: supabase/migrations/20250113_create_admin_system.sql
-- Run this to set up admin system database components

-- See sections 1.1, 1.2, 1.3 above for full SQL
```

---

## Appendix B: Sample Admin User

```sql
-- Create sample admin user for testing
UPDATE public.users
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

---

**End of Specification**
