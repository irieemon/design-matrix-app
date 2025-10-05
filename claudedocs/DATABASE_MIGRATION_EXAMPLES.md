# Database Migration Examples

Quick reference guide for migrating from monolithic DatabaseService to modular architecture.

## Migration Approaches

### ✅ NO MIGRATION REQUIRED (Default)

Your existing code continues to work without any changes:

```typescript
// This still works exactly the same - 100% backward compatible
import { DatabaseService } from '@/lib/database'

const ideas = await DatabaseService.getProjectIdeas(projectId)
const success = await DatabaseService.lockIdeaForEditing(ideaId, userId)
```

**When to use:** Always safe, no rush to migrate existing code.

### 📈 GRADUAL MIGRATION (Recommended for New Features)

New code can use modern patterns with better type safety:

```typescript
// Old way (still works)
import { DatabaseService } from '@/lib/database'
const ideas = await DatabaseService.getProjectIdeas(projectId)

// New way (better type safety)
import { IdeaService } from '@/lib/database'
const result = await IdeaService.getIdeasByProject(projectId)
if (result.success) {
  console.log(result.data) // IdeaCard[]
} else {
  console.error(result.error.message)
}
```

**When to use:** New features, bug fixes, or refactoring existing code.

---

## Common Patterns

### Pattern 1: Idea CRUD Operations

#### Before (Monolithic)
```typescript
import { DatabaseService } from '@/lib/database'

// Get ideas
const ideas = await DatabaseService.getProjectIdeas(projectId)

// Create idea
const response = await DatabaseService.createIdea({
  title: 'New Feature',
  description: 'Description',
  project_id: projectId
})

// Update idea
const updated = await DatabaseService.updateIdea(ideaId, {
  title: 'Updated Title'
})

// Delete idea
const deleted = await DatabaseService.deleteIdea(ideaId)
```

#### After (Modular)
```typescript
import { IdeaService } from '@/lib/database'

// Get ideas with full result handling
const result = await IdeaService.getIdeasByProject(projectId)
if (result.success) {
  const ideas = result.data // Type: IdeaCard[]
} else {
  console.error(result.error)
}

// Create idea with validation
const createResult = await IdeaService.createIdea({
  title: 'New Feature',
  description: 'Description',
  project_id: projectId
})
if (createResult.success) {
  const newIdea = createResult.data
}

// Update idea
const updateResult = await IdeaService.updateIdea(ideaId, {
  title: 'Updated Title'
})

// Delete idea
const deleteResult = await IdeaService.deleteIdea(ideaId)
```

**Benefits:**
- Full type safety with ServiceResult<T>
- Explicit error handling
- Better IDE autocomplete

### Pattern 2: Idea Locking

#### Before (Monolithic)
```typescript
import { DatabaseService } from '@/lib/database'

// Lock idea
const locked = await DatabaseService.lockIdeaForEditing(ideaId, userId)
if (!locked) {
  alert('Idea is locked by another user')
  return
}

// Do editing...

// Unlock idea
await DatabaseService.unlockIdea(ideaId, userId)
```

#### After (Modular)
```typescript
import { IdeaLockingService } from '@/lib/database'

// Lock idea with better control
const locked = await IdeaLockingService.lockIdeaForEditing(ideaId, userId)
if (!locked) {
  alert('Idea is locked by another user')
  return
}

// Check lock status
const lockInfo = await IdeaLockingService.getLockInfo(ideaId)
if (lockInfo.isLocked) {
  console.log(`Locked by ${lockInfo.lockedBy} until ${lockInfo.expiresAt}`)
}

// Do editing...

// Unlock idea
await IdeaLockingService.unlockIdea(ideaId, userId)
```

**Benefits:**
- Dedicated locking service
- Additional methods like `getLockInfo()`, `canUserEdit()`
- Better control over lock state

### Pattern 3: Real-time Subscriptions

#### Before (Monolithic)
```typescript
import { DatabaseService } from '@/lib/database'

// Subscribe to ideas
const unsubscribe = DatabaseService.subscribeToIdeas(
  (ideas) => {
    setIdeas(ideas)
  },
  projectId
)

// Cleanup
return () => unsubscribe()
```

