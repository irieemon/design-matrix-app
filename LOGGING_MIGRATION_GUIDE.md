## Logging Service Migration Guide

**Goal:** Replace all 210 console.log/warn/error statements with the new structured logging service.

---

## Quick Start

### 1. Import the Logger

```typescript
// For React components
import { useLogger } from '@/lib/logging'

// For vanilla TypeScript
import { logger } from '@/lib/logging'
```

### 2. Replace Console Statements

**Before:**
```typescript
console.log('User logged in', userId)
```

**After:**
```typescript
logger.info('User logged in', { userId })
```

---

## Common Migration Patterns

### Pattern 1: Simple Console Logs

**Before:**
```typescript
console.log('Processing data...')
console.log('Data:', data)
```

**After:**
```typescript
logger.debug('Processing data')
logger.debug('Data processed', { data })
```

### Pattern 2: Console with Emojis/Formatting

**Before:**
```typescript
console.log('🎯 Project: Setting currentProject to:', project)
console.log('💥 Project: Project restoration error:', error)
```

**After:**
```typescript
const logger = useLogger('ProjectContext')
logger.info('Setting current project', { projectId: project.id, projectName: project.name })
logger.error('Project restoration failed', error, { projectId })
```

### Pattern 3: Performance Monitoring

**Before:**
```typescript
console.warn('🚨 PERFORMANCE_ALERT:', JSON.stringify(alertData))
console.error(`Authentication is taking ${avgTime.toFixed(0)}ms`)
```

**After:**
```typescript
const perfLogger = usePerformanceLogger('AuthMonitor')
perfLogger.start('authentication')
// ... operation
end()

// Or for alerts
logger.warn('Performance threshold exceeded', {
  operation: 'authentication',
  avgTime,
  threshold: 2000,
  successRate
})
```

### Pattern 4: Debug Logging in Development

**Before:**
```typescript
console.log('Capturing element with computed styles...')
console.log('Element visibility:', computedStyle.visibility)
console.log('Element display:', computedStyle.display)
```

**After:**
```typescript
const logger = useLogger('RoadmapExport')
logger.debug('Capturing element', {
  visibility: computedStyle.visibility,
  display: computedStyle.display,
  opacity: computedStyle.opacity
})
```

### Pattern 5: Error Logging

**Before:**
```typescript
console.error('API call failed:', error)
console.error('Failed to process:', error.message)
```

**After:**
```typescript
logger.error('API call failed', error, {
  endpoint: '/api/projects',
  method: 'POST',
  userId: currentUser?.id
})
```

### Pattern 6: Conditional Logging

**Before:**
```typescript
if (import.meta.env.DEV) {
  console.log('Debug info:', data)
}
```

**After:**
```typescript
logger.debug('Debug info', { data })
// Automatically filtered in production
```

---

## React Component Migration

### useLogger Hook

```typescript
import { useLogger } from '@/lib/logging'

function MyComponent() {
  const logger = useLogger('MyComponent')

  useEffect(() => {
    logger.debug('Component mounted')

    return () => {
      logger.debug('Component unmounting')
    }
  }, [])

  const handleClick = () => {
    logger.info('Button clicked', { buttonId: 'submit' })
  }

  const handleError = (error: Error) => {
    logger.error('Operation failed', error, { operation: 'submit' })
  }

  return <button onClick={handleClick}>Submit</button>
}
```

### Performance Logging in Components

```typescript
import { usePerformanceLogger } from '@/lib/logging'

function DataTable() {
  const perfLogger = usePerformanceLogger('DataTable')

  const fetchData = async () => {
    const end = perfLogger.start('fetch_data')
    try {
      const data = await api.fetchData()
      end() // Success
      return data
    } catch (error) {
      end() // Still records duration, marks as failure
      throw error
    }
  }

  // Or use measure for cleaner syntax
  const fetchDataAlt = () => {
    return perfLogger.measure('fetch_data', () => api.fetchData())
  }
}
```

---

## File-by-File Migration Examples

### authPerformanceMonitor.ts (7 statements)

**Before:**
```typescript
console.warn('🚨 PERFORMANCE_ALERT:', JSON.stringify(alertData))
console.error('🚨 RELIABILITY_ALERT:', JSON.stringify(alertData))
console.error(`Authentication is taking ${avgTime.toFixed(0)}ms on average`)
console.error(`Success rate is ${(successRate * 100).toFixed(1)}%`)
console.error('This affects user experience and should be addressed immediately')
console.log(report)
console.warn('Failed to generate performance report:', error)
```

**After:**
```typescript
import { logger } from '@/lib/logging'

const perfLogger = logger.withContext({ component: 'AuthPerformanceMonitor' })

// Performance alert
perfLogger.warn('Performance threshold exceeded', {
  avgTime,
  threshold: 2000,
  metric: 'authentication_time',
  severity: 'high'
})

// Reliability alert
perfLogger.error('Reliability threshold breached', {
  successRate,
  threshold: 0.95,
  metric: 'auth_success_rate',
  severity: 'critical'
})

// Detailed metrics
perfLogger.error('Authentication performance degraded', {
  avgTime,
  successRate,
  impact: 'user_experience',
  action_required: true
})

// Report
perfLogger.debug('Performance report generated', { report })

// Error
perfLogger.warn('Report generation failed', error)
```

### ProjectContext.tsx (4 statements)

**Before:**
```typescript
console.log('🎯 Project: Setting currentProject to:', project)
console.log('❌ Project: Project restoration failed for:', projectId)
console.log('💥 Project: Project restoration timed out after 5 seconds')
console.log('💥 Project: Project restoration error:', error)
```

**After:**
```typescript
import { useLogger } from '@/lib/logging'

function ProjectContext() {
  const logger = useLogger('ProjectContext')

  // Setting project
  logger.info('Setting current project', {
    projectId: project.id,
    projectName: project.name,
    ownerId: project.owner_id
  })

  // Restoration failed
  logger.warn('Project restoration failed', {
    projectId,
    reason: 'not_found'
  })

  // Timeout
  logger.error('Project restoration timed out', {
    projectId,
    timeout: 5000,
    reason: 'timeout'
  })

  // Error
  logger.error('Project restoration error', error, {
    projectId,
    operation: 'restore'
  })
}
```

### roadmapExport.ts (25 statements)

**Before:**
```typescript
console.log('Capturing element with computed styles...')
console.log('Element visibility:', computedStyle.visibility)
console.log('Element display:', computedStyle.display)
console.log('Element opacity:', computedStyle.opacity)
console.log('html2canvas options:', defaultOptions)
console.log('Creating PDF from canvas...')
console.log('Canvas has visible content:', hasContent)
console.log('Image data URL length:', imgData.length)
console.log('Adding image to PDF:', { x, y, imgWidth, imgHeight })
console.log('Starting multi-page PDF export with options:', options)
console.log('Found page containers:', pageContainers.length)
console.log(`Processing page ${i + 1}/${pageContainers.length}`)
// ... etc
```

**After:**
```typescript
import { logger } from '@/lib/logging'

const exportLogger = logger.withContext({ component: 'RoadmapExport' })

// Capture element
exportLogger.debug('Capturing element', {
  visibility: computedStyle.visibility,
  display: computedStyle.display,
  opacity: computedStyle.opacity
})

// Canvas options
exportLogger.debug('html2canvas configuration', { options: defaultOptions })

// PDF creation
exportLogger.debug('Creating PDF from canvas')

// Validation
exportLogger.debug('Canvas content validation', {
  hasContent,
  imageDataLength: imgData.length
})

// PDF layout
exportLogger.debug('Adding image to PDF', { x, y, imgWidth, imgHeight })

// Multi-page export
exportLogger.info('Starting multi-page PDF export', {
  pageCount: pageContainers.length,
  options
})

// Page processing (use array index instead of console in loop)
exportLogger.debug(`Processing page ${i + 1}/${pageContainers.length}`, {
  pageIndex: i,
  totalPages: pageContainers.length
})
```

---

## Testing Migration

### Test Files

For test files, you can still use console.log for test output, OR use the logger:

```typescript
import { logger } from '@/lib/logging'

describe('MyComponent', () => {
  it('should render correctly', () => {
    logger.debug('Test: Rendering component')
    // ... test code
  })
})
```

Note: Logger automatically filters debug logs in test environment unless debug mode is enabled.

---

## Context Provider (Optional)

For app-wide context (userId, projectId), wrap your app:

