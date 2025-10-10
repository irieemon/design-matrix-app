# Phase 4: Complete RLS Rollout - Roadmap

**Date**: 2025-10-10
**Status**: 🚀 **READY TO START**
**Previous Phase**: ✅ Phase 3 Complete (RLS Restoration with backwards compatibility)

---

## 🎯 Objective

Complete the Row-Level Security (RLS) rollout by updating all remaining API endpoints to use authenticated Supabase clients, ensuring defense-in-depth security across the entire application.

**Goal**: Replace all `supabaseAdmin` usage in API endpoints with authenticated clients that enforce RLS policies.

---

## 📊 Current State Assessment

### ✅ Completed (Phase 3)
- [x] Authenticated client factory (`src/lib/authClient.ts`)
- [x] IdeaService updated with optional client parameter
- [x] API endpoint pattern established (`api/ideas.ts`)
- [x] Backwards compatible authentication (httpOnly cookies + localStorage)
- [x] Documentation and testing guides

### 🔄 In Progress (Phase 4)
**API Endpoints to Update**: 4 endpoints
1. `api/auth.ts` (24KB) - Authentication operations
2. `api/user.ts` (9KB) - User profile operations
3. `api/admin.ts` (11KB) - Admin operations
4. `api/ai.ts` (99KB) - AI analysis operations

**Note**: Auth-specific endpoints (`api/auth/login.ts`, `api/auth/signup.ts`, etc.) use temporary unauthenticated clients by design - no changes needed.

---

## 🗺️ Phase 4 Tasks

### Task 1: Update `api/user.ts` ⭐ (Highest Priority)
**Complexity**: Medium
**Impact**: High (user profile operations)
**Estimated Time**: 2-3 hours

**Endpoints**:
- `GET /api/user` - Get current user profile
- `PUT /api/user` - Update user profile
- `POST /api/user/avatar` - Update user avatar

**Changes Needed**:
```typescript
// Current (admin client):
const supabaseAdmin = createClient(url, serviceRoleKey)
const { data } = await supabaseAdmin.from('user_profiles').select('*')

// Target (authenticated client):
const supabase = createAuthenticatedClient(req)
const { data } = await supabase.from('user_profiles').select('*')
```

**RLS Benefits**:
- Users can only view/update their own profile
- Prevents privilege escalation attacks
- Database enforces access control

---

### Task 2: Update `api/admin.ts` ⭐⭐ (Medium Priority)
**Complexity**: Low (admin operations legitimately need admin client)
**Impact**: Medium (admin-only features)
**Estimated Time**: 1-2 hours

**Consideration**: Admin operations **may** legitimately need admin client to bypass RLS for administrative queries.

**Approach**:
1. **Add authentication check** - Verify user has admin role
2. **Use authenticated client** - For admin's own operations
3. **Keep admin client** - Only for legitimate admin queries (with logging)

**Example**:
```typescript
// Get authenticated admin user first
const adminClient = createAuthenticatedClient(req)
const { data: { user } } = await adminClient.auth.getUser()

// Verify admin role
const isAdmin = await checkIsAdmin(user.id)
if (!isAdmin) {
  return res.status(403).json({ error: 'Admin access required' })
}

// Use admin client ONLY for admin queries (with audit logging)
logger.audit('Admin query', { adminId: user.id, query: 'getAllUsers' })
const { data } = await supabaseAdmin.from('users').select('*')
```

---

### Task 3: Update `api/ai.ts` ⭐⭐⭐ (Lower Priority)
**Complexity**: High (large file, 99KB)
**Impact**: Medium (AI analysis features)
**Estimated Time**: 4-6 hours

**Endpoints**:
- `POST /api/ai/analyze` - Trigger AI analysis
- `GET /api/ai/results` - Get analysis results
- `POST /api/ai/ideas` - Generate ideas from AI

**Strategy**:
- Break into smaller chunks
- Update one endpoint at a time
- Test thoroughly (AI operations are complex)

---

### Task 4: Validate RLS Policies ⭐⭐⭐⭐ (Critical)
**Complexity**: Medium
**Impact**: Critical (security validation)
**Estimated Time**: 3-4 hours