#### After (Modular - Internal Only)
```typescript
import { DatabaseService } from '@/lib/database'

// Same API - subscription manager is internal detail
const unsubscribe = DatabaseService.subscribeToIdeas(
  (ideas) => {
    setIdeas(ideas)
  },
  projectId
)

// Cleanup
return () => unsubscribe()
```

**Note:** Subscriptions continue to use DatabaseService facade as the manager is an internal implementation detail.

### Pattern 4: Project Management

#### Before (Monolithic)
```typescript
import { DatabaseService } from '@/lib/database'

// Get projects
const projects = await DatabaseService.getUserOwnedProjects(userId)

// Create project
const project = await DatabaseService.createProject({
  name: 'New Project',
  owner_id: userId,
  project_type: 'product',
  status: 'active',
  visibility: 'private',
  priority_level: 'medium'
})

// Update project
const updated = await DatabaseService.updateProject(projectId, {
  name: 'Updated Name'
})

// Delete project
const deleted = await DatabaseService.deleteProject(projectId)
```

#### After (Modular)
```typescript
import { ProjectService } from '@/lib/database'

// Get projects with result handling
const result = await ProjectService.getUserOwnedProjects(userId)
if (result.success) {
  const projects = result.data
}

// Create project with validation
const createResult = await ProjectService.createProject({
  name: 'New Project',
  owner_id: userId,
  project_type: 'product',
  status: 'active',
  visibility: 'private',
  priority_level: 'medium'
})

// Update project
const updateResult = await ProjectService.updateProject(projectId, {
  name: 'Updated Name'
})

// Delete project
const deleteResult = await ProjectService.deleteProject(projectId)
```

**Benefits:**
- ServiceResult<T> for consistent error handling
- Validation built into service methods
- Better testability

### Pattern 5: Collaboration

#### Before (Monolithic)
```typescript
import { DatabaseService } from '@/lib/database'

// Add collaborator
const added = await DatabaseService.addProjectCollaborator(
  projectId,
  'user@example.com',
  'editor',
  currentUserId,
  'Project Name',
  'Inviter Name',
  'inviter@example.com'
)

// Get collaborators
const collaborators = await DatabaseService.getProjectCollaborators(projectId)

// Update role
const updated = await DatabaseService.updateCollaboratorRole(
  projectId,
  userId,
  'viewer'
)

// Remove collaborator
const removed = await DatabaseService.removeProjectCollaborator(projectId, userId)
```

#### After (Modular)
```typescript
import { CollaborationService } from '@/lib/database'

// Add collaborator with structured input
const result = await CollaborationService.addProjectCollaborator({
  projectId,
  userEmail: 'user@example.com',
  role: 'editor',
  invitedBy: currentUserId,
  projectName: 'Project Name',
  inviterName: 'Inviter Name',
  inviterEmail: 'inviter@example.com'
})

// Get collaborators
const collabResult = await CollaborationService.getProjectCollaborators(projectId)
if (collabResult.success) {
  const collaborators = collabResult.data
}

// Update role
const updateResult = await CollaborationService.updateCollaboratorRole(
  projectId,
  userId,
  'viewer'
)

// Remove collaborator
const removeResult = await CollaborationService.removeProjectCollaborator(
  projectId,
  userId
)
```

**Benefits:**
- Structured input objects (easier to maintain)
- Full ServiceResult error handling
- Better type safety

### Pattern 6: Roadmaps

#### Before (Monolithic)
```typescript
import { DatabaseService } from '@/lib/database'

// Save roadmap
const roadmapId = await DatabaseService.saveProjectRoadmap(
  projectId,
  roadmapData,
  userId,
  ideasCount
)

// Get roadmaps
const roadmaps = await DatabaseService.getProjectRoadmaps(projectId)

// Get specific roadmap
const roadmap = await DatabaseService.getProjectRoadmap(roadmapId)

// Update roadmap
const updated = await DatabaseService.updateProjectRoadmap(
  roadmapId,
  updatedData
)
```

