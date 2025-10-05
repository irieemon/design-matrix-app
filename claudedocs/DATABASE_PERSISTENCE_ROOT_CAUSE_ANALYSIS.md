# ROOT CAUSE ANALYSIS: Database Persistence Failure for AI-Generated Ideas

**Date**: 2025-10-01
**Severity**: CRITICAL
**Status**: IDENTIFIED - REQUIRES FIX
**Test Evidence**: Playwright E2E test failure in AI Features suite

---

## EXECUTIVE SUMMARY

AI successfully generates 8 ideas, but database persistence fails with error: **"Failed to create project and ideas. Please try again."**

**Root Cause**: Multiple critical issues in the database persistence layer, primarily:
1. **RLS (Row Level Security) policy mismatch** - Schema conflict between owner_id reference types
2. **Missing error logging** - Supabase errors swallowed without detail
3. **Schema inconsistency** - Multiple conflicting schema definitions across migration files
4. **Null return pattern** - Critical errors return `null` instead of throwing exceptions

---

## EVIDENCE FROM PLAYWRIGHT TEST

### Test Flow
1. ✅ User authentication: SUCCESS
2. ✅ AI project analysis: SUCCESS
3. ✅ AI idea generation: SUCCESS (8 ideas created)
4. ❌ Database persistence: **FAILED**
5. ❌ Project creation: **FAILED**

### Error Message
```
"Failed to create project and ideas. Please try again."
```

### Location
- Component: `AIStarterModal.tsx:215`
- Hook: `useProjectCreation.ts:58-59`
- Repository: `ProjectRepository.ts:163`
- Service: `DatabaseService.ts:643-646`

---

## DATA FLOW ANALYSIS

### Complete Execution Path

```
User clicks "Create Project & 8 Ideas"
  ↓
AIStarterModal.handleCreateProject() [line 165]
  ↓
useProjectCreation.createProjectAndIdeas() [line 103]
  ↓
useProjectCreation.createProject() [line 35-62]
  ↓
DatabaseService.createProject() [line 628-653]
  ↓
ProjectRepository.createProject() [line 133-164]
  ↓
Supabase INSERT INTO projects
  ↓
❌ RLS POLICY CHECK FAILS
  ↓
Error returned to DatabaseService
  ↓
DatabaseService returns NULL (line 645)
  ↓
useProjectCreation throws error (line 58)
  ↓
AIStarterModal catches error (line 213-215)
  ↓
ERROR DISPLAYED TO USER
```

---

## ROOT CAUSES IDENTIFIED

### 1. RLS POLICY SCHEMA MISMATCH (PRIMARY ROOT CAUSE)

**File**: Multiple migration files with conflicting schemas
**Issue**: `owner_id` field has conflicting foreign key references

#### Evidence

**Schema Variant A** (fix-database-tables.sql):
```sql
owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
```

**Schema Variant B** (database-migration-clean-install.sql):
```sql
owner_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
```

**Schema Variant C** (database-migration-clean-install-v2.sql):
```sql
owner_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
```

**RLS Policy** (database-migration-clean-install.sql):
```sql
CREATE POLICY "Users can create projects" ON public.projects
    FOR INSERT WITH CHECK (owner_id = auth.uid());
```

#### The Problem
- **Code sends**: `owner_id` as `auth.uid()` (from `auth.users` table)
- **Schema expects**: Foreign key to `public.user_profiles(id)`
- **RLS policy checks**: `owner_id = auth.uid()`
- **Result**: Foreign key constraint violation OR RLS policy rejection

**Verification**:
```typescript
// useProjectCreation.ts:46-53
const project = await DatabaseService.createProject({
  name: projectData.name,
  description: projectData.description,
  project_type: projectData.projectType,
  status: 'active',
  priority_level: 'medium',
  visibility: 'private',
  owner_id: currentUser.id,  // ← This is auth.uid()
  ai_analysis: projectData.analysis.projectAnalysis
})
```

---

### 2. SILENT ERROR HANDLING (SECONDARY ROOT CAUSE)

**File**: `src/lib/database.ts:628-653`

