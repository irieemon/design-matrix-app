# Logging Service

Production-ready, structured logging service for React/TypeScript applications.

## Features

✅ **Structured Logging** - JSON-friendly log entries with contextual metadata
✅ **Type-Safe** - Full TypeScript support with comprehensive types
✅ **Environment-Aware** - Automatic filtering for dev/production
✅ **React Integration** - Custom hooks for easy component integration
✅ **Performance Tracking** - Built-in performance measurement utilities
✅ **Rate Limiting** - Prevents log flooding
✅ **Throttling** - Deduplicates repeated messages
✅ **Zero Dependencies** - Standalone implementation
✅ **Extensible** - Future-ready for remote logging services

---

## Quick Start

### Installation

The logging service is already included in the project at `src/lib/logging/`.

### Basic Usage

```typescript
import { logger } from '@/lib/logging'

// Simple logging
logger.debug('Debug message')
logger.info('Info message')
logger.warn('Warning message')
logger.error('Error occurred', error)

// Structured logging
logger.info('User action', {
  userId: '123',
  action: 'login',
  timestamp: Date.now()
})
```

### React Components

```typescript
import { useLogger } from '@/lib/logging'

function MyComponent() {
  const logger = useLogger('MyComponent')

  useEffect(() => {
    logger.debug('Component mounted')
  }, [])

  const handleClick = () => {
    logger.info('Button clicked', { buttonId: 'submit' })
  }

  return <button onClick={handleClick}>Submit</button>
}
```

### Performance Logging

```typescript
import { usePerformanceLogger } from '@/lib/logging'

function DataFetcher() {
  const perfLogger = usePerformanceLogger('DataFetcher')

  const fetchData = async () => {
    return perfLogger.measure('fetch_data', () => api.fetchData())
  }
}
```

---

## API Reference

### Logger Interface

```typescript
interface Logger {
  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, error?: Error, data?: Record<string, unknown>): void
  performance(metric: PerformanceMetric): void
  withContext(context: LogContext): Logger
}
```

### React Hooks

#### `useLogger(component?, context?)`
Creates a logger instance with component context.

#### `usePerformanceLogger(component?, context?)`
Creates a performance logger for operation timing.

#### `useOperationTimer(operation, metadata?)`
Auto-tracks component lifecycle timing.

### Context Provider

```typescript
import { LoggingProvider } from '@/lib/logging'

function App() {
  const user = useUser()

  return (
    <LoggingProvider value={{ userId: user?.id }}>
      <AppContent />
    </LoggingProvider>
  )
}
```

---

## Log Levels

| Level | Usage | Environment |
|-------|-------|-------------|
| `debug` | Detailed diagnostic info | Development only |
| `info` | General informational messages | Development + Production |
| `warn` | Warning messages | Always visible |
| `error` | Error messages | Always visible |

---

## Environment Behavior

### Development
- ✅ All log levels visible
- ✅ Colorful console output
- ✅ Stack traces included
- ✅ Debug mode toggleable via URL (`?debug=true`)

### Production
- ✅ Only WARN and ERROR levels
- ✅ Sanitized output
- ✅ Performance optimized
- ✅ Ready for remote logging

### Test
- ✅ Only ERROR level by default
- ✅ Minimal output noise
- ✅ Statistics available

---

## Configuration

```typescript
import { LoggingService } from '@/lib/logging'

const customLogger = new LoggingService({
  minLevel: 'debug',
  enableConsole: true,
  enableRateLimiting: true,
  enableThrottling: true,
  globalContext: { appVersion: '1.0.0' },
  transport: (entry) => {
    // Send to remote logging service
    logService.send(entry)
  }
})
```

---

## Advanced Usage

### Scoped Loggers

```typescript
const logger = useLogger('ParentComponent')
const childLogger = logger.withContext({ childId: '456' })

childLogger.info('Child action') // Includes parent + child context
```

### Performance Measurement

```typescript
const perfLogger = usePerformanceLogger('API')

// Method 1: start/end
const end = perfLogger.start('fetch')
const data = await api.fetch()
end()

// Method 2: measure (cleaner)
const data = await perfLogger.measure('fetch', () => api.fetch())
```

### Custom Context

```typescript
logger.info('User action', {
  userId: user.id,
  projectId: project.id,
  action: 'create',
  metadata: { source: 'ui' }
})
```

---

## Statistics & Debugging