#### After (Modular - Direct Repository Access)
```typescript
import { RoadmapRepository } from '@/lib/database'

// Save roadmap with auto-versioning
const roadmapId = await RoadmapRepository.saveProjectRoadmap(
  projectId,
  roadmapData,
  userId,
  ideasCount
)

// Get all roadmaps (sorted by version)
const roadmaps = await RoadmapRepository.getProjectRoadmaps(projectId)

// Get specific roadmap
const roadmap = await RoadmapRepository.getProjectRoadmap(roadmapId)

// Get latest version only
const latest = await RoadmapRepository.getLatestRoadmap(projectId)

// Update roadmap
const updated = await RoadmapRepository.updateProjectRoadmap(
  roadmapId,
  updatedData
)

// Delete roadmap
const deleted = await RoadmapRepository.deleteProjectRoadmap(roadmapId)
```

**Benefits:**
- New `getLatestRoadmap()` method
- New `deleteProjectRoadmap()` method
- Direct repository access for advanced queries

### Pattern 7: Insights

#### Before (Monolithic)
```typescript
import { DatabaseService } from '@/lib/database'

// Save insights
const insightId = await DatabaseService.saveProjectInsights(
  projectId,
  insightsData,
  userId,
  ideasCount
)

// Get insights
const insights = await DatabaseService.getProjectInsights(projectId)

// Get specific insight
const insight = await DatabaseService.getProjectInsight(insightId)
```

#### After (Modular - Direct Repository Access)
```typescript
import { InsightsRepository } from '@/lib/database'

// Save insights with auto-versioning
const insightId = await InsightsRepository.saveProjectInsights(
  projectId,
  insightsData,
  userId,
  ideasCount
)

// Get all insights (sorted by version)
const insights = await InsightsRepository.getProjectInsights(projectId)

// Get specific insight
const insight = await InsightsRepository.getProjectInsight(insightId)

// Get latest version only
const latest = await InsightsRepository.getLatestInsight(projectId)

// Update insight
const updated = await InsightsRepository.updateProjectInsight(
  insightId,
  updatedData
)

// Delete insight
const deleted = await InsightsRepository.deleteProjectInsight(insightId)
```

**Benefits:**
- New `getLatestInsight()` method
- New `updateProjectInsight()` method
- New `deleteProjectInsight()` method

---

## Utility Usage

### Validation Helpers

```typescript
import { ValidationHelpers } from '@/lib/database'

// Validate IDs
const projectId = ValidationHelpers.validateProjectId(rawProjectId)
if (!projectId) {
  throw new Error('Invalid project ID')
}

const userId = ValidationHelpers.validateUserId(rawUserId)
if (!userId) {
  throw new Error('Invalid user ID')
}

// Validate email
if (!ValidationHelpers.validateEmail(email)) {
  throw new Error('Invalid email format')
}

// Validate UUID
if (!ValidationHelpers.validateUUID(uuid)) {
  throw new Error('Invalid UUID format')
}

// Validate role
if (!ValidationHelpers.validateProjectRole(role)) {
  throw new Error('Invalid project role')
}
```

### Database Helpers

```typescript
import { DatabaseHelpers } from '@/lib/database'

// Throttled logging (reduces console spam)
DatabaseHelpers.throttledLog(
  'operation-key',
  'Operation message',
  { data },
  1000 // throttle ms
)

// Error handling
try {
  // database operation
} catch (error) {
  const dbError = DatabaseHelpers.handleDatabaseError(error, 'operationName')
  console.error(dbError.message)
  console.error(dbError.code) // NOT_FOUND, DUPLICATE_KEY, etc.
}

// Timestamp formatting
const timestamp = DatabaseHelpers.formatTimestamp() // ISO string
const customTimestamp = DatabaseHelpers.formatTimestamp(new Date('2025-01-01'))

// Error type checking
if (DatabaseHelpers.isNotFoundError(error)) {
  // handle not found
}
if (DatabaseHelpers.isPermissionError(error)) {
  // handle permission denied
}
if (DatabaseHelpers.isDuplicateKeyError(error)) {
  // handle duplicate
}
```