```typescript
static async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project | null> {
  try {
    const projectWithId = {
      ...project,
      id: generateUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('projects')
      .insert([projectWithId])
      .select()
      .single()

    if (error) {
      logger.error('Error creating project:', error)
      return null  // ← CRITICAL: Returns null instead of throwing
    }

    logger.debug('✅ Project created:', data)
    return data
  } catch (error) {
    logger.error('Error creating project:', error)
    return null  // ← CRITICAL: Swallows all errors
  }
}
```

#### Issues
1. **No error propagation**: Returns `null` instead of throwing exception
2. **Lost error context**: Supabase error details not surfaced to caller
3. **Generic user message**: User sees generic "Failed to create" with no diagnostic info
4. **No logging of actual error code**: Missing `error.code`, `error.details`, `error.hint`

---

### 3. MISSING project_id IN ideas TABLE

**File**: `src/lib/database.ts:135-184`
**Issue**: Ideas table schema might not have `project_id` column or foreign key

```typescript
static async createIdea(idea: CreateIdeaInput): Promise<ApiResponse<IdeaCard>> {
  try {
    logger.debug('🗃️ DatabaseService: Creating idea:', idea)

    const ideaWithId = {
      ...idea,
      id: generateUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('ideas')
      .insert([ideaWithId])
      .select()
      .single()

    if (error) {
      const dbError = this.handleDatabaseError(error, 'createIdea')
      return {
        success: false,
        error: {
          type: 'database',
          message: dbError.message,
          code: dbError.code
        },
        timestamp: new Date().toISOString()
      }
    }
    // ...
  }
}
```

**Schema Evidence** (`database/schema.sql`):
```sql
CREATE TABLE IF NOT EXISTS ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  details TEXT DEFAULT '',
  x INTEGER NOT NULL DEFAULT 260,
  y INTEGER NOT NULL DEFAULT 260,
  priority TEXT NOT NULL DEFAULT 'moderate',
  created_by TEXT NOT NULL DEFAULT 'Anonymous',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- ⚠️ MISSING: project_id column!
```

**Migration adds it** (via ALTER):
```sql
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
```

But RLS policies might not account for this.

---

### 4. INCONSISTENT ERROR HANDLING PATTERNS

**Pattern 1** - DatabaseService (returns null):
```typescript
static async createProject(...): Promise<Project | null> {
  if (error) {
    logger.error('Error creating project:', error)
    return null  // Loses error context
  }
}
```

**Pattern 2** - ProjectRepository (also returns null):
```typescript
static async createProject(...): Promise<Project | null> {
  if (error) {
    logger.error('Error creating project:', error)
    throw new Error(error.message)  // Better, but still generic
  }
  return null  // Still used in catch block
}
```

**Pattern 3** - IdeaService (proper error handling):
```typescript
static async createIdea(...): Promise<ServiceResult<IdeaCard>> {
  return this.executeWithRetry(async () => {
    // Proper error propagation through ServiceResult pattern
    if (error) {
      throw error  // Propagates to executeWithRetry
    }
    return data as IdeaCard
  }, context)
}
```

---

## SCHEMA CONFLICTS ACROSS MIGRATION FILES

### Comparison Table

| File | owner_id Type | owner_id Reference | NOT NULL | Default |
|------|--------------|-------------------|----------|---------|
| fix-database-tables.sql | uuid | auth.users(id) | YES | - |
| database-migration-clean-install.sql | uuid | user_profiles(id) | YES | '00000000...' |
| database-migration-clean-install-v2.sql | uuid | user_profiles(id) | NO | - |
| database-migration-projects.sql | - | - | - | - |
| database-migration-projects-enhanced.sql | - | created_by TEXT | YES | - |

**Conclusion**: No single source of truth for projects table schema!

---

## SPECIFIC FAILURE POINTS

### Point 1: Project Creation RLS Check
**Location**: Supabase database
**Policy**: `"Users can create projects"`
**Check**: `WITH CHECK (owner_id = auth.uid())`

**Failure Mode**:
- If `auth.uid()` returns UUID from `auth.users`
- But foreign key references `public.user_profiles(id)`
- And user profile doesn't exist for this auth user
- **Result**: Foreign key constraint violation

### Point 2: NULL Return Cascade
**Location**: `useProjectCreation.ts:46-59`

