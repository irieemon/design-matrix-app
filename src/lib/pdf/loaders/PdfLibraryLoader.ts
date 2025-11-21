/**
 * PDF Library Loader
 *
 * Singleton module for managing dynamic loading of pdfMake library
 * with robust error handling, retry logic, and loading state management.
 *
 * @module PdfLibraryLoader
 */

import { logger } from '../../logging'

// Create scoped logger for PDF library operations
const pdfLoaderLogger = logger.withContext({ component: 'PdfLibraryLoader' })

/**
 * Custom error types for PDF library loading failures
 */
export class PdfLibraryLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly attemptNumber?: number
  ) {
    super(message)
    this.name = 'PdfLibraryLoadError'
  }
}

export class PdfFontsLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'PdfFontsLoadError'
  }
}

/**
 * Loading state enumeration
 */
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  LOADED = 'loaded',
  FAILED = 'failed'
}

/**
 * Configuration options for PDF library loader
 */
interface LoaderConfig {
  maxRetries: number
  retryDelayMs: number
  timeout: number
}

const DEFAULT_CONFIG: LoaderConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeout: 10000
}

/**
 * Singleton class for managing pdfMake library loading
 *
 * Features:
 * - Singleton pattern prevents multiple load attempts
 * - Promise caching prevents race conditions
 * - Retry logic with exponential backoff
 * - Comprehensive error handling with custom error types
 * - Loading state tracking
 * - Proper TypeScript typing
 */
class PdfLibraryLoader {
  private static instance: PdfLibraryLoader
  private pdfMake: any = null
  private state: LoadingState = LoadingState.IDLE
  private loadingPromise: Promise<any> | null = null
  private config: LoaderConfig

  /**
   * Private constructor enforces singleton pattern
   */
  private constructor(config: Partial<LoaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LoaderConfig>): PdfLibraryLoader {
    if (!PdfLibraryLoader.instance) {
      PdfLibraryLoader.instance = new PdfLibraryLoader(config)
    }
    return PdfLibraryLoader.instance
  }

  /**
   * Get current loading state
   */
  getState(): LoadingState {
    return this.state
  }

  /**
   * Check if library is loaded
   */
  isLibraryLoaded(): boolean {
    return this.state === LoadingState.LOADED && this.pdfMake !== null
  }

  /**
   * Load pdfMake library with retry logic
   *
   * Returns cached promise if already loading to prevent race conditions
   * Returns cached library if already loaded
   *
   * @throws {PdfLibraryLoadError} If library fails to load after retries
   * @throws {PdfFontsLoadError} If fonts fail to configure
   */
  async load(): Promise<any> {
    // Return cached library if already loaded
    if (this.isLibraryLoaded()) {
      pdfLoaderLogger.debug('pdfMake already loaded, returning cached instance', {
        operation: 'load',
        state: this.state
      })
      return this.pdfMake
    }

    // Return existing promise if currently loading (prevents race conditions)
    if (this.loadingPromise) {
      pdfLoaderLogger.debug('Load already in progress, returning existing promise', {
        operation: 'load',
        state: this.state
      })
      return this.loadingPromise
    }

    // Start new load operation
    this.state = LoadingState.LOADING
    this.loadingPromise = this.loadWithRetry()

    try {
      const result = await this.loadingPromise
      this.state = LoadingState.LOADED
      return result
    } catch (_error) {
      this.state = LoadingState.FAILED
      throw error
    } finally {
      this.loadingPromise = null
    }
  }

  /**
   * Load library with retry logic and exponential backoff
   *
   * @private
   */
  private async loadWithRetry(): Promise<any> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        pdfLoaderLogger.info('Attempting to load pdfMake library', {
          operation: 'loadWithRetry',
          attempt,
          maxRetries: this.config.maxRetries
        })

        const library = await this.loadLibraryWithTimeout()

        pdfLoaderLogger.info('pdfMake library loaded successfully', {
          operation: 'loadWithRetry',
          attempt,
          libraryLoaded: true
        })

