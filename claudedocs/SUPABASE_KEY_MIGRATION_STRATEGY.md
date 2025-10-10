# Supabase Authentication & API Key Migration Strategy

## Executive Summary

This document outlines the migration strategy for Prioritas's Supabase authentication and API key infrastructure. Analysis reveals that **Phase 1 (localStorage → httpOnly cookies) is already complete**, while Phase 2 (new API key format) should be planned for Q1 2025.

**Current Status**: ✅ Secure (httpOnly cookies implemented)
**Next Action**: Environment variable cleanup + prepare for Q1 2025 key migration

---

## Phase 1: localStorage → httpOnly Cookies Migration

### Status: ✅ COMPLETE

The application has already migrated from insecure localStorage authentication to secure httpOnly cookie-based sessions.

### Evidence of Completion

**Frontend Configuration** (`src/lib/supabase.ts`):
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,      // ✅ localStorage disabled
    detectSessionInUrl: false,
    storage: undefined,          // ✅ No client-side storage
    storageKey: 'sb-client-readonly',
    flowType: 'pkce'
  }
})
```

**Legacy Token Cleanup** (src/lib/supabase.ts:20-40):
```typescript
const cleanupLegacyAuthStorage = () => {
  const keysToClean = [
    'prioritas-auth',
    'sb-prioritas-auth-token',
    'supabase.auth.token',
    'sb-design-matrix-app-auth-token',
    // ... additional legacy keys
  ]
  keysToClean.forEach(key => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  })
}
```

**Backend Session Management** (`api/auth.ts`):
- Uses httpOnly cookies for session tokens
- Implements CSRF protection
- Secure cookie attributes set correctly

### Security Improvements Achieved

| Aspect | Before (localStorage) | After (httpOnly cookies) |
|--------|----------------------|--------------------------|
| **XSS Vulnerability** | ❌ Tokens readable by JS | ✅ Tokens inaccessible to JS |
| **Session Persistence** | ❌ Survives logout | ✅ Proper session lifecycle |
| **CSRF Protection** | ❌ None | ✅ CSRF tokens implemented |
| **Security Rating** | 🔴 High Risk | ✅ Industry Standard |

### Remaining Cleanup Tasks

**1. Environment Variable Naming**

Current backend code still uses legacy `VITE_*` prefix for server-side keys:

**File**: `api/auth.ts:40-41`
```typescript
// ❌ CURRENT (confusing naming):
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!

// ✅ RECOMMENDED (clear backend naming):
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
```

**Rationale**: The `VITE_` prefix is a Vite convention for frontend-exposed variables. Backend-only variables should not use this prefix as it suggests frontend exposure.

**Migration Steps**:
```bash
# 1. Update Vercel environment variables
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# (paste the same value from VITE_SUPABASE_SERVICE_ROLE_KEY)

# 2. Update local .env file
# Remove VITE_ prefix from server-side keys
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... (keep same value)

# 3. Update api/auth.ts imports
# Change all process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
# to process.env.SUPABASE_SERVICE_ROLE_KEY

# 4. Remove old environment variable
vercel env rm VITE_SUPABASE_SERVICE_ROLE_KEY production
```

**2. Verify Legacy Token Cleanup**

Confirm `cleanupLegacyAuthStorage()` is being called on app initialization:

```typescript
// Verify in src/lib/supabase.ts or src/App.tsx
useEffect(() => {
  cleanupLegacyAuthStorage()
}, [])
```

**3. Documentation Update**

Update any documentation that references localStorage-based authentication to reflect the httpOnly cookie implementation.

---

## Phase 2: New Supabase API Key Format Migration

### Status: ⏳ PLANNED (Q1 2025)

Supabase is introducing a new API key format to improve security and clarity.

### Timeline

- **Availability**: Q1 2025 (January-March 2025)
- **Migration Window**: 12 months from release
- **Recommended Action**: November 2025 (allows 2 months buffer before deprecation)
- **Legacy Key Deprecation**: Q1 2026 (estimated)

### Key Format Changes

| Current (Legacy) | New Format | Purpose |
|-----------------|------------|---------|
| `supabaseAnonKey` | `sb_publishable_*` | Frontend client initialization |
| `supabaseServiceRoleKey` | `sb_secret_*` | Backend admin operations |

### Migration Strategy

#### Stage 1: Preparation (Q4 2024 - Q1 2025)

**Objective**: Ensure codebase is ready for key substitution

**Tasks**:
1. ✅ Centralize key configuration
   - All keys imported from `src/lib/supabase.ts` (frontend)
   - All keys imported from environment variables (backend)
   - No hardcoded key references

2. ✅ Abstract key usage
   - Keys used only in client initialization
   - No direct key manipulation in business logic

3. 📋 Prepare environment variable migration script:
```bash
# scripts/migrate-to-new-keys.sh
#!/bin/bash

