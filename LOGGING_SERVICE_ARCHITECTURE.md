# Logging Service Architecture

## Analysis Summary

### Current State
- **210 console statements** across 42 files
- **Existing logger.ts** with basic functionality (rate limiting, throttling, debug mode)
- **Underutilized** - most code still uses raw console.log

### Console Usage Categories

| Category | Files | Primary Purpose | Examples |
|----------|-------|-----------------|----------|
| Performance Monitoring | 3 | Track metrics, alerts | authPerformanceMonitor, matrixPerformanceMonitor |
| Debug Components | 2 | Dev tools, console wrapping | AuthDebugMonitor, ComponentShowcase |
| Export/PDF | 3 | Debug PDF generation | roadmapExport, pdfExportSimple |
| Component State | 8 | Track component lifecycle | ProjectContext, useIdeas, MatrixCanvas |
| Error Boundaries | 2 | Error tracking | ErrorBoundary, test helpers |
| AI Services | 2 | AI operation logging | aiService, openaiModelRouter |
| Development Tools | 5 | Test pages, performance overlays | PerformanceDashboard, testLocking |
| Tests | 5 | Test assertions, debugging | Various __tests__ files |

### Key Insights
1. **Performance monitoring** is the heaviest user (60+ statements)
2. **Export/PDF** features have verbose debugging (25+ statements)
3. **Component state tracking** scattered across contexts and hooks
4. Existing logger has good foundation but needs enhancement

---

## Enhanced Architecture Design

### Goals
1. ✅ **Zero Breaking Changes** - Gradual migration
2. ✅ **Production Safe** - No sensitive data leakage
3. ✅ **Developer Friendly** - Better DX than console.log
4. ✅ **Type Safe** - Full TypeScript support
5. ✅ **Structured** - Contextual metadata, not just strings
6. ✅ **Extensible** - Future remote logging support
7. ✅ **Performant** - Minimal runtime overhead

### Architecture Components

```
src/lib/logging/
├── LoggingService.ts       # Core service (enhanced logger)
├── types.ts                # TypeScript interfaces
├── contexts/
│   ├── ComponentContext.ts # React component context
│   ├── PerformanceContext.ts # Performance-specific
│   └── ErrorContext.ts     # Error tracking
├── hooks/
│   ├── useLogger.ts        # Main React hook
│   └── usePerformanceLogger.ts # Performance tracking
├── utils/
│   ├── formatters.ts       # Log formatting
│   └── transport.ts        # Future: remote logging
└── __tests__/
    └── LoggingService.test.ts
```

---

## Core Service Design

### LoggingService Class

```typescript
class LoggingService {
  // Levels: DEBUG, INFO, WARN, ERROR
  // Environment-aware filtering
  // Rate limiting & throttling
  // Structured logging support
  // Context metadata
  // Remote transport (future)
}
```

### Key Features

#### 1. Structured Logging
```typescript
logger.info('User action', {
  action: 'project_created',
  userId: user.id,
  projectId: project.id,
  timestamp: Date.now()
})
```

#### 2. Component Context
```typescript
const logger = useLogger('MatrixCanvas')
logger.debug('Rendering matrix', { ideaCount, quadrants })
```

#### 3. Performance Logging
```typescript
const perfLogger = usePerformanceLogger('AuthFlow')
const end = perfLogger.start('authentication')
// ... auth logic
end({ success: true, duration: 1234 })
```

#### 4. Error Context
```typescript
logger.error('API call failed', error, {
  endpoint: '/api/projects',
  method: 'POST',
  userId: currentUser?.id
})
```

---

## TypeScript Types

```typescript
// Log Levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// Structured log entry
interface LogEntry {
  level: LogLevel
  message: string
  timestamp: number
  context?: LogContext
  data?: Record<string, unknown>
  error?: Error
}

// Contextual metadata
interface LogContext {
  component?: string      // Component name
  userId?: string         // Current user
  projectId?: string      // Current project
  action?: string         // User action
  environment?: 'dev' | 'prod'
  sessionId?: string      // User session
}

// Performance metrics
interface PerformanceMetric {
  operation: string
  duration: number
  success: boolean
  metadata?: Record<string, unknown>
}
```

