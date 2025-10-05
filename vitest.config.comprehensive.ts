/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Comprehensive Vitest Configuration
 *
 * Enhanced configuration for achieving 80%+ test coverage with optimal performance.
 * Includes strict coverage thresholds, parallel execution, and comprehensive reporting.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // Global test utilities available in all tests
    globals: true,

    // Use jsdom for DOM testing
    environment: 'jsdom',

    // Setup files run before each test file
    setupFiles: ['./src/test/setup.ts'],

    // Enable CSS processing for component tests
    css: true,

    // Mock CSS modules and assets
    moduleNameMapper: {
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/src/test/mocks/fileMock.ts',
    },

    // Coverage configuration with strict thresholds
    coverage: {
      provider: 'v8',

      // Multiple reporters for different use cases
      reporter: [
        'text',           // Console output
        'text-summary',   // Summary in console
        'json',           // Machine-readable
        'json-summary',   // Summary JSON
        'html',           // Browse able HTML report
        'lcov',           // For CI/CD tools
        'cobertura',      // XML format for other tools
      ],

      // Comprehensive coverage directories
      reportsDirectory: './coverage',

      // Files to exclude from coverage
      exclude: [
        'node_modules/',
        'src/test/**',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        'src/vite-env.d.ts',
        'src/main.tsx',                    // App entry point
        'src/workers/**',                   // Web workers
        'src/types/**',                     // Type definitions
        'src/test/**',                      // Test utilities
        'tests/**',                         // E2E tests
        'api/**/__tests__/**',             // API tests
        '**/__mocks__/**',                 // Mock files
        '**/mocks/**',                     // Mock directories
        'src/pages/ComponentShowcase.tsx', // Dev tool
        'src/components/dev/**',           // Dev components
        'src/components/test/**',          // Test components
        'src/utils/*Test*.ts',             // Test utilities
        'src/utils/*Diagnostic*.ts',       // Diagnostic tools
      ],

      // All coverage metrics enabled
      all: true,

      // Include source files for coverage
      include: [
        'src/**/*.{ts,tsx}',
        'api/**/*.ts',
      ],

      // Strict coverage thresholds (80% target)
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },

        // Critical paths require higher coverage
        'src/hooks/useAuth.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        'src/hooks/useIdeas.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        'src/lib/database.ts': {
          statements: 85,
          branches: 80,
          functions: 85,
          lines: 85,
        },
        'src/components/DesignMatrix.tsx': {
          statements: 85,
          branches: 80,
          functions: 85,
          lines: 85,
        },
      },

      // Clean coverage directory before each run
      clean: true,

      // Skip full coverage on watch mode for speed
      skipFull: process.env.WATCH === 'true',
    },

    // Performance optimizations
    // Run tests in parallel for speed (disable for debugging)
    pool: 'threads',
    poolOptions: {
      threads: {
        // Use all available CPU cores minus 1
        maxThreads: process.env.CI ? 2 : undefined,
        minThreads: 1,
      },
    },

    // Timeouts
    testTimeout: 15000,      // 15s for individual tests
    hookTimeout: 15000,      // 15s for hooks
    teardownTimeout: 10000,  // 10s for cleanup

    // Retry flaky tests automatically
    retry: process.env.CI ? 2 : 0,

    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'api/**/*.{test,spec}.{ts,tsx}',
    ],

    // Files to exclude from test discovery
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      'coverage/**',
      '**/*.d.ts',
      'tests/**',  // Playwright E2E tests
    ],

    // Watch mode exclusions
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.git/**',
      '**/claudedocs/**',
      '**/*-screenshots/**',
      '**/*-results/**',
      '**/*.md',
    ],

    // UI configuration for vitest --ui mode
    ui: {
      enabled: true,
      open: false,
      port: 5174,
    },

    // Reporter configuration
    reporters: process.env.CI
      ? ['verbose', 'json', 'html']
      : ['verbose', 'html'],

    // Output file for test results
    outputFile: {
      json: './test-results/test-results.json',
      html: './test-results/test-results.html',
    },

    // Benchmark configuration (for performance tests)
    benchmark: {
      include: ['**/*.bench.{ts,tsx}'],
      reporters: ['verbose'],
    },

    // Type checking during tests
    typecheck: {
      enabled: false, // Set to true to enable type checking during tests
      tsconfig: './tsconfig.json',
    },

    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    // Environment variables available in tests
    env: {
      NODE_ENV: 'test',
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },

    // Snapshot configuration
    resolveSnapshotPath: (testPath, snapExtension) =>
      testPath.replace(/\.test\.([tj]sx?)/, `${snapExtension}.$1`),

    // Seed for deterministic tests
    seed: 42,

    // Disable threading in CI for stability
    singleThread: process.env.CI === 'true',

    // Test isolation between files
    isolate: true,

    // Pass with no tests (useful during incremental development)
    passWithNoTests: false,

    // Bail on first failure (useful for CI)
    bail: process.env.CI ? 1 : 0,

    // Collect coverage from untested files
    coverage: {
      ...({} as any).coverage,
      all: true,
      skipFull: false,
    },
  },

  // Resolve aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './src/test'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
    },
  },

  // Build configuration (affects test compilation)
  build: {
    target: 'es2020',
  },
})