**Actions**:
1. **Verify RLS is enabled** on all tables
2. **Document existing policies** for each table
3. **Test policy enforcement** with different user scenarios
4. **Create automated tests** for RLS validation

**SQL Queries**:
```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- View existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

-- Test as specific user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-id-here';
SELECT * FROM ideas; -- Should only return user's accessible ideas
```

---

### Task 5: Create RLS Validation Tests 🧪
**Complexity**: Medium
**Impact**: High (automated security testing)
**Estimated Time**: 3-4 hours

**Test Categories**:
1. **Authentication Tests**
   - Authenticated users can access their data
   - Unauthenticated requests return 401

2. **Authorization Tests**
   - Users cannot access other users' data
   - Project collaborators can access shared data
   - Admin users can access admin-only data

3. **RLS Policy Tests**
   - Database policies are enforced
   - Application-layer bypass attempts fail
   - Edge cases are covered

**Example Test**:
```typescript
describe('RLS Enforcement', () => {
  it('should prevent users from accessing other users data', async () => {
    // User A's token
    const userAToken = await getToken('user-a@example.com')

    // Try to access User B's data with User A's token
    const response = await fetch('/api/user?userId=user-b-id', {
      headers: { Authorization: `Bearer ${userAToken}` }
    })

    // Should fail with 403 or return empty
    expect(response.status).toBe(403)
  })
})
```

---

### Task 6: Enable httpOnly Cookie Auth Feature Flag 🚩
**Complexity**: Low
**Impact**: High (complete migration to secure auth)
**Estimated Time**: 1 hour

**Action**: Enable the new authentication system globally

**Steps**:
1. Add to `.env` and Vercel environment:
```bash
VITE_FEATURE_HTTPONLY_AUTH=true
```

2. Update production environment variables in Vercel dashboard

3. Test migration path:
   - Existing users (localStorage auth) → works via Authorization header
   - New logins → uses httpOnly cookies
   - Both methods work simultaneously during transition

4. Monitor metrics:
   - Track which auth method is being used
   - Watch for auth-related errors
   - Validate smooth transition

---

### Task 7: Remove Admin Client Fallbacks 🔒
**Complexity**: Medium
**Impact**: Critical (full RLS enforcement)
**Estimated Time**: 2-3 hours

**Changes**:
1. Make `client` parameter **required** in services (breaking change)
2. Remove `|| supabaseAdmin` fallbacks
3. Update all service calls to pass authenticated client
4. Add compile-time checks for missing client parameter

**Before**:
```typescript
static async getIdeasByProject(
  projectId?: string,
  options?: IdeaQueryOptions,
  client?: SupabaseClient  // Optional - falls back to admin
): Promise<ServiceResult<IdeaCard[]>>
```

**After**:
```typescript
static async getIdeasByProject(
  projectId: string,
  client: SupabaseClient,  // Required - no fallback
  options?: IdeaQueryOptions
): Promise<ServiceResult<IdeaCard[]>>
```

---

### Task 8: Implement Audit Logging 📝
**Complexity**: Medium
**Impact**: Medium (security monitoring)
**Estimated Time**: 3-4 hours

**Features**:
- Log all admin client usage
- Track authentication method used (cookie vs header)
- Monitor RLS policy violations
- Create audit trail for security events

**Example**:
```typescript
// Audit logger
class SecurityAudit {
  static logAdminClientUsage(userId: string, operation: string, reason: string) {
    logger.security({
      type: 'admin_client_usage',
      userId,
      operation,
      reason,
      timestamp: new Date().toISOString()
    })
  }

  static logAuthMethod(userId: string, method: 'cookie' | 'header') {
    logger.info({
      type: 'auth_method',
      userId,
      method,
      timestamp: new Date().toISOString()
    })
  }
}
```

---

## 📅 Recommended Schedule

### Week 1: High-Priority Updates
- **Day 1-2**: Task 1 - Update `api/user.ts`
- **Day 3**: Task 2 - Update `api/admin.ts`
- **Day 4-5**: Task 4 - Validate RLS policies