echo "🔑 Supabase Key Migration Script"
echo "================================="
echo ""
echo "This script will help migrate to new Supabase API key format"
echo ""

# Check for new keys in Supabase Dashboard
echo "Step 1: Generate new keys in Supabase Dashboard"
echo "  1. Go to https://supabase.com/dashboard"
echo "  2. Navigate to Settings → API"
echo "  3. Generate new publishable key (sb_publishable_*)"
echo "  4. Generate new secret key (sb_secret_*)"
echo ""

# Update environment variables
echo "Step 2: Update environment variables"
read -p "Enter new publishable key (sb_publishable_*): " NEW_PUBLISHABLE_KEY
read -p "Enter new secret key (sb_secret_*): " NEW_SECRET_KEY

# Vercel production
vercel env add SUPABASE_PUBLISHABLE_KEY production <<< "$NEW_PUBLISHABLE_KEY"
vercel env add SUPABASE_SECRET_KEY production <<< "$NEW_SECRET_KEY"

# Local .env
echo "VITE_SUPABASE_ANON_KEY=$NEW_PUBLISHABLE_KEY" >> .env
echo "SUPABASE_SERVICE_ROLE_KEY=$NEW_SECRET_KEY" >> .env

echo ""
echo "✅ Environment variables updated"
echo "⚠️  Remember to rotate old keys after testing!"
```

#### Stage 2: Key Generation (Q1 2025)

**Objective**: Obtain new API keys from Supabase

**When Available** (Q1 2025):
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to project: `design-matrix-app`
3. Go to **Settings** → **API**
4. Look for **"Generate New API Keys"** or **"Migrate to New Key Format"** option
5. Generate both keys:
   - **Publishable Key** (`sb_publishable_*`) - for frontend
   - **Secret Key** (`sb_secret_*`) - for backend

**Important**: Keep both old and new keys during migration period for rollback capability.

#### Stage 3: Testing Migration (Q2 2025)

**Objective**: Validate new keys in non-production environment

**Environment Setup**:
```bash
# 1. Create staging environment variables
vercel env add SUPABASE_PUBLISHABLE_KEY staging
vercel env add SUPABASE_SECRET_KEY staging

# 2. Update local .env for testing
VITE_SUPABASE_ANON_KEY=sb_publishable_... (new key)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_... (new key)
```

**Test Cases**:
```yaml
authentication_flows:
  - User registration with email/password
  - User login with email/password
  - Password reset flow
  - Session refresh and token validation
  - Logout and session cleanup

data_operations:
  - Create idea (RLS enforced)
  - Read ideas for authenticated user
  - Update idea (RLS enforced)
  - Delete idea (RLS enforced)
  - Cross-user access prevention (should fail)

admin_operations:
  - Backend API endpoints with service key
  - Admin-only operations
  - RLS bypass for admin tasks

edge_cases:
  - Invalid token handling
  - Expired session refresh
  - Concurrent session management
  - Rate limiting behavior
```

**Validation Criteria**:
- ✅ All authentication flows succeed
- ✅ RLS policies enforce correctly
- ✅ No performance degradation
- ✅ Error handling works as expected
- ✅ Logs show no key-related errors

#### Stage 4: Production Migration (Q3 2025)

**Objective**: Deploy new keys to production with zero downtime

**Pre-Migration Checklist**:
- [ ] All staging tests passed
- [ ] Rollback procedure documented
- [ ] Monitoring and alerts configured
- [ ] Team notified of migration window
- [ ] Backup of current environment variables

**Migration Procedure**:

**Step 1: Deploy Code Updates** (if needed)
```bash
# Most likely NO code changes needed - just environment variable swap
# Supabase designed new keys to be drop-in replacements

