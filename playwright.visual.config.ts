import { defineConfig, devices } from '@playwright/test';

/**
 * Visual Testing Configuration for Authentication Flow
 *
 * Specialized config for comprehensive visual validation of auth system
 * focusing on flickering detection and state transitions
 */
export default defineConfig({
  testDir: './tests/visual',

  // Timeout configurations for visual stability
  timeout: 60000, // Increased for visual comparison processing
  expect: {
    timeout: 10000,
    // Visual comparison thresholds
    toHaveScreenshot: {
      threshold: 0.1,      // Allow 10% pixel difference for dynamic content
      maxDiffPixels: 1000, // Max pixel difference before failure
      animations: 'disabled' // Disable CSS animations for consistent captures
    }
  },

  // Fullyparallel for faster test execution
  fullyParallel: false, // Disabled to prevent resource conflicts during visual capture

  // Retry configuration for visual tests
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 1, // Single worker for consistent visual captures

  // Global test configuration
  use: {
    baseURL: 'http://localhost:5173',

    // Browser configuration optimized for visual testing
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // Enhanced tracing for visual test debugging
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Additional configuration for stable visual captures
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // Reduce motion for consistent visual captures
    reducedMotion: 'reduce',

    // Color scheme consistency
    colorScheme: 'light',
  },

  // Test output configuration
  outputDir: 'test-results/visual/',

  // Reporter configuration for visual tests
  reporter: [
    ['html', {
      outputFolder: 'test-results/visual-report',
      open: 'never'
    }],
    ['json', {
      outputFile: 'test-results/visual-results.json'
    }],
    ['list', { printSteps: true }]
  ],

  // Multiple browser configurations for cross-browser visual validation
  projects: [
    {
      name: 'auth-visual-chrome',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome-specific optimizations for visual testing
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-backgrounding-occluded-windows',
            '--disable-background-timer-throttling',
            '--disable-background-mode'
          ]
        }
      },
    },

    {
      name: 'auth-visual-firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Firefox-specific visual testing configuration
        launchOptions: {
          firefoxUserPrefs: {
            'ui.prefersReducedMotion': 1,
            'gfx.webrender.all': true
          }
        }
      },
    },

    {
      name: 'auth-visual-safari',
      use: {
        ...devices['Desktop Safari'],
        // Safari-specific configuration
      },
    },

    // Mobile viewports for responsive testing
    {
      name: 'auth-mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },

    {
      name: 'auth-mobile-safari',
      use: {
        ...devices['iPhone 12'],
      },
    },

    // Tablet viewports
    {
      name: 'auth-tablet-chrome',
      use: {
        ...devices['iPad Pro'],
      },
    },
  ],

  // Web server configuration for local testing
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },

  // Global setup and teardown
  globalSetup: require.resolve('./tests/visual/setup/global-setup.ts'),
  globalTeardown: require.resolve('./tests/visual/setup/global-teardown.ts'),
});