```typescript
const project = await DatabaseService.createProject({...})

if (!project) {  // ← project is null when DB fails
  throw new Error('Failed to create project')  // Generic error
}
```

**Failure Mode**:
- DatabaseService returns `null` (no exception thrown)
- Hook checks for null and throws generic error
- Original database error details completely lost
- User sees: "Failed to create project and ideas. Please try again."

### Point 3: Idea Creation Orphaned
**Location**: `useProjectCreation.ts:64-101`

```typescript
const createIdeas = useCallback(async (
  ideas: ProjectAnalysis['generatedIdeas'],
  projectId: string,
  currentUser: User
): Promise<IdeaCard[]> => {
  const createdIdeas: IdeaCard[] = []

  for (const ideaData of ideas) {
    try {
      const newIdea = await DatabaseService.createIdea({
        content: ideaData.content,
        details: ideaData.details,
        x: Math.round(ideaData.x),
        y: Math.round(ideaData.y),
        priority: ideaData.priority,
        created_by: currentUser.id,
        is_collapsed: true,
        project_id: projectId  // ← This project doesn't exist!
      })
      // ...
    }
  }
}, [])
```

**Failure Mode**:
- If project creation fails but doesn't throw
- Ideas attempt creation with non-existent `project_id`
- Foreign key constraint fails
- Each idea creation fails silently (in catch block)
- Returns empty array if all fail

---

## COMPREHENSIVE ISSUE LIST

### Database Layer Issues

1. ✅ **Schema conflict**: `owner_id` foreign key references wrong table
2. ✅ **Missing project_id**: Ideas table may lack proper foreign key setup
3. ✅ **RLS policy mismatch**: Policies reference wrong user identifier
4. ✅ **No error details logged**: Supabase errors lack code, details, hint
5. ⚠️ **Multiple migrations**: 8+ conflicting schema definitions in repo
6. ⚠️ **No transaction support**: Project + Ideas not created atomically

### Code Layer Issues

7. ✅ **Null return anti-pattern**: DatabaseService returns null on errors
8. ✅ **Lost error context**: Generic "Failed to create" message
9. ✅ **No retry logic**: Single attempt, no exponential backoff
10. ✅ **Silent idea failures**: Ideas fail individually without rollback
11. ⚠️ **Missing validation**: No pre-flight checks for user existence
12. ⚠️ **No partial success handling**: Some ideas might succeed, some fail

### Architecture Issues

13. ✅ **Mixed error patterns**: Three different error handling approaches
14. ✅ **Service layer bypass**: DatabaseService called directly, not through Service layer
15. ⚠️ **No database health check**: No pre-creation validation
16. ⚠️ **Missing observability**: No metrics, traces, or detailed logs

---

## TESTING STRATEGY

### Unit Tests Required

```typescript
describe('ProjectRepository.createProject', () => {
  it('should throw detailed error on RLS policy failure', async () => {
    // Mock Supabase to return RLS error
    const error = await expect(
      ProjectRepository.createProject({
        owner_id: 'non-existent-user-id',
        // ...
      })
    ).rejects.toThrow()

    expect(error.message).toContain('RLS')
    expect(error.code).toBe('42501') // PostgreSQL permission denied
  })

  it('should throw error on foreign key violation', async () => {
    // Mock Supabase to return FK error
    const error = await expect(
      ProjectRepository.createProject({
        owner_id: 'invalid-uuid',
        // ...
      })
    ).rejects.toThrow()

    expect(error.code).toBe('23503') // PostgreSQL FK violation
  })
})
```

### Integration Tests Required

```typescript
describe('AI Project Creation E2E', () => {
  it('should create project and all ideas atomically', async () => {
    const user = await createTestUser()
    const ideas = generateMockIdeas(8)

    const result = await createProjectAndIdeas({
      name: 'Test Project',
      ideas,
      userId: user.id
    })

    expect(result.project).toBeDefined()
    expect(result.ideas).toHaveLength(8)

    // Verify database state
    const dbProject = await supabase
      .from('projects')
      .select('*')
      .eq('id', result.project.id)
      .single()

    expect(dbProject.data).toBeDefined()

    const dbIdeas = await supabase
      .from('ideas')
      .select('*')
      .eq('project_id', result.project.id)

    expect(dbIdeas.data).toHaveLength(8)
  })

  it('should rollback all changes on idea creation failure', async () => {
    // Test atomic transaction behavior
  })
})
```

