# Database Persistence Data Flow Diagram

## Complete Execution Flow with Failure Points

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        User clicks "Create Project & 8 Ideas"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  AIStarterModal.handleCreateProject()                           │
│  File: src/components/AIStarterModal.tsx:165-219                │
│                                                                  │
│  State:                                                          │
│  - projectName: "AI Testing Project"                            │
│  - analysis: { generatedIdeas: [...8 ideas] }                   │
│  - currentUser: { id: "uuid-from-auth.users" }                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  useProjectCreation.createProjectAndIdeas()                     │
│  File: src/hooks/aiStarter/useProjectCreation.ts:103-132        │
│                                                                  │
│  try {                                                           │
│    const project = await createProject(...)                     │
│    const ideas = await createIdeas(...)                         │
│    onSuccess(project, ideas)                                    │
│  } catch (error) {                                              │
│    throw error                                                  │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  useProjectCreation.createProject()                             │
│  File: src/hooks/aiStarter/useProjectCreation.ts:35-62          │
│                                                                  │
│  const project = await DatabaseService.createProject({          │
│    name: "AI Testing Project",                                  │
│    description: "...",                                          │
│    project_type: "marketing",                                   │
│    status: "active",                                            │
│    priority_level: "medium",                                    │
│    visibility: "private",                                       │
│    owner_id: currentUser.id,  ← AUTH.USERS UUID                │
│    ai_analysis: {...}                                           │
│  })                                                             │
│                                                                  │
│  if (!project) {                                                │
│    throw new Error('Failed to create project')                 │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  DatabaseService.createProject()                                │
│  File: src/lib/database.ts:628-653                              │
│                                                                  │
│  const projectWithId = {                                        │
│    ...project,                                                  │
│    id: generateUUID(),                                          │
│    created_at: new Date().toISOString(),                        │
│    updated_at: new Date().toISOString()                         │
│  }                                                              │
│                                                                  │
│  const { data, error } = await supabase                         │
│    .from('projects')                                            │
│    .insert([projectWithId])                                     │
│    .select()                                                    │
│    .single()                                                    │
│                                                                  │
│  if (error) {                                                   │
│    logger.error('Error creating project:', error)              │
│    return null  ← SWALLOWS ERROR, RETURNS NULL                 │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE CLIENT LAYER                        │
│                                                                  │
│  POST /rest/v1/projects                                         │
│  Headers:                                                        │
│    - Authorization: Bearer <jwt_token>                          │
│    - apikey: <anon_key>                                         │
│  Body:                                                           │
│    {                                                            │
│      id: "generated-uuid",                                      │
│      name: "AI Testing Project",                                │
│      owner_id: "auth-user-uuid",  ← FROM AUTH.USERS            │
│      ...                                                        │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SUPABASE DATABASE LAYER                       │
│                   PostgreSQL with RLS                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────┐
│ STEP 1: RLS CHECK    │              │ STEP 2: FK CHECK     │
│                      │              │                      │
│ Policy:              │              │ Constraint:          │
│ "Users can create    │              │ owner_id REFERENCES  │
│  projects"           │              │ user_profiles(id)    │
│                      │              │                      │
│ WITH CHECK:          │              │ Validates:           │
│ owner_id = auth.uid()│              │ EXISTS (             │
│                      │              │   SELECT 1           │
│ Result:              │              │   FROM user_profiles │
│ ✓ PASS               │              │   WHERE id =         │
│ (owner_id matches    │              │     'auth-user-uuid' │
│  current auth user)  │              │ )                    │
│                      │              │                      │
│                      │              │ Result:              │
│                      │              │ ✗ FAIL               │
│                      │              │ (no user_profile     │
│                      │              │  exists for auth.uid)│
└──────────────────────┘              └──────────────────────┘
                                                 │
                                                 ▼
                                      ┌──────────────────────┐
                                      │ ERROR GENERATED      │
                                      │                      │
                                      │ Code: 23503          │
                                      │ Message: "insert or  │
                                      │ update on table      │
                                      │ projects violates    │
                                      │ foreign key          │
                                      │ constraint"          │
                                      │                      │
                                      │ Details: "Key        │
                                      │ (owner_id)=          │
                                      │ (uuid) is not        │
                                      │ present in table     │
                                      │ user_profiles"       │
                                      └──────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              ERROR PROPAGATION BACK UP STACK                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
          Supabase returns error to client
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  DatabaseService.createProject()                                │
│                                                                  │
│  if (error) {                                                   │
│    logger.error('Error creating project:', error)              │
│    ┌─────────────────────────────────────────────┐             │
│    │ LOGGED ERROR:                                │             │
│    │ {                                            │             │
│    │   message: "insert or update on table..."   │             │
│    │   code: "23503",                             │             │
│    │   details: "Key (owner_id)=...",             │             │
│    │   hint: null                                 │             │
│    │ }                                            │             │
│    └─────────────────────────────────────────────┘             │
│                                                                  │
│    return null  ← ERROR CONTEXT LOST HERE                      │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  useProjectCreation.createProject()                             │
│                                                                  │
│  if (!project) {  ← project is null                            │
│    throw new Error('Failed to create project')                 │
│    ┌─────────────────────────────────────────────┐             │
│    │ THROWN ERROR:                                │             │
│    │ {                                            │             │
│    │   message: "Failed to create project"       │             │
│    │   // Original error code 23503 LOST         │             │
│    │   // Original error details LOST            │             │
│    │ }                                            │             │
│    └─────────────────────────────────────────────┘             │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  useProjectCreation.createProjectAndIdeas()                     │
│                                                                  │
│  } catch (err) {                                                │
│    logger.error('Error creating project:', err)                │
│    throw err  ← Re-throws generic error                        │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  AIStarterModal.handleCreateProject()                           │
│                                                                  │
│  } catch (err) {                                                │
│    logger.error('Error creating project:', err)                │
│    setError(AI_STARTER_MESSAGES.ERROR_CREATION_FAILED)         │
│    ┌─────────────────────────────────────────────┐             │
│    │ DISPLAYED TO USER:                           │             │
│    │ "Failed to create project and ideas.         │             │
│    │  Please try again."                          │             │
│    │                                              │             │
│    │ // User has NO IDEA what went wrong         │             │
│    │ // Developer has to dig through logs         │             │
│    └─────────────────────────────────────────────┘             │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     USER SEES ERROR                             │
│                                                                  │
│  ┌───────────────────────────────────────────────────┐          │
│  │  ⚠️ Failed to create project and ideas.          │          │
│  │     Please try again.                             │          │
│  │                                                   │          │
│  │  [Dismiss]                                        │          │
│  └───────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Alternative Flow: What SHOULD Happen

```
┌─────────────────────────────────────────────────────────────────┐
│                  CORRECTED FLOW WITH FIXES                      │
└─────────────────────────────────────────────────────────────────┘

User clicks "Create Project & 8 Ideas"
         │
         ▼
DatabaseService.createProject({
  owner_id: currentUser.id  ← AUTH.USERS UUID
})
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE DATABASE LAYER (FIXED)                                │
│                                                                  │
│  STEP 1: Trigger creates user_profile if not exists             │
│  ┌──────────────────────────────────────────────┐               │
│  │ ON INSERT TO auth.users:                     │               │
│  │   INSERT INTO user_profiles (id, email)      │               │
│  │   VALUES (NEW.id, NEW.email)                 │               │
│  │   ON CONFLICT DO NOTHING                     │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  STEP 2: RLS Check (PASSES)                                     │
│  ┌──────────────────────────────────────────────┐               │
│  │ Policy: owner_id IN (                        │               │
│  │   SELECT id FROM user_profiles               │               │
│  │   WHERE id = auth.uid()                      │               │
│  │ )                                            │               │
│  │ Result: ✓ PASS                               │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  STEP 3: FK Check (PASSES)                                      │
│  ┌──────────────────────────────────────────────┐               │
│  │ Constraint: owner_id REFERENCES              │               │
│  │   user_profiles(id)                          │               │
│  │ Result: ✓ PASS (profile exists)              │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  STEP 4: INSERT succeeds                                        │
│  ┌──────────────────────────────────────────────┐               │
│  │ INSERT INTO projects (...)                   │               │
│  │ VALUES (...)                                 │               │
│  │ RETURNING *                                  │               │
│  └──────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
DatabaseService.createProject() receives data
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  if (error) {                                                   │
│    // Detailed error logging                                    │
│    logger.error('Supabase error:', {                            │
│      code: error.code,                                          │
│      message: error.message,                                    │
│      details: error.details,                                    │
│      hint: error.hint                                           │
│    })                                                           │
│    throw new DatabaseError(error)  ← THROW, DON'T RETURN NULL  │
│  }                                                              │
│                                                                  │
│  return data  ← SUCCESS PATH                                    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
useProjectCreation.createProject() receives project
         │
         ▼
useProjectCreation.createIdeas() called with project.id
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ATOMIC TRANSACTION (NEW)                                       │
│                                                                  │
│  BEGIN TRANSACTION;                                             │
│                                                                  │
│  -- Project already created                                     │
│  -- Now insert all 8 ideas                                      │
│                                                                  │
│  INSERT INTO ideas (project_id, content, ...) VALUES            │
│    (project_id, 'Idea 1', ...),                                 │
│    (project_id, 'Idea 2', ...),                                 │
│    ... (8 total)                                                │
│  RETURNING *;                                                   │
│                                                                  │
│  -- If ANY idea fails, ROLLBACK entire project                  │
│  -- If ALL succeed, COMMIT                                      │
│                                                                  │
│  COMMIT;                                                        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
onSuccess(project, ideas)  ← All 8 ideas created
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  USER SEES SUCCESS                                              │
│                                                                  │
│  ✓ Project "AI Testing Project" created                         │
│  ✓ 8 ideas added to matrix                                      │
│  ✓ Redirected to matrix view                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schema State Comparison

### Current (Broken) State

```
┌─────────────────────┐     ┌─────────────────────┐
│   auth.users        │     │  public.projects    │
│                     │     │                     │
│  id (UUID) PK       │     │  id (UUID) PK       │
│  email              │     │  owner_id (UUID)    │
│  ...                │     │    FK → ???         │
└─────────────────────┘     │  ...                │
         │                  └─────────────────────┘
         │                           │
         │                           │ FK Reference
         │                           ▼
         │                  ┌─────────────────────┐
         │                  │ user_profiles       │
         │                  │ (MISSING/EMPTY!)    │
         │                  │                     │
         └─────────X────────│  id (UUID) PK       │
           NO SYNC!         │  email              │
                           └─────────────────────┘

PROBLEM:
- auth.users contains user with id='abc123'
- user_profiles does NOT have row with id='abc123'
- projects.owner_id='abc123' violates FK constraint
```

### Fixed State

```
┌─────────────────────┐     ┌─────────────────────┐
│   auth.users        │     │  public.projects    │
│                     │     │                     │
│  id (UUID) PK       │────┐│  id (UUID) PK       │
│  email              │    ││  owner_id (UUID)    │
│  ...                │    ││    FK → user_profiles│
└─────────────────────┘    │└─────────────────────┘
         │                 │         │
         │ TRIGGER         │         │ FK Reference
         │ auto-inserts    │         ▼
         ▼                 │┌─────────────────────┐
┌─────────────────────┐    ││  user_profiles      │
│  ON INSERT:         │    ││                     │
│  user_profiles      │────┘│  id (UUID) PK       │
│  (NEW.id, email)    │     │    FK → auth.users  │
└─────────────────────┘     │  email              │
                           └─────────────────────┘

SOLUTION:
- Trigger ensures user_profiles row exists for every auth.users row
- Foreign key constraint is satisfied
- RLS policy can find user in user_profiles table
```

---

## Error Information Loss Cascade

```
Level 1: DATABASE
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL Error                                            │
│ {                                                           │
│   code: "23503",                                            │
│   message: "insert or update on table projects violates...",│
│   details: "Key (owner_id)=(uuid) not present in...",      │
│   hint: "Ensure user_profiles record exists"               │
│ }                                                           │
│                                                             │
│ Information Level: ████████████████████ 100%               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ Lost 30%
Level 2: SUPABASE CLIENT
┌─────────────────────────────────────────────────────────────┐
│ Supabase Error                                              │
│ {                                                           │
│   code: "23503",                                            │
│   message: "insert or update on table projects violates...",│
│   details: "Key (owner_id)=..."                             │
│   // hint field may be stripped                            │
│ }                                                           │
│                                                             │
│ Information Level: ██████████████░░░░░░ 70%                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ Lost 60%
Level 3: DATABASE SERVICE
┌─────────────────────────────────────────────────────────────┐
│ DatabaseService                                             │
│                                                             │
│ logger.error('Error creating project:', error)             │
│ return null  ← ALL CONTEXT LOST                            │
│                                                             │
│ Information Level: ████░░░░░░░░░░░░░░░░ 10%                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ Lost 95%
Level 4: HOOK LAYER
┌─────────────────────────────────────────────────────────────┐
│ useProjectCreation                                          │
│                                                             │
│ if (!project) {                                             │
│   throw new Error('Failed to create project')              │
│ }                                                           │
│ // No error code, no details, no hint                      │
│                                                             │
│ Information Level: ██░░░░░░░░░░░░░░░░░░ 5%                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ Lost 100%
Level 5: USER INTERFACE
┌─────────────────────────────────────────────────────────────┐
│ AIStarterModal                                              │
│                                                             │
│ setError("Failed to create project and ideas. Try again.")  │
│                                                             │
│ // User has ZERO technical information                     │
│ // Support team has to reproduce issue                     │
│ // Developer has to check server logs                      │
│                                                             │
│ Information Level: ░░░░░░░░░░░░░░░░░░░░ 0%                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Recommendations Summary

### Database Layer
1. ✅ Create `user_profiles` table with FK to `auth.users`
2. ✅ Add trigger to auto-create profile on user registration
3. ✅ Backfill existing users into `user_profiles`
4. ✅ Update FK constraint on `projects.owner_id`
5. ✅ Fix RLS policies to use `user_profiles`
6. ✅ Add atomic transaction support via database function

### Code Layer
1. ✅ Replace null returns with thrown exceptions
2. ✅ Log full Supabase error details (code, message, details, hint)
3. ✅ Create `DatabaseError` class for structured errors
4. ✅ Add retry logic with exponential backoff
5. ✅ Implement atomic project+ideas creation
6. ✅ Add pre-flight validation checks

### User Experience
1. ✅ Provide specific error messages based on error codes
2. ✅ Add loading states during creation
3. ✅ Show progress for multi-step operations
4. ✅ Add "Report Issue" button to error messages
5. ✅ Log errors to error tracking service (Sentry/LogRocket)

### Monitoring
1. ✅ Track project creation success rate
2. ✅ Alert on error rate >1%
3. ✅ Monitor creation time (should be <500ms)
4. ✅ Track partial success scenarios
5. ✅ Dashboard for database error codes