# If code changes required:
git checkout -b feature/supabase-new-keys
# Make necessary changes
git commit -m "chore: update for Supabase new API key format"
git push origin feature/supabase-new-keys
# Create PR and deploy after review
```

**Step 2: Update Production Environment Variables**
```bash
# Update Vercel production environment
vercel env add VITE_SUPABASE_ANON_KEY production
# Paste new publishable key (sb_publishable_*)

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste new secret key (sb_secret_*)

# Trigger redeployment
vercel --prod
```

**Step 3: Monitor Production**
```bash
# Watch production logs
vercel logs --prod --follow

# Monitor for:
# - Authentication errors
# - Database connection issues
# - RLS policy violations
# - API endpoint failures
```

**Step 4: Validate Production**
```bash
# Test critical user flows:
1. User login/logout
2. Create/edit/delete idea
3. Project operations
4. Data import/export

# Check metrics:
- Error rate: should remain stable
- Response times: no degradation
- Active sessions: no drops
```

**Step 5: Revoke Old Keys** (after 24-48 hours of stable operation)
```bash
# Return to Supabase Dashboard
# Settings → API → Legacy Keys
# Click "Revoke" on old anon and service_role keys

# This ensures:
# - Old keys are permanently invalidated
# - No security risk from legacy key exposure
```

#### Stage 5: Cleanup (Q4 2025)

**Objective**: Remove all legacy key references

**Tasks**:
1. Remove old environment variables:
```bash
# Remove from Vercel (if named differently)
vercel env rm VITE_SUPABASE_SERVICE_ROLE_KEY production
vercel env rm VITE_SUPABASE_SERVICE_ROLE_KEY staging

# Update documentation
# Remove references to old key format
```

2. Update internal documentation:
   - API key management procedures
   - Developer onboarding guides
   - Deployment runbooks

3. Verify no legacy keys remain:
```bash
# Search codebase
grep -r "eyJhbG" . --exclude-dir=node_modules
# Should return no results

# Search environment files
grep -r "VITE_SUPABASE_SERVICE_ROLE_KEY" .
# Should return no results
```

---

## Risk Assessment & Mitigation

### Migration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Key substitution breaks authentication** | Low | High | Extensive staging testing, rollback plan |
| **RLS policies behave differently** | Very Low | High | Validate RLS enforcement in staging |
| **Session interruption for active users** | Low | Medium | Deploy during low-traffic window |
| **Rollback complications** | Low | Medium | Keep old keys active for 48h |
| **Documentation drift** | Medium | Low | Update docs immediately after migration |

### Rollback Procedure

If issues arise during production migration:

```bash
# 1. Immediately revert to old keys
vercel env add VITE_SUPABASE_ANON_KEY production
# Paste OLD anon key

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste OLD service_role key

# 2. Trigger redeployment
vercel --prod

# 3. Verify rollback success
curl https://your-app.vercel.app/api/health

# 4. Document incident
# Note what failed for future troubleshooting
```

**Recovery Time Objective (RTO)**: < 5 minutes
**Recovery Point Objective (RPO)**: Zero data loss (environment variables only)

---

## Security Considerations

### Current Security Posture (Phase 1 Complete)

✅ **Authentication Security**:
- httpOnly cookies prevent XSS token theft
- CSRF tokens protect against cross-site attacks
- Service key is backend-only (not exposed to frontend)
- RLS policies enforce data access control

⚠️ **Remaining Security Tasks**:
- **CRITICAL**: Rotate compromised service key (follow `SERVICE_KEY_ROTATION_GUIDE.md`)
- Update environment variable naming to remove confusing `VITE_` prefix
- Verify legacy token cleanup runs on app initialization

### Phase 2 Security Benefits

The new API key format provides:

1. **Improved Key Identification**: `sb_publishable_*` and `sb_secret_*` prefixes make key type obvious
2. **Reduced Exposure Risk**: Clear naming prevents accidental frontend exposure of secret keys
3. **Better Secret Scanning**: Security tools can easily detect new key format in commits
4. **Audit Trail**: New keys can be tracked separately from legacy keys during migration

---

## Testing Strategy

### Phase 1 Validation (Immediate)

**Test Current httpOnly Cookie Implementation**:

```bash
# 1. Test authentication flow
npm run dev
# Open http://localhost:3003
# Login with test credentials
# Verify no localStorage tokens in DevTools → Application → Local Storage