---

## RECOMMENDED FIXES

### Priority 1: Critical Database Schema Fix

```sql
-- 1. Ensure user_profiles table exists and is populated
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create trigger to auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill existing users
INSERT INTO public.user_profiles (id, email, full_name)
SELECT id, email, raw_user_meta_data->>'full_name'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. Fix projects table foreign key
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_owner_id_fkey;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_owner_id_fkey
  FOREIGN KEY (owner_id)
  REFERENCES public.user_profiles(id)
  ON DELETE CASCADE;

-- 5. Fix RLS policies
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;

CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (
    owner_id IN (
      SELECT id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- 6. Ensure ideas table has project_id
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- 7. Fix ideas RLS policy
DROP POLICY IF EXISTS "Users can modify ideas in editable projects" ON public.ideas;

CREATE POLICY "Users can create ideas in owned projects" ON public.ideas
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
  );
```

### Priority 2: Fix Error Handling Pattern

**File**: `src/lib/database.ts`

```typescript
static async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
  try {
    const projectWithId = {
      ...project,
      id: generateUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    logger.debug('Creating project:', projectWithId)

    const { data, error } = await supabase
      .from('projects')
      .insert([projectWithId])
      .select()
      .single()

    if (error) {
      // Log full error details
      logger.error('Supabase error creating project:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        projectData: projectWithId
      })

      // Throw with detailed message
      throw new DatabaseError({
        code: error.code || 'UNKNOWN',
        message: `Failed to create project: ${error.message}`,
        details: error.details,
        hint: error.hint,
        operation: 'createProject'
      })
    }

    if (!data) {
      throw new Error('No data returned from project creation')
    }

    logger.debug('✅ Project created successfully:', data.id)
    return data
  } catch (error) {
    // Re-throw instead of returning null
    if (error instanceof DatabaseError) {
      throw error
    }

    logger.error('Unexpected error creating project:', error)
    throw new Error(`Project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
```

### Priority 3: Add Atomic Transaction Support

```typescript
static async createProjectWithIdeas(
  project: Omit<Project, 'id' | 'created_at' | 'updated_at'>,
  ideas: CreateIdeaInput[]
): Promise<{ project: Project; ideas: IdeaCard[] }> {
  // Use Supabase RPC for atomic transaction
  const { data, error } = await supabase.rpc('create_project_with_ideas', {
    project_data: project,
    ideas_data: ideas
  })

  if (error) {
    logger.error('Transaction failed:', error)
    throw new DatabaseError({
      code: error.code,
      message: `Atomic creation failed: ${error.message}`,
      operation: 'createProjectWithIdeas'
    })
  }

  return data
}
```

**Database function**:
```sql
CREATE OR REPLACE FUNCTION create_project_with_ideas(
  project_data JSONB,
  ideas_data JSONB[]
) RETURNS JSONB AS $$
DECLARE
  new_project public.projects;
  new_ideas public.ideas[];
  idea JSONB;
  new_idea public.ideas;