---

## React Hook Patterns

### Custom Hook with New Services

```typescript
// hooks/useIdeasModern.ts
import { useEffect, useState } from 'react'
import { IdeaService } from '@/lib/database'
import type { IdeaCard, ServiceResult } from '@/types'

export function useIdeasModern(projectId: string) {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchIdeas() {
      setLoading(true)
      setError(null)

      const result = await IdeaService.getIdeasByProject(projectId)

      if (result.success) {
        setIdeas(result.data)
      } else {
        setError(result.error.message)
      }

      setLoading(false)
    }

    fetchIdeas()
  }, [projectId])

  return { ideas, loading, error }
}
```

### Custom Hook with Locking

```typescript
// hooks/useIdeaLocking.ts
import { useEffect, useCallback } from 'react'
import { IdeaLockingService } from '@/lib/database'

export function useIdeaLocking(ideaId: string, userId: string, isEditing: boolean) {
  const acquireLock = useCallback(async () => {
    if (!isEditing) return false
    return await IdeaLockingService.lockIdeaForEditing(ideaId, userId)
  }, [ideaId, userId, isEditing])

  const releaseLock = useCallback(async () => {
    await IdeaLockingService.unlockIdea(ideaId, userId)
  }, [ideaId, userId])

  useEffect(() => {
    if (isEditing) {
      acquireLock()
    }

    return () => {
      if (isEditing) {
        releaseLock()
      }
    }
  }, [isEditing, acquireLock, releaseLock])

  return { acquireLock, releaseLock }
}
```

---

## Testing Examples

### Unit Test for Service

```typescript
// IdeaService.test.ts
import { IdeaService } from '@/lib/database'

describe('IdeaService', () => {
  it('should fetch ideas successfully', async () => {
    const result = await IdeaService.getIdeasByProject('project-123')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true)
    }
  })

  it('should handle errors gracefully', async () => {
    const result = await IdeaService.getIdeasByProject('invalid-id')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBeDefined()
      expect(result.error.message).toBeDefined()
    }
  })
})
```

### Integration Test for Facade

```typescript
// DatabaseService.test.ts
import { DatabaseService } from '@/lib/database'
import { IdeaService } from '@/lib/database'

describe('DatabaseService facade', () => {
  it('should delegate to IdeaService', async () => {
    const spy = jest.spyOn(IdeaService, 'getIdeasByProject')

    await DatabaseService.getProjectIdeas('project-123')

    expect(spy).toHaveBeenCalledWith('project-123', undefined)
  })
})
```

---

## Migration Checklist

### For Existing Code (Optional)
- [ ] Identify DatabaseService usage
- [ ] Determine if migration adds value
- [ ] Replace imports if migrating
- [ ] Update error handling to use ServiceResult
- [ ] Test thoroughly
- [ ] Deploy gradually

### For New Code (Recommended)
- [x] Use modular imports from barrel export
- [x] Use ServiceResult for error handling
- [x] Use ValidationHelpers for input validation
- [x] Use specific services/repositories directly
- [x] Write unit tests for service usage
- [x] Document patterns in team docs

---

## Summary

**Key Takeaways:**

1. **No Migration Required** - All existing code continues to work
2. **Gradual Adoption** - Migrate when it makes sense, not urgently
3. **Better Type Safety** - New patterns provide stronger typing
4. **Easier Testing** - Modular services are easier to test
5. **Clearer Intent** - Direct imports show what you're using

**When to Migrate:**
- ✅ New features - always use new patterns
- ✅ Bug fixes - consider migrating while fixing
- ✅ Refactoring - good opportunity to modernize
- ⚠️ Stable code - only if adding value

**When NOT to Migrate:**
- ❌ Just for the sake of it
- ❌ On tight deadlines
- ❌ Without testing
- ❌ Without understanding benefits

**Remember:** The facade ensures backward compatibility. Take your time with migration!