        return library

      } catch (_error) {
        lastError = error as Error

        pdfLoaderLogger.warn('pdfMake load attempt failed', {
          operation: 'loadWithRetry',
          attempt,
          maxRetries: this.config.maxRetries,
          willRetry: attempt < this.config.maxRetries,
          error: error instanceof Error ? error.message : String(error)
        })

        // Don't retry on last attempt
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1)
          pdfLoaderLogger.debug('Retrying after delay', {
            operation: 'loadWithRetry',
            delayMs: delay,
            nextAttempt: attempt + 1
          })
          await this.sleep(delay)
        }
      }
    }

    // All retries failed
    throw new PdfLibraryLoadError(
      'Failed to load pdfMake library after all retry attempts',
      lastError,
      this.config.maxRetries
    )
  }

  /**
   * Load library with timeout protection
   *
   * @private
   */
  private async loadLibraryWithTimeout(): Promise<any> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new PdfLibraryLoadError('Library load timeout exceeded'))
      }, this.config.timeout)
    })

    const loadPromise = this.performLoad()

    return Promise.race([loadPromise, timeoutPromise])
  }

  /**
   * Perform actual library loading and font configuration
   *
   * @private
   */
  private async performLoad(): Promise<any> {
    try {
      // Load pdfMake core library
      const pdfMakeModule = await import('pdfmake/build/pdfmake')

      // Load fonts module
      const pdfFontsModule = await import('pdfmake/build/vfs_fonts')

      // Extract default exports
      const pdfMakeLib = pdfMakeModule.default || pdfMakeModule
      const pdfFonts = pdfFontsModule.default || pdfFontsModule

      // Configure fonts with robust handling
      this.configureFonts(pdfMakeLib, pdfFonts)

      // Cache the library
      this.pdfMake = pdfMakeLib

      return pdfMakeLib

    } catch (_error) {
      pdfLoaderLogger.error('Failed to load pdfMake modules', error, {
        operation: 'performLoad',
        errorType: error instanceof Error ? error.name : 'unknown'
      })
      throw new PdfLibraryLoadError(
        'Failed to import pdfMake modules',
        error as Error
      )
    }
  }

  /**
   * Configure fonts with proper type handling
   *
   * Handles different font module export structures:
   * - fonts.pdfMake.vfs (nested structure)
   * - fonts.vfs (direct structure)
   * - fonts (direct fonts object)
   *
   * @private
   */
  private configureFonts(pdfMakeLib: any, pdfFonts: any): void {
    try {
      if (!pdfMakeLib) {
        throw new PdfFontsLoadError('pdfMake library is null or undefined')
      }

      if (!pdfFonts) {
        throw new PdfFontsLoadError('pdfFonts module is null or undefined')
      }

      // Try nested structure first (fonts.pdfMake.vfs)
      if (pdfFonts.pdfMake?.vfs) {
        pdfMakeLib.vfs = pdfFonts.pdfMake.vfs
        pdfLoaderLogger.debug('Configured fonts using nested structure', {
          operation: 'configureFonts',
          structure: 'pdfFonts.pdfMake.vfs'
        })
        return
      }

      // Try direct vfs structure (fonts.vfs)
      if (pdfFonts.vfs) {
        pdfMakeLib.vfs = pdfFonts.vfs
        pdfLoaderLogger.debug('Configured fonts using direct vfs structure', {
          operation: 'configureFonts',
          structure: 'pdfFonts.vfs'
        })
        return
      }

      // Fallback to direct assignment
      pdfMakeLib.vfs = pdfFonts
      pdfLoaderLogger.debug('Configured fonts using direct assignment fallback', {
        operation: 'configureFonts',
        structure: 'pdfFonts (direct)'
      })

    } catch (_error) {
      pdfLoaderLogger.error('Font configuration failed', error, {
        operation: 'configureFonts',
        hasPdfMake: !!pdfMakeLib,
        hasPdfFonts: !!pdfFonts
      })
      throw new PdfFontsLoadError(
        'Failed to configure pdfMake fonts',
        error as Error
      )
    }
  }

  /**
   * Utility: Sleep for specified milliseconds
   *
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Reset loader state (mainly for testing)
   *
   * @internal
   */
  reset(): void {
    pdfLoaderLogger.warn('Resetting PDF library loader state', {
      operation: 'reset',
      previousState: this.state
    })

    this.pdfMake = null
    this.state = LoadingState.IDLE
    this.loadingPromise = null
  }
}

/**
 * Singleton instance export
 */
export const pdfLibraryLoader = PdfLibraryLoader.getInstance()

/**
 * Convenience function matching original API
 *
 * @example
 * ```typescript
 * const pdfMake = await loadPdfMake()
 * pdfMake.createPdf(docDefinition).download('file.pdf')
 * ```
 */
export const loadPdfMake = () => pdfLibraryLoader.load()

/**
 * Check if library is loaded (synchronous)
 *
 * @example
 * ```typescript
 * if (isPdfMakeLoaded()) {
 *   // Use library
 * }
 * ```
 */
export const isPdfMakeLoaded = () => pdfLibraryLoader.isLibraryLoaded()

/**
 * Get current loading state
 *
 * @example
 * ```typescript
 * const state = getPdfLoadingState()
 * if (state === LoadingState.LOADING) {
 *   // Show loading indicator
 * }
 * ```
 */
export const getPdfLoadingState = () => pdfLibraryLoader.getState()