---

## React Integration

### useLogger Hook

```typescript
function useLogger(component?: string): Logger {
  const context = useContext(LogContext)

  return useMemo(() => ({
    debug: (msg, data?) => service.log('debug', msg, { ...context, component }, data),
    info: (msg, data?) => service.log('info', msg, { ...context, component }, data),
    warn: (msg, data?) => service.log('warn', msg, { ...context, component }, data),
    error: (msg, error?, data?) => service.log('error', msg, { ...context, component }, data, error)
  }), [context, component])
}
```

### Usage Example

```typescript
function MatrixCanvas() {
  const logger = useLogger('MatrixCanvas')

  useEffect(() => {
    logger.debug('Matrix mounted', { ideaCount: ideas.length })

    return () => {
      logger.debug('Matrix unmounting')
    }
  }, [])

  const handleDrop = (idea) => {
    logger.info('Idea dropped', { ideaId: idea.id, quadrant })
  }

  const handleError = (error) => {
    logger.error('Rendering failed', error, { ideaCount: ideas.length })
  }
}
```

---

## Environment Strategy

### Development Mode
- ✅ All log levels visible
- ✅ Colorful console output
- ✅ Stack traces included
- ✅ Performance metrics shown
- ✅ Debug mode toggleable via URL (?debug=true)

### Production Mode
- ✅ Only WARN and ERROR levels
- ✅ Sanitized output (no sensitive data)
- ✅ Error reporting to remote service (future)
- ✅ Performance metrics aggregated (future)

---

## Migration Strategy

### Phase 1: Foundation (Week 1)
**Goal:** Deploy enhanced logging service, no disruption

1. Enhance existing `logger.ts` → `LoggingService.ts`
2. Add TypeScript types and interfaces
3. Create `useLogger` hook
4. Write comprehensive tests
5. Update documentation

**Impact:** Zero - backwards compatible

### Phase 2: High-Value Replacements (Week 2)
**Goal:** Replace console in critical paths

**Priority Targets:**
1. Performance monitors (60+ statements)
   - `authPerformanceMonitor.ts`
   - `matrixPerformanceMonitor.ts`

2. Error boundaries (5+ statements)
   - `ErrorBoundary.tsx`

3. Core contexts (10+ statements)
   - `ProjectContext.tsx`
   - `NavigationContext.tsx`

**Expected Impact:** 75+ statements replaced (~35%)

### Phase 3: Component Migration (Weeks 3-4)
**Goal:** Replace remaining component console usage

**Targets:**
1. Export/PDF utilities (25+ statements)
2. AI services (15+ statements)
3. React components (30+ statements)
4. Hooks (20+ statements)

**Expected Impact:** 165+ statements replaced (~78%)

### Phase 4: Cleanup (Week 5)
**Goal:** Remove remaining console statements

1. Test files (15+ statements) - migrate to proper test logging
2. Development tools (10+ statements) - use logger
3. Final cleanup and validation

**Expected Impact:** 210 statements replaced (100%)

---

## Implementation Plan

### Step 1: Core Service (6-8 hours)
- [ ] Enhance LoggingService with structured logging
- [ ] Add context metadata support
- [ ] Implement formatters (dev vs prod)
- [ ] Add TypeScript types
- [ ] Write comprehensive unit tests

### Step 2: React Integration (4-6 hours)
- [ ] Create useLogger hook
- [ ] Create usePerformanceLogger hook
- [ ] Add LogContext provider
- [ ] Create example usage patterns
- [ ] Document best practices

### Step 3: Migration Tooling (2-3 hours)
- [ ] Create migration guide
- [ ] Build code-mod helpers (optional)
- [ ] Add ESLint rule to prevent console.log
- [ ] Setup CI checks

### Step 4: High-Value Migration (8-12 hours)
- [ ] Replace performance monitor logs
- [ ] Replace error boundary logs
- [ ] Replace context logs
- [ ] Test and validate

### Step 5: Remaining Migration (12-16 hours)
- [ ] Replace export/PDF logs
- [ ] Replace AI service logs
- [ ] Replace component logs
- [ ] Replace hook logs
- [ ] Final cleanup

