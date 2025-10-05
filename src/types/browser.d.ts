/**
 * Browser API Type Declarations
 *
 * Type declarations for browser-specific APIs that are not in standard TypeScript definitions.
 * This includes Chrome-specific APIs and custom window properties.
 */

/**
 * Chrome Performance Memory API
 * Only available in Chrome/Chromium browsers
 */
interface Performance {
  memory?: {
    /** The size of the JS heap including free space not occupied by any JS objects */
    jsHeapSizeLimit: number;
    /** The total allocated heap size */
    totalJSHeapSize: number;
    /** The currently active segment of JS heap */
    usedJSHeapSize: number;
  };
}

/**
 * Custom window properties for performance monitoring
 */
interface Window {
  /** Authentication performance monitor instance */
  authPerfMonitor?: {
    startSession: () => void;
    endSession: () => void;
    recordOperation: (operation: string, duration: number) => void;
    getAverageMetrics: () => any;
    getMetrics: () => any;
  };
}