### Week 2: Testing & Validation
- **Day 1-2**: Task 5 - Create RLS validation tests
- **Day 3**: Task 6 - Enable httpOnly auth feature flag
- **Day 4-5**: Test and monitor

### Week 3: AI Endpoint & Cleanup
- **Day 1-3**: Task 3 - Update `api/ai.ts` (complex, large file)
- **Day 4**: Task 7 - Remove admin client fallbacks
- **Day 5**: Task 8 - Implement audit logging

### Week 4: Deployment & Monitoring
- Deploy to staging
- Perform penetration testing
- Monitor production metrics
- Document final state

---

## 🎯 Success Criteria

### Phase 4 Complete When:
- [ ] All API endpoints use authenticated clients (except auth endpoints)
- [ ] RLS policies validated and documented
- [ ] Automated RLS tests passing
- [ ] httpOnly cookie auth enabled globally
- [ ] Admin client fallbacks removed
- [ ] Audit logging implemented
- [ ] Zero RLS bypass warnings in logs
- [ ] Penetration testing passed

### Security Metrics:
- **RLS Enforcement**: 100% of endpoints
- **Admin Client Usage**: <5% (admin operations only)
- **Auth Method**: 90%+ using httpOnly cookies (after migration period)
- **Policy Coverage**: 100% of tables

---

## ⚠️ Risks & Mitigation

### Risk 1: Breaking Changes
**Risk**: Making `client` parameter required breaks existing code
**Mitigation**:
- Comprehensive grep for all service calls
- Update all calls before removing optional parameter
- Add TypeScript compile-time checks

### Risk 2: Admin Operations Broken
**Risk**: Admin queries fail with RLS enforcement
**Mitigation**:
- Carefully audit admin operations
- Keep admin client for legitimate admin queries
- Add role-based access control checks

### Risk 3: Performance Impact
**Risk**: RLS adds database overhead
**Mitigation**:
- Benchmark before/after
- Optimize RLS policies
- Add database indexes as needed

### Risk 4: Migration Confusion
**Risk**: Users confused during auth method transition
**Mitigation**:
- Keep both auth methods working
- Monitor error rates
- Clear communication about changes

---

## 📚 Documentation Tasks

1. **Update RLS_RESTORATION_SUMMARY.md**
   - Mark Phase 4 complete
   - Update security metrics
   - Add final architecture diagram

2. **Create RLS_POLICY_REFERENCE.md**
   - Document all RLS policies
   - Explain policy logic
   - Provide examples

3. **Update API documentation**
   - Mark endpoints as RLS-enforced
   - Document authentication requirements
   - Add security notes

4. **Create SECURITY_TESTING_GUIDE.md**
   - RLS testing procedures
   - Penetration testing scenarios
   - Security validation checklist

---

## 🚀 Quick Start

**To begin Phase 4 immediately**:

1. **Create feature branch**:
```bash
git checkout -b phase-4-rls-rollout
```

2. **Start with highest priority** (api/user.ts):
```bash
# Read current implementation
cat api/user.ts

# Follow pattern from api/ideas.ts
cat api/ideas.ts
```

3. **Use the established pattern**:
   - Import `createClient` from `@supabase/supabase-js`
   - Add `getAccessToken(req)` function
   - Add `createAuthenticatedClient(req)` function
   - Replace `supabaseAdmin` with authenticated client
   - Add 401 error handling

4. **Test locally**:
```bash
npm run dev
# Test with browser at localhost:3003
```

5. **Commit incrementally**:
```bash
git add api/user.ts
git commit -m "Phase 4: Update api/user.ts to use authenticated client for RLS enforcement"
```

---

## 📞 Support & Questions

**Documentation**:
- Phase 3 Summary: `claudedocs/RLS_RESTORATION_SUMMARY.md`
- Auth Client: `src/lib/authClient.ts`
- Reference Implementation: `api/ideas.ts`

**Need Help?**
- Check existing RLS documentation
- Review Phase 3 implementation
- Test changes locally first
- Ask questions early!

---

**Phase 4 Status**: 🚀 **READY TO START**
**Estimated Completion**: 3-4 weeks
**Next Action**: Update `api/user.ts` (Task 1)