```typescript
import { LoggingProvider } from '@/lib/logging'

function App() {
  const { user } = useUser()
  const { project } = useProject()

  return (
    <LoggingProvider value={{ userId: user?.id, projectId: project?.id }}>
      <AppContent />
    </LoggingProvider>
  )
}
```

Then all useLogger calls automatically include this context.

---

## ESLint Rule (Prevent Future Console Usage)

Add to `.eslintrc.json`:

```json
{
  "rules": {
    "no-console": [
      "error",
      {
        "allow": ["warn", "error"]
      }
    ]
  }
}
```

This prevents new `console.log` but allows `console.warn/error` for critical issues.

---

## Migration Checklist

### Phase 1: High-Priority (Week 1)
- [ ] authPerformanceMonitor.ts (7 statements)
- [ ] matrixPerformanceMonitor.ts (1 statement)
- [ ] ErrorBoundary.tsx (1 statement)
- [ ] ProjectContext.tsx (4 statements)
- [ ] NavigationContext.tsx (1 statement)

**Total: 14 statements (~7%)**

### Phase 2: Medium-Priority (Week 2)
- [ ] roadmapExport.ts (25 statements)
- [ ] pdfExportSimple.ts (4 statements)
- [ ] TimelineRoadmap.tsx (5 statements)
- [ ] RoadmapExportModal.tsx (16 statements)
- [ ] aiService.ts (1 statement)
- [ ] openaiModelRouter.ts (1 statement)
- [ ] aiInsightsService.ts (1 statement)

**Total: 53 statements (~25%)**

### Phase 3: Remaining (Weeks 3-4)
- [ ] All component console statements (~80 statements)
- [ ] All hook console statements (~40 statements)
- [ ] Development tools (~15 statements)

**Total: 135 statements (~64%)**

### Phase 4: Cleanup (Week 5)
- [ ] Test files (~8 statements)
- [ ] Final validation
- [ ] Enable ESLint rule

**Total: 8 statements (~4%)**

---

## Verification

### Check Migration Progress

```bash
# Count remaining console statements
grep -r "console\.(log|warn|error|debug)" src --include="*.ts" --include="*.tsx" | wc -l
```

### Run Tests

```bash
npm test src/lib/logging
```

### Validate in Browser

```typescript
// Open browser console
import { getLoggingStats } from '@/lib/logging'

// Check statistics
console.log(getLoggingStats())

// Toggle debug mode
setDebugMode(true)  // Enable verbose logging
setDebugMode(false) // Back to production mode
```

---

## Troubleshooting

### Issue: "Too many logs in development"

**Solution:** Disable debug mode
```typescript
// Add to URL: ?debug=false
// Or in console:
setDebugMode(false)
```

### Issue: "Not seeing my logs"

**Solution:** Check log level
```typescript
// Logs are filtered based on environment
// Development: info, warn, error, debug (if enabled)
// Production: warn, error only
// Use appropriate level for your message
```

### Issue: "Performance impact"

**Solution:** The logger has minimal overhead due to:
- Rate limiting (limits logs per second)
- Throttling (deduplicates repeated messages)
- Lazy evaluation (only processes if level is enabled)

---

## Best Practices

1. **Use Appropriate Levels:**
   - `debug`: Detailed diagnostic information (dev only)
   - `info`: General informational messages
   - `warn`: Warning messages (potential issues)
   - `error`: Error messages (actual failures)

2. **Include Context:**
   ```typescript
   // Bad
   logger.info('Processing')

   // Good
   logger.info('Processing user data', {
     userId,
     recordCount,
     operation: 'import'
   })
   ```

3. **Use Structured Data:**
   ```typescript
   // Bad
   logger.info(`User ${userId} performed ${action}`)

   // Good
   logger.info('User action', { userId, action, timestamp: Date.now() })
   ```

4. **Performance Logging:**
   ```typescript
   // Use dedicated performance logger
   const perfLogger = usePerformanceLogger('MyComponent')
   const result = await perfLogger.measure('api_call', () => api.fetch())
   ```

5. **Component Names:**
   ```typescript
   // Always specify component name
   const logger = useLogger('MyComponent')
   ```

---

## Support

Questions? Check:
- `LOGGING_SERVICE_ARCHITECTURE.md` - Full architecture details
- `src/lib/logging/types.ts` - TypeScript types
- `src/lib/logging/__tests__/LoggingService.test.ts` - Usage examples

---

*Happy Logging! 🎯*