```typescript
import { getLoggingStats, setDebugMode } from '@/lib/logging'

// Get statistics
const stats = getLoggingStats()
console.log(stats)
// {
//   throttleStateSize: 10,
//   rateLimitCounts: { debug: 5, info: 8, warn: 2, error: 1 },
//   totalLogs: { debug: 100, info: 200, warn: 20, error: 5 },
//   droppedLogs: 15
// }

// Toggle debug mode
setDebugMode(true)  // Enable debug logs
setDebugMode(false) // Disable debug logs
```

---

## Migration from console.log

See [LOGGING_MIGRATION_GUIDE.md](../../../LOGGING_MIGRATION_GUIDE.md) for comprehensive migration instructions.

**Quick reference:**

```typescript
// Before
console.log('User logged in', userId)
console.warn('API slow:', duration)
console.error('Failed:', error)

// After
logger.info('User logged in', { userId })
logger.warn('API response slow', { duration, threshold: 2000 })
logger.error('API request failed', error, { endpoint: '/api/users' })
```

---

## Testing

```bash
# Run logging service tests
npm test src/lib/logging

# Run with coverage
npm test src/lib/logging -- --coverage
```

---

## Architecture

See [LOGGING_SERVICE_ARCHITECTURE.md](../../../LOGGING_SERVICE_ARCHITECTURE.md) for full architecture details.

### Directory Structure

```
src/lib/logging/
├── LoggingService.ts       # Core service
├── types.ts                # TypeScript interfaces
├── index.ts                # Public API exports
├── contexts/
│   └── LoggingContext.tsx  # React context provider
├── hooks/
│   ├── useLogger.ts        # Component logging hook
│   └── usePerformanceLogger.ts # Performance tracking hook
└── __tests__/
    └── LoggingService.test.ts # Comprehensive tests
```

---

## Best Practices

### ✅ DO

```typescript
// Use appropriate log levels
logger.debug('Detailed diagnostic info')
logger.info('Normal operation')
logger.warn('Potential issue')
logger.error('Actual failure', error)

// Include structured data
logger.info('User action', { userId, action, metadata })

// Use component names
const logger = useLogger('MyComponent')

// Use performance logger for timing
const perfLogger = usePerformanceLogger('API')
await perfLogger.measure('fetch', () => api.fetch())
```

### ❌ DON'T

```typescript
// Don't use console.log directly
console.log('Message') // ❌

// Don't use string interpolation
logger.info(`User ${userId} did ${action}`) // ❌
logger.info('User action', { userId, action }) // ✅

// Don't log sensitive data
logger.info('User password', { password }) // ❌ SECURITY RISK

// Don't use debug level in production code paths
if (import.meta.env.PROD) {
  logger.debug('...') // ❌ Won't show anyway
}
```

---

## Performance

The logging service is designed for minimal performance impact:

- **Rate Limiting**: Limits logs per second by level
- **Throttling**: Deduplicates repeated messages
- **Lazy Evaluation**: Only processes logs if level is enabled
- **Efficient Formatting**: Minimal string operations
- **Async Transport**: Non-blocking remote logging (future)

**Overhead:** <1ms per log call in typical usage

---

## Future Enhancements

- [ ] Remote transport integrations (Sentry, LogRocket, Datadog)
- [ ] Log sampling for high-volume applications
- [ ] Real-time log streaming dashboard
- [ ] Machine learning anomaly detection
- [ ] Advanced filtering and search

---

## Troubleshooting

### Logs not appearing

Check the log level and environment:

```typescript
import { loggingService } from '@/lib/logging'

// Check if debug is enabled
console.log(loggingService.isDebugEnabled())

// Enable debug mode
loggingService.setDebugMode(true)
```

### Too many logs

Adjust rate limiting or throttling:

```typescript
import { LoggingService } from '@/lib/logging'

const logger = new LoggingService({
  enableRateLimiting: true,
  enableThrottling: true
})
```

### Performance concerns

Check statistics:

```typescript
import { getLoggingStats } from '@/lib/logging'

const stats = getLoggingStats()
console.log('Dropped logs:', stats.droppedLogs)
console.log('Total logs:', stats.totalLogs)
```

---

## Support

For questions, issues, or contributions:

1. Check the [Migration Guide](../../../LOGGING_MIGRATION_GUIDE.md)
2. Review the [Architecture Document](../../../LOGGING_SERVICE_ARCHITECTURE.md)
3. Examine the tests for usage examples
4. Open an issue or PR in the repository

---

**Version:** 1.0.0
**Last Updated:** 2025-10-01
**Maintainer:** Engineering Team
