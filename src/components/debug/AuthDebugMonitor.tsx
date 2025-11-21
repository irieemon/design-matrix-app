import React, { useState, useEffect, useRef } from 'react';

interface DebugEvent {
  id: string;
  timestamp: Date;
  type: 'auth' | 'performance' | 'error' | 'state' | 'network';
  severity: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  data?: any;
}

interface PerformanceMetrics {
  sessionCheck: number[];
  userProfile: number[];
  projectCheck: number[];
  totalAuth: number[];
  animationTimeouts: number;
  memoryUsage: number[];
}

const AuthDebugMonitor: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    sessionCheck: [],
    userProfile: [],
    projectCheck: [],
    totalAuth: [],
    animationTimeouts: 0,
    memoryUsage: []
  });
  const [isRecording, setIsRecording] = useState(true);
  const eventsRef = useRef<DebugEvent[]>([]);
  const metricsRef = useRef<PerformanceMetrics>(metrics);

  // Store original console methods to prevent infinite recursion
  const originalConsoleRef = useRef({
    log: console.log,
    warn: console.warn,
    error: console.error
  });

  // Add event to the monitor
  const addEvent = (type: DebugEvent['type'], severity: DebugEvent['severity'], message: string, data?: any) => {
    const event: DebugEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      severity,
      message,
      data
    };

    eventsRef.current = [event, ...eventsRef.current.slice(0, 99)]; // Keep last 100 events
    setEvents([...eventsRef.current]);

    // Log to console using original methods to prevent infinite recursion
    const logMessage = `[${type.toUpperCase()}] ${message}`;
    switch (severity) {
      case 'error':
      case 'critical':
        originalConsoleRef.current.error(logMessage, data);
        break;
      case 'warn':
        originalConsoleRef.current.warn(logMessage, data);
        break;
      default:
        originalConsoleRef.current.log(logMessage, data);
    }
  };

  // Monitor authentication events
  useEffect(() => {
    if (!isRecording) return;

    // Intercept console logs to detect authentication events
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      const message = args.join(' ');

      // Detect authentication-related logs
      if (message.includes('🔐') || message.includes('Authentication')) {
        addEvent('auth', 'info', message);
      } else if (message.includes('performance') || message.includes('ms')) {
        addEvent('performance', 'info', message);
      } else if (message.includes('🎯') || message.includes('cache')) {
        addEvent('performance', 'info', message);
      }

      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      const message = args.join(' ');

      if (message.includes('animation timeout') || message.includes('State transition')) {
        addEvent('state', 'warn', message);
        setMetrics(prev => ({
          ...prev,
          animationTimeouts: prev.animationTimeouts + 1
        }));
      } else if (message.includes('bottleneck') || message.includes('slow')) {
        addEvent('performance', 'warn', message);
      }

      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      const message = args.join(' ');
      addEvent('error', 'error', message);
      originalError.apply(console, args);
    };

    // Monitor network requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = args[0]?.toString() || '';

      if (url.includes('/api/auth/') || url.includes('supabase')) {
        const startTime = performance.now();

        try {
          const response = await originalFetch.apply(window, args);
          const endTime = performance.now();
          const duration = endTime - startTime;

          addEvent('network', response.ok ? 'info' : 'error',
            `${response.status} ${url} (${duration.toFixed(1)}ms)`, {
            url,
            status: response.status,
            duration
          });

          return response;
        } catch (_error) {
          const endTime = performance.now();
          const duration = endTime - startTime;

          addEvent('network', 'error',
            `FAILED ${url} (${duration.toFixed(1)}ms): ${error}`, {
            url,
            error: error?.toString(),
            duration
          });

          throw error;
        }
      }

      return originalFetch.apply(window, args);
    };

    // Monitor performance
    const performanceInterval = setInterval(() => {
      // Check memory usage
      if (performance.memory) {
        const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: [...prev.memoryUsage.slice(-19), memoryMB]
        }));
      }

      // Check for global performance metrics
      if (window.authPerfMonitor) {
        try {
          const authMetrics = window.authPerfMonitor.getMetrics();
          if (authMetrics.sessionCheckTime) {
            setMetrics(prev => ({
              ...prev,
              sessionCheck: [...prev.sessionCheck.slice(-9), authMetrics.sessionCheckTime]
            }));
          }
        } catch (_error) {
          // Silently ignore if metrics not available
        }
      }
    }, 1000);

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      window.fetch = originalFetch;
      clearInterval(performanceInterval);
    };
  }, [isRecording]);

  const clearEvents = () => {
    setEvents([]);
    eventsRef.current = [];
    setMetrics({
      sessionCheck: [],
      userProfile: [],
      projectCheck: [],
      totalAuth: [],
      animationTimeouts: 0,
      memoryUsage: []
    });
  };

  const exportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      events: eventsRef.current,
      metrics: metricsRef.current
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auth-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isVisible) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 bg-red-500 text-white p-3 rounded-lg cursor-pointer shadow-lg hover:bg-red-600 transition-colors"
        onClick={() => setIsVisible(true)}
      >
        🔍 Debug Monitor ({events.filter(e => e.severity === 'error').length} errors)
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border-2 border-gray-300 rounded-lg shadow-2xl w-96 max-h-96 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 text-white p-3 rounded-t-lg flex justify-between items-center">
        <h3 className="font-bold">🔍 Auth Debug Monitor</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setIsRecording(!isRecording)}
            className={`px-2 py-1 rounded text-xs ${
              isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isRecording ? 'STOP' : 'START'}
          </button>
          <button
            onClick={clearEvents}
            className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 rounded text-xs"
          >
            CLEAR
          </button>
          <button
            onClick={exportData}
            className="px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded text-xs"
          >
            EXPORT
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="px-2 py-1 bg-gray-500 hover:bg-gray-600 rounded text-xs"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="p-2 bg-gray-50 border-b text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>📊 Events: {events.length}</div>
          <div>❌ Errors: {events.filter(e => e.severity === 'error').length}</div>
          <div>⚠️ Warnings: {events.filter(e => e.severity === 'warn').length}</div>
          <div>🎭 Animation Timeouts: {metrics.animationTimeouts}</div>
        </div>
        {metrics.memoryUsage.length > 0 && (
          <div className="mt-1">
            💾 Memory: {metrics.memoryUsage[metrics.memoryUsage.length - 1]?.toFixed(1)} MB
          </div>
        )}
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-2">
        {events.length === 0 ? (
          <div className="text-gray-500 text-center py-4">No events recorded</div>
        ) : (
          <div className="space-y-1">
            {events.map((event) => (
              <div
                key={event.id}
                className={`p-2 rounded text-xs border-l-4 ${
                  event.severity === 'error' || event.severity === 'critical'
                    ? 'bg-red-50 border-red-500 text-red-800'
                    : event.severity === 'warn'
                    ? 'bg-yellow-50 border-yellow-500 text-yellow-800'
                    : 'bg-blue-50 border-blue-500 text-blue-800'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs">
                    {event.type.toUpperCase()}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {event.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-1 break-words">{event.message}</div>
                {event.data && (
                  <div className="mt-1 text-xs text-gray-600 font-mono bg-gray-100 p-1 rounded">
                    {JSON.stringify(event.data, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-2 bg-gray-50 border-t">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => addEvent('auth', 'info', 'Manual test authentication flow')}
            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
          >
            Test Auth
          </button>
          <button
            onClick={() => {
              const memoryMB = (performance.memory?.usedJSHeapSize ?? 0) / 1024 / 1024;
              addEvent('performance', 'info', `Memory check: ${memoryMB.toFixed(1)} MB`);
            }}
            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
          >
            Check Memory
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthDebugMonitor;