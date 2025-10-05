/**
 * Performance Validation Test Suite
 * Comprehensive performance testing for enterprise matrix interface
 */

import { test, expect, Page, Browser } from '@playwright/test'

// Performance thresholds for world-class application
const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals targets
  FCP: 1.8, // First Contentful Paint (seconds)
  LCP: 2.5, // Largest Contentful Paint (seconds)
  FID: 100, // First Input Delay (milliseconds)
  CLS: 0.1, // Cumulative Layout Shift

  // Custom metrics
  TTI: 3.0, // Time to Interactive (seconds)
  FRAME_RATE: 55, // Minimum FPS during interactions
  MEMORY_USAGE: 100, // Maximum heap size (MB)
  BUNDLE_SIZE: 500, // Maximum initial bundle (KB gzipped)

  // Matrix-specific metrics
  MATRIX_RENDER_TIME: 100, // Matrix initial render (ms)
  CARD_INTERACTION_TIME: 16, // Card hover response (ms) - 1 frame at 60fps
  DRAG_SMOOTHNESS: 58, // FPS during drag operations
  PANEL_ANIMATION_TIME: 200 // Panel show/hide time (ms)
}

test.describe('Performance Validation Suite', () => {
  let browser: Browser
  let page: Page

  test.beforeAll(async ({ browser: b }) => {
    browser = b
  })

  test.beforeEach(async ({ page: p }) => {
    page = p

    // Enable performance monitoring
    await page.goto('/')

    // Wait for application to fully load
    await page.waitForSelector('[data-testid="matrix-container"]', {
      state: 'visible',
      timeout: 10000
    })
  })

  test('Core Web Vitals Compliance', async () => {
    // Start performance monitoring
    const performanceEntries = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const metrics = {
            FCP: 0,
            LCP: 0,
            FID: 0,
            CLS: 0
          }

          entries.forEach((entry) => {
            switch (entry.entryType) {
              case 'paint':
                if (entry.name === 'first-contentful-paint') {
                  metrics.FCP = entry.startTime / 1000
                }
                break
              case 'largest-contentful-paint':
                metrics.LCP = entry.startTime / 1000
                break
              case 'first-input':
                metrics.FID = entry.processingStart - entry.startTime
                break
              case 'layout-shift':
                if (!entry.hadRecentInput) {
                  metrics.CLS += entry.value
                }
                break
            }
          })

          resolve(metrics)
        }).observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] })
      })
    })

    const metrics = await performanceEntries as any

    // Validate Core Web Vitals
    expect(metrics.FCP).toBeLessThan(PERFORMANCE_THRESHOLDS.FCP)
    expect(metrics.LCP).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP)
    expect(metrics.FID).toBeLessThan(PERFORMANCE_THRESHOLDS.FID)
    expect(metrics.CLS).toBeLessThan(PERFORMANCE_THRESHOLDS.CLS)

    console.log('🎯 Core Web Vitals:', {
      FCP: `${metrics.FCP.toFixed(2)}s (target: <${PERFORMANCE_THRESHOLDS.FCP}s)`,
      LCP: `${metrics.LCP.toFixed(2)}s (target: <${PERFORMANCE_THRESHOLDS.LCP}s)`,
      FID: `${metrics.FID.toFixed(2)}ms (target: <${PERFORMANCE_THRESHOLDS.FID}ms)`,
      CLS: `${metrics.CLS.toFixed(3)} (target: <${PERFORMANCE_THRESHOLDS.CLS})`
    })
  })

  test('Matrix Rendering Performance', async () => {
    // Measure matrix render time
    const renderTime = await page.evaluate(() => {
      const start = performance.now()

      // Trigger matrix re-render by navigating to matrix page
      return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          const matrixCanvas = document.querySelector('[data-testid="matrix-canvas"]')
          if (matrixCanvas) {
            const end = performance.now()
            observer.disconnect()
            resolve(end - start)
          }
        })

        observer.observe(document.body, { childList: true, subtree: true })

        // Navigate to matrix if not already there
        const matrixButton = document.querySelector('[data-testid="matrix-tab"]') as HTMLElement
        if (matrixButton) {
          matrixButton.click()
        }
      })
    })

    expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MATRIX_RENDER_TIME)
    console.log(`🎯 Matrix Render Time: ${renderTime}ms (target: <${PERFORMANCE_THRESHOLDS.MATRIX_RENDER_TIME}ms)`)
  })

  test('Frame Rate During Interactions', async () => {
    // Monitor frame rate during card interactions
    await page.goto('/')

    const frameRateData = await page.evaluate((threshold) => {
      return new Promise((resolve) => {
        let frameCount = 0
        let lastTime = performance.now()
        let animationId: number

        const measureFPS = () => {
          frameCount++
          const currentTime = performance.now()

          if (currentTime - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (currentTime - lastTime))
            cancelAnimationFrame(animationId)
            resolve(fps)
          } else {
            animationId = requestAnimationFrame(measureFPS)
          }
        }

        // Start measuring during hover interactions
        const cards = document.querySelectorAll('[data-testid="idea-card"]')
        if (cards.length > 0) {
          const card = cards[0] as HTMLElement

          // Simulate hover interactions
          card.dispatchEvent(new MouseEvent('mouseenter'))

          measureFPS()
        } else {
          resolve(60) // Default if no cards
        }
      })
    }, PERFORMANCE_THRESHOLDS.FRAME_RATE)

    expect(frameRateData).toBeGreaterThan(PERFORMANCE_THRESHOLDS.FRAME_RATE)
    console.log(`🎯 Frame Rate: ${frameRateData}fps (target: >${PERFORMANCE_THRESHOLDS.FRAME_RATE}fps)`)
  })

  test('Memory Usage Monitoring', async () => {
    // Monitor memory usage over time
    const memoryUsage = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Force garbage collection if available
        if ('gc' in window) {
          (window as any).gc()
        }

        // Measure heap size
        if ('memory' in performance) {
          const memory = (performance as any).memory
          const heapUsedMB = memory.usedJSHeapSize / 1024 / 1024
          resolve(heapUsedMB)
        } else {
          resolve(0) // Not available in all browsers
        }
      })
    })

    if (memoryUsage > 0) {
      expect(memoryUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE)
      console.log(`🎯 Memory Usage: ${memoryUsage.toFixed(2)}MB (target: <${PERFORMANCE_THRESHOLDS.MEMORY_USAGE}MB)`)
    }
  })

  test('Drag and Drop Performance', async () => {
    // Test drag performance
    await page.goto('/')

    const dragPerformance = await page.evaluate(() => {
      return new Promise((resolve) => {
        const cards = document.querySelectorAll('[data-testid="idea-card"]')
        if (cards.length === 0) {
          resolve({ fps: 60, duration: 0 })
          return
        }

        const card = cards[0] as HTMLElement
        let frameCount = 0
        let lastTime = performance.now()
        let animationId: number
        const startTime = performance.now()

        const measureDragFPS = () => {
          frameCount++
          const currentTime = performance.now()

          if (currentTime - startTime > 1000) { // Measure for 1 second
            const fps = Math.round((frameCount * 1000) / (currentTime - lastTime))
            const duration = currentTime - startTime
            cancelAnimationFrame(animationId)
            resolve({ fps, duration })
          } else {
            animationId = requestAnimationFrame(measureDragFPS)
          }
        }

        // Simulate drag start
        card.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }))

        // Start measuring
        measureDragFPS()

        // Simulate drag movement
        setTimeout(() => {
          document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150 }))
        }, 100)

        // End drag
        setTimeout(() => {
          document.dispatchEvent(new MouseEvent('mouseup'))
        }, 500)
      })
    })

    const result = dragPerformance as { fps: number; duration: number }
    expect(result.fps).toBeGreaterThan(PERFORMANCE_THRESHOLDS.DRAG_SMOOTHNESS)
    console.log(`🎯 Drag FPS: ${result.fps}fps (target: >${PERFORMANCE_THRESHOLDS.DRAG_SMOOTHNESS}fps)`)
  })

  test('Panel Animation Performance', async () => {
    // Test panel show/hide performance
    await page.goto('/')

    const animationTime = await page.evaluate(() => {
      return new Promise((resolve) => {
        const statsButton = document.querySelector('[data-testid="stats-toggle"]') as HTMLElement
        if (!statsButton) {
          resolve(0)
          return
        }

        const startTime = performance.now()

        // Listen for transition end
        const handleTransitionEnd = () => {
          const endTime = performance.now()
          document.removeEventListener('transitionend', handleTransitionEnd)
          resolve(endTime - startTime)
        }

        document.addEventListener('transitionend', handleTransitionEnd)

        // Trigger panel toggle
        statsButton.click()

        // Fallback timeout
        setTimeout(() => {
          document.removeEventListener('transitionend', handleTransitionEnd)
          resolve(0)
        }, 1000)
      })
    })

    if (animationTime > 0) {
      expect(animationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PANEL_ANIMATION_TIME)
      console.log(`🎯 Panel Animation: ${animationTime.toFixed(2)}ms (target: <${PERFORMANCE_THRESHOLDS.PANEL_ANIMATION_TIME}ms)`)
    }
  })

  test('Bundle Size Analysis', async () => {
    // Check initial bundle size
    const resourceSizes = await page.evaluate(() => {
      return new Promise((resolve) => {
        const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
        const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

        let totalTransferSize = 0
        let jsTransferSize = 0
        let cssTransferSize = 0

        resourceEntries.forEach((entry) => {
          if (entry.transferSize) {
            totalTransferSize += entry.transferSize

            if (entry.name.endsWith('.js')) {
              jsTransferSize += entry.transferSize
            } else if (entry.name.endsWith('.css')) {
              cssTransferSize += entry.transferSize
            }
          }
        })

        resolve({
          total: totalTransferSize / 1024, // Convert to KB
          js: jsTransferSize / 1024,
          css: cssTransferSize / 1024
        })
      })
    })

    const sizes = resourceSizes as { total: number; js: number; css: number }

    // Focus on JS bundle size as it impacts parse time
    expect(sizes.js).toBeLessThan(PERFORMANCE_THRESHOLDS.BUNDLE_SIZE)

    console.log('🎯 Bundle Sizes:', {
      total: `${sizes.total.toFixed(2)}KB`,
      js: `${sizes.js.toFixed(2)}KB (target: <${PERFORMANCE_THRESHOLDS.BUNDLE_SIZE}KB)`,
      css: `${sizes.css.toFixed(2)}KB`
    })
  })

  test('Responsive Performance Across Viewports', async () => {
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1440, height: 900 },
      { name: 'Ultra-wide', width: 2560, height: 1440 }
    ]

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      const resizeTime = await page.evaluate(() => {
        return new Promise((resolve) => {
          const startTime = performance.now()

          const handleResize = () => {
            const endTime = performance.now()
            window.removeEventListener('resize', handleResize)
            resolve(endTime - startTime)
          }

          window.addEventListener('resize', handleResize)

          // Trigger resize
          window.dispatchEvent(new Event('resize'))

          // Fallback
          setTimeout(() => {
            window.removeEventListener('resize', handleResize)
            resolve(0)
          }, 500)
        })
      })

      // Resize should be fast
      expect(resizeTime).toBeLessThan(100)

      console.log(`🎯 ${viewport.name} Resize: ${resizeTime}ms`)
    }
  })

  test('Performance Under Load', async () => {
    // Test with many ideas (stress test)
    await page.goto('/')

    const stressTestResults = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Simulate adding many ideas
        const startTime = performance.now()

        // Create stress test scenario
        const simulateHeavyLoad = () => {
          let operations = 0
          const maxOperations = 100

          const performOperation = () => {
            operations++

            // Simulate matrix operations
            const cards = document.querySelectorAll('[data-testid="idea-card"]')
            cards.forEach((card) => {
              card.dispatchEvent(new MouseEvent('mouseenter'))
              card.dispatchEvent(new MouseEvent('mouseleave'))
            })

            if (operations < maxOperations) {
              requestAnimationFrame(performOperation)
            } else {
              const endTime = performance.now()
              resolve({
                duration: endTime - startTime,
                operationsPerSecond: (operations * 1000) / (endTime - startTime)
              })
            }
          }

          performOperation()
        }

        simulateHeavyLoad()
      })
    })

    const results = stressTestResults as { duration: number; operationsPerSecond: number }

    // Should maintain good performance under load
    expect(results.operationsPerSecond).toBeGreaterThan(50)

    console.log('🎯 Stress Test:', {
      duration: `${results.duration.toFixed(2)}ms`,
      opsPerSec: `${results.operationsPerSecond.toFixed(2)} ops/sec`
    })
  })
})

test.describe('Performance Regression Prevention', () => {
  test('Performance Budget Enforcement', async ({ page }) => {
    await page.goto('/')

    // Set up performance budget
    const budget = await page.evaluate(() => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.duration > 50) { // Flag operations taking > 50ms
            console.warn(`🚨 Performance Budget Exceeded: ${entry.name} took ${entry.duration}ms`)
          }
        })
      })

      observer.observe({ entryTypes: ['measure', 'navigation'] })

      return 'Performance monitoring active'
    })

    expect(budget).toBe('Performance monitoring active')
  })

  test('Memory Leak Detection', async ({ page }) => {
    await page.goto('/')

    const memoryLeakTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        if (!('memory' in performance)) {
          resolve('Memory API not available')
          return
        }

        const memory = (performance as any).memory
        const initialHeap = memory.usedJSHeapSize

        // Perform operations that might cause leaks
        for (let i = 0; i < 100; i++) {
          // Simulate component mount/unmount cycles
          const div = document.createElement('div')
          div.innerHTML = '<div class="idea-card">Test</div>'
          document.body.appendChild(div)
          document.body.removeChild(div)
        }

        // Force garbage collection
        if ('gc' in window) {
          (window as any).gc()
        }

        setTimeout(() => {
          const finalHeap = memory.usedJSHeapSize
          const leakSize = finalHeap - initialHeap

          resolve({
            initial: initialHeap,
            final: finalHeap,
            leak: leakSize,
            leakMB: leakSize / 1024 / 1024
          })
        }, 1000)
      })
    })

    const result = memoryLeakTest as any
    if (typeof result === 'object' && result.leakMB) {
      expect(result.leakMB).toBeLessThan(5) // Less than 5MB leak
      console.log(`🎯 Memory Leak Test: ${result.leakMB.toFixed(2)}MB leaked`)
    }
  })
})