**Total Estimated Effort:** 32-45 hours over 5 weeks

---

## Code Examples

### Before (Current)
```typescript
// Performance monitor
console.warn('🚨 PERFORMANCE_ALERT:', JSON.stringify(alertData))
console.error(`Authentication is taking ${avgTime.toFixed(0)}ms`)

// Component
console.log('🎯 Project: Setting currentProject to:', project)
console.log('💥 Project: Project restoration error:', error)

// Export
console.log('Capturing element with computed styles...')
console.log('Element visibility:', computedStyle.visibility)
```

### After (Enhanced)
```typescript
// Performance monitor
const perfLogger = usePerformanceLogger('AuthMonitor')
perfLogger.alert('Performance degradation detected', {
  avgTime,
  successRate,
  threshold: 2000
})

// Component
const logger = useLogger('ProjectContext')
logger.info('Setting current project', { projectId: project.id })
logger.error('Project restoration failed', error, { projectId })

// Export
const logger = useLogger('RoadmapExport')
logger.debug('Capturing element', {
  visibility: computedStyle.visibility,
  display: computedStyle.display,
  opacity: computedStyle.opacity
})
```

---

## Testing Strategy

### Unit Tests
- LoggingService class methods
- Rate limiting behavior
- Throttling behavior
- Environment filtering
- Formatter functions

### Integration Tests
- useLogger hook behavior
- Context propagation
- React component integration
- Performance logger accuracy

### E2E Tests
- Verify no console logs in production
- Error boundary logging
- Performance metric capture

---

## Success Metrics

### Quantitative
- ✅ 0 console.log statements in production code
- ✅ 100% structured logging adoption
- ✅ <5ms performance overhead
- ✅ 100% type coverage

### Qualitative
- ✅ Improved developer experience
- ✅ Better production debugging
- ✅ Easier error tracking
- ✅ Enhanced performance monitoring

---

## Future Enhancements

### Phase 5: Remote Logging (Future)
- Integration with logging services (Sentry, LogRocket, etc.)
- Error aggregation and alerting
- Performance metric dashboards
- User session replay

### Phase 6: Advanced Features (Future)
- Log sampling for high-volume apps
- Contextual search and filtering
- Real-time log streaming
- Machine learning anomaly detection

---

## Appendix: File-by-File Analysis

### Performance Monitors (High Priority)
**authPerformanceMonitor.ts** - 7 statements
- Performance alerts
- Reliability alerts
- Metric reporting
- **Migration:** usePerformanceLogger

**matrixPerformanceMonitor.ts** - 1 statement
- Metrics reset notification
- **Migration:** logger.debug

### Contexts (High Priority)
**ProjectContext.tsx** - 4 statements
- Project state changes
- Restoration errors
- **Migration:** useLogger('ProjectContext')

**NavigationContext.tsx** - 1 statement
- Navigation debugging
- **Migration:** useLogger('NavigationContext')

### Export Utilities (Medium Priority)
**roadmapExport.ts** - 25 statements
- PDF generation debugging
- Canvas capture logging
- Multi-page export tracking
- **Migration:** useLogger('RoadmapExport')

**pdfExportSimple.ts** - 4 statements
- PDF export debugging
- **Migration:** useLogger('PDFExport')

### Components (Medium Priority)
**ErrorBoundary.tsx** - 1 statement
- Error capture
- **Migration:** logger.error with context

**AuthDebugMonitor.tsx** - 12 statements
- Console wrapping (special case)
- **Migration:** Keep or remove debug component

**TimelineRoadmap.tsx** - 5 statements
- Timeline rendering
- **Migration:** useLogger('TimelineRoadmap')

### Hooks (Low Priority - spread across many files)
- useIdeas, useBrowserHistory, useAuthTestBypass, etc.
- **Migration:** useLogger per hook

### AI Services (Medium Priority)
**aiService.ts** - 1 statement
**openaiModelRouter.ts** - 1 statement
**aiInsightsService.ts** - 1 statement
- **Migration:** useLogger('AIService')

---

*Architecture Document v1.0 - Ready for Implementation*