BEGIN
  -- Insert project
  INSERT INTO public.projects (
    name, description, project_type, status, priority_level,
    visibility, owner_id, ai_analysis, created_at, updated_at
  ) VALUES (
    project_data->>'name',
    project_data->>'description',
    project_data->>'project_type',
    project_data->>'status',
    project_data->>'priority_level',
    project_data->>'visibility',
    (project_data->>'owner_id')::UUID,
    project_data->'ai_analysis',
    NOW(),
    NOW()
  ) RETURNING * INTO new_project;

  -- Insert ideas
  FOREACH idea IN ARRAY ideas_data LOOP
    INSERT INTO public.ideas (
      content, details, x, y, priority, created_by,
      project_id, is_collapsed, created_at, updated_at
    ) VALUES (
      idea->>'content',
      idea->>'details',
      (idea->>'x')::INTEGER,
      (idea->>'y')::INTEGER,
      idea->>'priority',
      (idea->>'created_by')::UUID,
      new_project.id,
      (idea->>'is_collapsed')::BOOLEAN,
      NOW(),
      NOW()
    ) RETURNING * INTO new_idea;

    new_ideas := array_append(new_ideas, new_idea);
  END LOOP;

  -- Return combined result
  RETURN jsonb_build_object(
    'project', to_jsonb(new_project),
    'ideas', to_jsonb(new_ideas)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Priority 4: Improve Error Messages

```typescript
// src/components/AIStarterModal.tsx

} catch (err) {
  logger.error('Error creating project:', err)

  // Extract specific error details
  let errorMessage = AI_STARTER_MESSAGES.ERROR_CREATION_FAILED

  if (err instanceof Error) {
    // Check for specific error types
    if (err.message.includes('RLS') || err.message.includes('policy')) {
      errorMessage = 'Permission denied. Please ensure you have an active account.'
    } else if (err.message.includes('foreign key') || err.message.includes('violates')) {
      errorMessage = 'Database error: User profile not found. Please contact support.'
    } else if (err.message.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.'
    }

    // Log to error tracking service
    trackError(err, {
      context: 'AI Project Creation',
      projectName: projectName,
      ideaCount: analysis.generatedIdeas.length,
      userId: currentUser.id
    })
  }

  setError(errorMessage)
}
```

---

## VALIDATION CHECKLIST

Before deploying fixes:

- [ ] Run all existing unit tests
- [ ] Add new unit tests for error scenarios
- [ ] Test with real Supabase database
- [ ] Verify user_profiles table exists and is populated
- [ ] Verify foreign key constraints work
- [ ] Test RLS policies with authenticated user
- [ ] Test atomic transaction rollback
- [ ] Verify error messages are helpful
- [ ] Test with 1, 5, and 10 ideas
- [ ] Test with invalid user IDs
- [ ] Test with non-existent projects
- [ ] Load test with 100 concurrent creations

---

## MONITORING RECOMMENDATIONS

### Metrics to Track

1. **Project creation success rate** (should be >99%)
2. **Average creation time** (should be <500ms)
3. **Error rate by error code** (track 23503, 42501, etc.)
4. **Ideas created per project** (verify all 8 created)
5. **Partial failure rate** (some ideas succeed, some fail)

### Alerts to Configure

1. **Critical**: Project creation error rate >1%
2. **Warning**: Average creation time >1s
3. **Info**: New error code encountered
4. **Critical**: Atomic transaction failure rate >0%

### Logs to Implement

```typescript
logger.info('Project creation started', {
  userId: user.id,
  projectName: name,
  ideaCount: ideas.length,
  timestamp: Date.now()
})

logger.info('Project creation succeeded', {
  projectId: project.id,
  duration: Date.now() - startTime,
  ideasCreated: createdIdeas.length
})

logger.error('Project creation failed', {
  error: error.message,
  code: error.code,
  duration: Date.now() - startTime,
  attemptCount: retries
})
```

---

## CONCLUSION

**Primary Root Cause**: RLS policy and foreign key constraint mismatch between `auth.users` and `public.user_profiles`

**Secondary Root Causes**:
- Silent null returns masking database errors
- Missing atomic transaction support
- Inconsistent error handling patterns
- No detailed error logging

**Impact**: Complete failure of AI-generated project persistence despite successful idea generation

**Risk**: HIGH - Core feature completely broken for all users

**Fix Complexity**: MEDIUM - Requires database migration + code changes

**Estimated Fix Time**:
- Priority 1 (Schema): 2-4 hours
- Priority 2 (Error handling): 2-3 hours
- Priority 3 (Transactions): 4-6 hours
- Priority 4 (Messaging): 1-2 hours
- **Total**: 9-15 hours

**Testing Time**: 4-6 hours

**Deployment Risk**: MEDIUM - Requires database migration, test in staging first

---

## NEXT STEPS

1. Apply Priority 1 schema fix to staging database
2. Test with real user authentication flow
3. Apply Priority 2 error handling improvements
4. Implement Priority 3 atomic transactions
5. Deploy to staging and run E2E tests
6. Monitor metrics for 24 hours
7. Deploy to production with rollback plan
8. Clean up redundant migration files
9. Document final schema as single source of truth
10. Add integration tests to CI/CD pipeline