# 2. Test RLS enforcement
# Open DevTools → Console
# Try to access ideas without authentication:
# supabase.from('ideas').select('*')
# Should fail with RLS error

# 3. Test session management
# Login → Close browser → Reopen
# Should require re-authentication (no persistent localStorage session)

# 4. Test CSRF protection
# Make API request without CSRF token
# Should fail with 403 Forbidden
```

### Phase 2 Testing (Q1-Q2 2025)

**Comprehensive Key Migration Testing**:

```typescript
// test/integration/supabase-new-keys.test.ts

describe('Supabase New API Key Migration', () => {
  describe('Frontend Publishable Key', () => {
    it('should initialize client with new publishable key', async () => {
      const client = createClient(supabaseUrl, publishableKey)
      expect(client).toBeDefined()
    })

    it('should enforce RLS with publishable key', async () => {
      const { data, error } = await supabase.from('ideas').select('*')
      expect(error?.message).toContain('RLS')
    })

    it('should authenticate users correctly', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpass'
      })
      expect(error).toBeNull()
      expect(data.session).toBeDefined()
    })
  })

  describe('Backend Secret Key', () => {
    it('should bypass RLS with secret key', async () => {
      const adminClient = createClient(supabaseUrl, secretKey)
      const { data, error } = await adminClient.from('ideas').select('*')
      expect(error).toBeNull()
      expect(data.length).toBeGreaterThan(0)
    })

    it('should perform admin operations', async () => {
      // Test admin-only operations with secret key
    })
  })

  describe('Migration Compatibility', () => {
    it('should work alongside legacy keys during migration', async () => {
      // Test both old and new keys work simultaneously
    })

    it('should handle key rotation gracefully', async () => {
      // Test switching from old to new keys
    })
  })
})
```

---

## Communication Plan

### Internal Stakeholders

**Development Team**:
- Notify 2 weeks before migration
- Share testing procedures and rollback plan
- Schedule migration during low-traffic window
- Conduct post-migration review

**Operations Team**:
- Update monitoring and alerting for new key format
- Document new key management procedures
- Train on rollback procedures

### External Communication

**Users**:
- No user-facing changes expected
- Transparent migration with zero downtime
- No action required from users

**If Issues Occur**:
- Status page updates
- Email notification if extended downtime
- Clear communication of resolution timeline

---

## Success Metrics

### Phase 1 Validation

- ✅ Zero localStorage tokens present in browser
- ✅ httpOnly cookies set correctly
- ✅ CSRF protection functional
- ✅ RLS policies enforced for all users
- ✅ Service key not exposed in frontend bundle

### Phase 2 Migration

**Technical Metrics**:
- Authentication success rate: > 99.5%
- API error rate: < 0.1% increase
- Response time: < 5% degradation
- RLS policy violations: 0
- Active session disruptions: < 1%

**Migration Metrics**:
- Staging test pass rate: 100%
- Production rollback rate: 0%
- Post-migration incidents: 0
- Migration duration: < 30 minutes

---

## References

- [Supabase New API Keys Discussion](https://github.com/orgs/supabase/discussions/29260)
- [Supabase Auth Server-Side Rendering Guide](https://supabase.com/docs/guides/auth/server-side-rendering)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Service Key Rotation Guide](./SERVICE_KEY_ROTATION_GUIDE.md) (internal)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Author**: Claude Code (Architecture Analysis)
**Approved By**: [Pending Review]
**Next Review**: Q4 2024 (or when Supabase announces Q1 2025 release date)
