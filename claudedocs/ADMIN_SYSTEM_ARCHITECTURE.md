# Admin System Architecture Design

## Executive Summary

This document outlines the comprehensive architecture for implementing admin functionality that can securely bypass Row Level Security (RLS) policies while maintaining system security and multi-tenancy principles. The solution involves service role escalation, secure admin detection, and specialized query patterns.

## Current State Analysis

### Authentication Architecture
- **Frontend**: Supabase client with anonymous key (VITE_SUPABASE_ANON_KEY)
- **Backend**: Role-based authentication with server-side validation
- **RLS Policies**: Restrictive policies preventing cross-user data access
- **Role System**: `user | admin | super_admin` hierarchy with email-based detection

### Current Barriers
1. **RLS Enforcement**: All database queries filtered by `auth.uid()`
2. **Anonymous Key Limitations**: Frontend client cannot access service role privileges
3. **No Admin Bypass**: No mechanism to elevate privileges for legitimate admin operations
4. **State Management**: Admin interface blocked by authentication middleware

## Proposed Architecture

### 1. Admin Authentication Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Admin User     │    │  Frontend Auth   │    │  Backend API    │
│  Login          │───▶│  (Anonymous Key) │───▶│  (Role Check)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Admin Portal   │◄───│  Service Role    │◄───│  Privilege      │
│  Access         │    │  Escalation      │    │  Escalation     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

#### Key Components:
- **Role Detection**: Server-side email-based role validation
- **Service Role Client**: Backend-only Supabase client with service role key
- **Admin API Endpoints**: Dedicated endpoints with RLS bypass capability
- **Frontend State**: Admin-aware authentication context

### 2. Service Role Architecture

#### Service Role Configuration
```typescript
// Backend only - never exposed to client
const adminSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // High privilege key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    db: {
      schema: 'public'
    }
  }
)
```

#### Admin Detection System
```typescript
// Server-side role validation
const ADMIN_EMAILS = new Set([
  'admin@prioritas.com',
  'manager@company.com'
])

const SUPER_ADMIN_EMAILS = new Set([
  'admin@prioritas.com'
])

function isAdminUser(userEmail: string): boolean {
  return ADMIN_EMAILS.has(userEmail.toLowerCase()) ||
         SUPER_ADMIN_EMAILS.has(userEmail.toLowerCase())
}
```

### 3. Database Query Patterns

#### RLS Bypass for Admin Operations
```sql
-- Option 1: Admin-specific policies
CREATE POLICY "admin_full_access" ON projects
    FOR ALL
    TO service_role
    USING (true);

-- Option 2: Role-based bypass
CREATE POLICY "admin_override_projects" ON projects
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT auth.uid() FROM auth.users
            WHERE email = ANY(ARRAY['admin@prioritas.com', 'manager@company.com'])
        )
        OR auth.role() = 'service_role'
    );
```

#### Admin Query Implementation
```typescript
// Admin service with privilege escalation
class AdminDatabaseService {
  private static adminClient = createClient(/* service role config */)

  // Bypass RLS for admin operations
  static async getAllProjects(): Promise<Project[]> {
    const { data, error } = await this.adminClient
      .from('projects')
      .select(`
        *,
        owner:user_profiles!projects_owner_id_fkey(*)
      `)
      .order('updated_at', { ascending: false })

    return data || []
  }

  // Cross-user project access
  static async getProjectWithCollaborators(projectId: string) {
    const { data, error } = await this.adminClient
      .from('projects')
      .select(`
        *,
        ideas(*),
        collaborators:project_collaborators(
          *,
          user:user_profiles(*)
        ),
        owner:user_profiles!projects_owner_id_fkey(*)
      `)
      .eq('id', projectId)
      .single()

    return data
  }
}
```

### 4. API Architecture

#### Admin Middleware
```typescript
// Admin authentication middleware
export function requireAdminRole() {
  return async (req: VercelRequest, res: VercelResponse, next: () => void) => {
    const { user, error } = await authenticate(req)
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const profile = await getUserProfile(user.id, user.email || '')
    if (!isAdminUser(profile.email)) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Add admin context to request
    (req as any).adminUser = profile
    (req as any).isServiceRole = true
    next()
  }
}
```

#### Admin API Endpoints
```
/api/admin/users              - GET: List all users with pagination
/api/admin/users/:id          - PUT: Update user role/status
/api/admin/projects           - GET: List all projects cross-user
/api/admin/projects/:id       - GET/PUT/DELETE: Manage any project
/api/admin/projects/:id/ideas - GET: View all ideas in project
/api/admin/analytics          - GET: Platform-wide analytics
/api/admin/system             - GET: System health and metrics
```

### 5. Frontend Integration

#### Admin Context Provider
```typescript
interface AdminContextType {
  isAdmin: boolean
  isSuperAdmin: boolean
  adminCapabilities: AdminCapability[]
  switchToAdminMode: () => Promise<void>
  switchToUserMode: () => void
}

const AdminContext = createContext<AdminContextType | null>(null)
```

#### Admin State Management
```typescript
// Enhanced useAuth hook with admin detection
export const useAuth = (options: UseAuthOptions = {}) => {
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [adminCapabilities, setAdminCapabilities] = useState<AdminCapability[]>([])

  const switchToAdminMode = async () => {
    if (AdminService.isAdmin(currentUser)) {
      setIsAdminMode(true)
      // Initialize admin-specific API clients
      await initializeAdminServices()
    }
  }
}
```

## Security Model

### 1. Multi-Layer Authentication
- **Layer 1**: Standard user authentication (anonymous key)
- **Layer 2**: Admin role verification (server-side)
- **Layer 3**: Service role escalation (backend only)
- **Layer 4**: Operation-specific validation

### 2. Privilege Escalation Controls
- **Email Whitelist**: Hard-coded admin emails in server environment
- **Service Role Isolation**: High-privilege key never exposed to client
- **Audit Logging**: All admin operations logged with user context
- **Time-based Sessions**: Admin mode expires after inactivity

### 3. Data Isolation
- **Read Operations**: Admin can view all data with full context
- **Write Operations**: Preserve ownership and audit trails
- **User Impersonation**: Controlled user context switching
- **Data Export**: Secure bulk data operations

## Development vs Production Strategy

### Development Environment
```typescript
// Development admin accounts
const DEV_ADMIN_EMAILS = [
  'admin@prioritas.com',
  'dev@localhost',
  'test@example.com'
]

// Relaxed validation for development
const isDevelopment = process.env.NODE_ENV === 'development'
```

### Production Environment
```typescript
// Production admin accounts (environment variables)
const PROD_ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(',') || [
  'admin@prioritas.com'
]

// Strict validation and audit logging
const requireMFA = process.env.NODE_ENV === 'production'
```

### Account Management Strategy
1. **Development**: Flexible email-based admin detection
2. **Staging**: Mirror production with test admin accounts
3. **Production**:
   - Environment variable driven admin lists
   - MFA requirements for admin operations
   - Comprehensive audit logging
   - Regular access reviews

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
- [ ] Service role client setup
- [ ] Admin middleware implementation
- [ ] Basic admin API endpoints
- [ ] Admin role detection system

### Phase 2: Database Integration (Week 2)
- [ ] RLS policy modifications for admin bypass
- [ ] Admin-specific query patterns
- [ ] Cross-user data access methods
- [ ] Audit logging implementation

### Phase 3: Frontend Integration (Week 3)
- [ ] Admin context provider
- [ ] Enhanced authentication flow
- [ ] Admin mode state management
- [ ] Admin interface components

### Phase 4: Security & Testing (Week 4)
- [ ] Security testing and validation
- [ ] Performance optimization
- [ ] Production deployment preparation
- [ ] Documentation and training

## Risk Assessment & Mitigation

### High-Risk Areas
1. **Service Role Key Exposure**: Mitigated by backend-only usage
2. **Privilege Escalation**: Controlled by email whitelist and middleware
3. **Data Leakage**: Audit logging and access controls
4. **Performance Impact**: Optimized queries and caching

### Security Controls
- Environment-based admin configuration
- Server-side role validation only
- Comprehensive audit trails
- Regular security reviews
- Principle of least privilege

## Monitoring & Observability

### Admin Activity Monitoring
- All admin operations logged with user context
- Real-time alerts for unusual admin activity
- Regular access reviews and role audits
- Performance metrics for admin operations

### Health Checks
- Service role connectivity validation
- Admin endpoint health monitoring
- Database policy verification
- Authentication flow validation

This architecture provides a secure, scalable foundation for admin functionality while maintaining the integrity of the multi-tenant system and existing security model.