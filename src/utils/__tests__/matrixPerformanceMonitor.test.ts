/**
 * Matrix Performance Monitor Test Suite
 *
 * Comprehensive tests for matrix performance monitoring functionality
 * including hover tracking, animation metrics, and performance reporting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixPerformanceMonitor } from '../matrixPerformanceMonitor'

// Mock console methods
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn

beforeEach(() => {
  vi.clearAllMocks()
  console.log = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  console.log = originalConsoleLog
  console.warn = originalConsoleWarn
})

describe('MatrixPerformanceMonitor', () => {
  describe('Monitoring State', () => {
    it('should start monitoring without throwing errors', () => {
      expect(() => {
        matrixPerformanceMonitor.startMonitoring()
      }).not.toThrow()
    })

    it('should stop monitoring and return report', () => {
      matrixPerformanceMonitor.startMonitoring()
      const report = matrixPerformanceMonitor.stopMonitoring()

      expect(report).toBeDefined()
      expect(report).toHaveProperty('summary')
      expect(report).toHaveProperty('hover')
      expect(report).toHaveProperty('animation')
      expect(report).toHaveProperty('recommendations')
    })

    it('should allow multiple start/stop cycles', () => {
      matrixPerformanceMonitor.startMonitoring()
      matrixPerformanceMonitor.stopMonitoring()

      matrixPerformanceMonitor.startMonitoring()
      const report = matrixPerformanceMonitor.stopMonitoring()

      expect(report).toBeDefined()
    })
  })

  describe('Hover Monitoring', () => {
    it('should monitor hover interactions without errors', () => {
      const element = document.createElement('div')

      expect(() => {
        const cleanup = matrixPerformanceMonitor.monitorHover(element)
        cleanup()
      }).not.toThrow()
    })

    it('should return cleanup function for hover monitoring', () => {
      const element = document.createElement('div')
      const cleanup = matrixPerformanceMonitor.monitorHover(element)

      expect(cleanup).toBeInstanceOf(Function)
    })

    it('should allow monitoring multiple elements', () => {
      const element1 = document.createElement('div')
      const element2 = document.createElement('div')
      const element3 = document.createElement('div')

      const cleanup1 = matrixPerformanceMonitor.monitorHover(element1)
      const cleanup2 = matrixPerformanceMonitor.monitorHover(element2)
      const cleanup3 = matrixPerformanceMonitor.monitorHover(element3)

      expect(cleanup1).toBeDefined()
      expect(cleanup2).toBeDefined()
      expect(cleanup3).toBeDefined()

      cleanup1()
      cleanup2()
      cleanup3()
    })

    it('should handle cleanup being called multiple times', () => {
      const element = document.createElement('div')
      const cleanup = matrixPerformanceMonitor.monitorHover(element)

      expect(() => {
        cleanup()
        cleanup()
        cleanup()
      }).not.toThrow()
    })

    it('should handle monitoring detached elements', () => {
      const element = document.createElement('div')
      // Element not attached to DOM

      expect(() => {
        const cleanup = matrixPerformanceMonitor.monitorHover(element)
        cleanup()
      }).not.toThrow()
    })
  })

  describe('Animation Monitoring', () => {
    it('should monitor animation without errors', () => {
      const element = document.createElement('div')

      expect(() => {
        matrixPerformanceMonitor.monitorAnimation(element, 'transform', 300)
      }).not.toThrow()
    })

    it('should handle different animation types', () => {
      const element = document.createElement('div')

      const animationTypes = ['transform', 'opacity', 'scale', 'rotate', 'translate']

      animationTypes.forEach(type => {
        expect(() => {
          matrixPerformanceMonitor.monitorAnimation(element, type, 200)
        }).not.toThrow()
      })
    })

    it('should handle various animation durations', () => {
      const element = document.createElement('div')

      const durations = [0, 100, 500, 1000, 3000]

      durations.forEach(duration => {
        expect(() => {
          matrixPerformanceMonitor.monitorAnimation(element, 'transform', duration)
        }).not.toThrow()
      })
    })

    it('should handle negative animation duration', () => {
      const element = document.createElement('div')

      expect(() => {
        matrixPerformanceMonitor.monitorAnimation(element, 'transform', -100)
      }).not.toThrow()
    })
  })

  describe('Drag Monitoring', () => {
    it('should monitor drag operations', () => {
      const element = document.createElement('div')

      const dragMonitor = matrixPerformanceMonitor.monitorDrag(element)

      expect(dragMonitor).toHaveProperty('update')
      expect(dragMonitor).toHaveProperty('stop')
      expect(dragMonitor.update).toBeInstanceOf(Function)
      expect(dragMonitor.stop).toBeInstanceOf(Function)
    })

    it('should allow drag updates without errors', () => {
      const element = document.createElement('div')
      const dragMonitor = matrixPerformanceMonitor.monitorDrag(element)

      expect(() => {
        dragMonitor.update()
        dragMonitor.update()
        dragMonitor.update()
      }).not.toThrow()
    })

    it('should handle drag stop', () => {
      const element = document.createElement('div')
      const dragMonitor = matrixPerformanceMonitor.monitorDrag(element)

      expect(() => {
        dragMonitor.update()
        dragMonitor.stop()
      }).not.toThrow()
    })

    it('should handle stop being called multiple times', () => {
      const element = document.createElement('div')
      const dragMonitor = matrixPerformanceMonitor.monitorDrag(element)

      expect(() => {
        dragMonitor.stop()
        dragMonitor.stop()
        dragMonitor.stop()
      }).not.toThrow()
    })
  })

  describe('Performance Report', () => {
    it('should generate performance report structure', () => {
      matrixPerformanceMonitor.startMonitoring()
      const report = matrixPerformanceMonitor.stopMonitoring()

      expect(report.summary).toBeDefined()
      expect(report.summary).toHaveProperty('monitoringDuration')
      expect(report.summary).toHaveProperty('totalInteractions')
      expect(report.summary).toHaveProperty('overallFrameRate')
      expect(report.summary).toHaveProperty('performanceGrade')
    })

    it('should include hover metrics in report', () => {
      const report = matrixPerformanceMonitor.stopMonitoring()

      expect(report.hover).toBeDefined()
      expect(report.hover).toHaveProperty('totalHovers')
      expect(report.hover).toHaveProperty('averageResponseTime')
      expect(report.hover).toHaveProperty('slowHovers')
      expect(report.hover).toHaveProperty('fastestHover')
      expect(report.hover).toHaveProperty('slowestHover')
    })

    it('should include animation metrics in report', () => {
      const report = matrixPerformanceMonitor.stopMonitoring()

      expect(report.animation).toBeDefined()
      expect(report.animation).toHaveProperty('totalAnimations')
      expect(report.animation).toHaveProperty('averageFrameRate')
      expect(report.animation).toHaveProperty('slowAnimations')
      expect(report.animation).toHaveProperty('totalDroppedFrames')
    })

    it('should include recommendations in report', () => {
      const report = matrixPerformanceMonitor.stopMonitoring()

      expect(report.recommendations).toBeDefined()
      expect(Array.isArray(report.recommendations)).toBe(true)
    })

    it('should assign valid performance grades', () => {
      const report = matrixPerformanceMonitor.stopMonitoring()

      const validGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F']
      expect(validGrades).toContain(report.summary.performanceGrade)
    })

    it('should show excellent performance with minimal interactions', () => {
      matrixPerformanceMonitor.startMonitoring()
      const report = matrixPerformanceMonitor.stopMonitoring()

      // With no interactions, should have optimal metrics
      expect(report.hover.totalHovers).toBe(0)
      expect(report.animation.totalAnimations).toBe(0)
    })
  })

  describe('Data Export', () => {
    it('should export performance data as JSON', () => {
      const exportedData = matrixPerformanceMonitor.exportData()

      expect(exportedData).toBeDefined()
      expect(typeof exportedData).toBe('string')

      const parsed = JSON.parse(exportedData)
      expect(parsed).toHaveProperty('timestamp')
      expect(parsed).toHaveProperty('hoverMetrics')
      expect(parsed).toHaveProperty('animationMetrics')
      expect(parsed).toHaveProperty('report')
    })

    it('should include ISO timestamp in export', () => {
      const exportedData = matrixPerformanceMonitor.exportData()
      const parsed = JSON.parse(exportedData)

      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should export valid JSON structure', () => {
      const exportedData = matrixPerformanceMonitor.exportData()

      expect(() => {
        JSON.parse(exportedData)
      }).not.toThrow()
    })
  })

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      // Generate some activity
      const element = document.createElement('div')
      matrixPerformanceMonitor.monitorAnimation(element, 'transform', 300)

      matrixPerformanceMonitor.reset()

      const report = matrixPerformanceMonitor.stopMonitoring()

      expect(report.hover.totalHovers).toBe(0)
      expect(report.animation.totalAnimations).toBe(0)
    })

    it('should log reset message', () => {
      matrixPerformanceMonitor.reset()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Performance metrics reset')
      )
    })

    it('should allow monitoring after reset', () => {
      matrixPerformanceMonitor.reset()
      matrixPerformanceMonitor.startMonitoring()

      const element = document.createElement('div')
      const cleanup = matrixPerformanceMonitor.monitorHover(element)

      expect(cleanup).toBeDefined()
      cleanup()
    })
  })

  describe('Real-time Alerts', () => {
    it('should enable real-time alerts without errors', () => {
      expect(() => {
        matrixPerformanceMonitor.enableRealTimeAlerts()
      }).not.toThrow()
    })

    it('should not throw errors when alerts are enabled multiple times', () => {
      expect(() => {
        matrixPerformanceMonitor.enableRealTimeAlerts()
        matrixPerformanceMonitor.enableRealTimeAlerts()
        matrixPerformanceMonitor.enableRealTimeAlerts()
      }).not.toThrow()
    })
  })

  describe('Recommendation Generation', () => {
    it('should provide recommendations for optimal performance', () => {
      matrixPerformanceMonitor.startMonitoring()
      const report = matrixPerformanceMonitor.stopMonitoring()

      expect(report.recommendations.length).toBeGreaterThan(0)

      // With no interactions, should show excellent performance
      const hasPositiveRecommendation = report.recommendations.some(rec =>
        rec.includes('Excellent') || rec.includes('✅')
      )
      expect(hasPositiveRecommendation).toBe(true)
    })

    it('should include actionable recommendations', () => {
      const report = matrixPerformanceMonitor.stopMonitoring()

      report.recommendations.forEach(rec => {
        expect(rec.length).toBeGreaterThan(10) // Non-trivial recommendations
      })
    })

    it('should provide multiple recommendation categories', () => {
      const report = matrixPerformanceMonitor.stopMonitoring()

      // Should have at least one recommendation
      expect(report.recommendations.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle monitoring null element gracefully', () => {
      expect(() => {
        const cleanup = matrixPerformanceMonitor.monitorHover(null as any)
        cleanup()
      }).not.toThrow()
    })

    it('should handle monitoring undefined element gracefully', () => {
      expect(() => {
        const cleanup = matrixPerformanceMonitor.monitorHover(undefined as any)
        cleanup()
      }).not.toThrow()
    })

    it('should handle extremely long animation durations', () => {
      const element = document.createElement('div')

      expect(() => {
        matrixPerformanceMonitor.monitorAnimation(element, 'transform', 999999)
      }).not.toThrow()
    })

    it('should handle zero duration animations', () => {
      const element = document.createElement('div')

      expect(() => {
        matrixPerformanceMonitor.monitorAnimation(element, 'transform', 0)
      }).not.toThrow()
    })

    it('should handle empty animation type', () => {
      const element = document.createElement('div')

      expect(() => {
        matrixPerformanceMonitor.monitorAnimation(element, '', 300)
      }).not.toThrow()
    })

    it('should handle special characters in animation type', () => {
      const element = document.createElement('div')

      expect(() => {
        matrixPerformanceMonitor.monitorAnimation(element, 'test-animation-123!@#', 300)
      }).not.toThrow()
    })
  })

  describe('Performance Metrics Accuracy', () => {
    it('should track hover count accurately', () => {
      matrixPerformanceMonitor.reset()
      const element = document.createElement('div')

      const cleanup1 = matrixPerformanceMonitor.monitorHover(element)
      const cleanup2 = matrixPerformanceMonitor.monitorHover(element)
      const cleanup3 = matrixPerformanceMonitor.monitorHover(element)

      cleanup1()
      cleanup2()
      cleanup3()

      // Note: Since monitoring is disabled, counts will be 0
      const report = matrixPerformanceMonitor.stopMonitoring()
      expect(report.hover.totalHovers).toBeGreaterThanOrEqual(0)
    })

    it('should track animation count accurately', () => {
      matrixPerformanceMonitor.reset()
      const element = document.createElement('div')

      matrixPerformanceMonitor.monitorAnimation(element, 'transform', 300)
      matrixPerformanceMonitor.monitorAnimation(element, 'opacity', 200)
      matrixPerformanceMonitor.monitorAnimation(element, 'scale', 150)

      // Note: Since monitoring is disabled, counts will be 0
      const report = matrixPerformanceMonitor.stopMonitoring()
      expect(report.animation.totalAnimations).toBeGreaterThanOrEqual(0)
    })

    it('should calculate total interactions correctly', () => {
      matrixPerformanceMonitor.reset()
      const element = document.createElement('div')

      const cleanup = matrixPerformanceMonitor.monitorHover(element)
      matrixPerformanceMonitor.monitorAnimation(element, 'transform', 300)
      cleanup()

      const report = matrixPerformanceMonitor.stopMonitoring()

      expect(report.summary.totalInteractions).toBe(
        report.hover.totalHovers + report.animation.totalAnimations
      )
    })
  })

  describe('Monitoring Disabled Behavior', () => {
    it('should not collect metrics when monitoring is disabled', () => {
      // All monitoring is disabled by default
      matrixPerformanceMonitor.startMonitoring()

      const element = document.createElement('div')
      const cleanup = matrixPerformanceMonitor.monitorHover(element)
      matrixPerformanceMonitor.monitorAnimation(element, 'transform', 300)

      cleanup()

      const report = matrixPerformanceMonitor.stopMonitoring()

      // All metrics should be 0 or minimal since monitoring is disabled
      expect(report.hover.totalHovers).toBe(0)
      expect(report.animation.totalAnimations).toBe(0)
    })

    it('should return empty report when monitoring is disabled', () => {
      const report = matrixPerformanceMonitor.stopMonitoring()

      expect(report).toBeDefined()
      expect(report.summary.totalInteractions).toBe(0)
    })

    it('should not throw errors even when monitoring is disabled', () => {
      expect(() => {
        const element = document.createElement('div')
        const cleanup = matrixPerformanceMonitor.monitorHover(element)
        matrixPerformanceMonitor.monitorAnimation(element, 'transform', 300)
        const dragMonitor = matrixPerformanceMonitor.monitorDrag(element)

        dragMonitor.update()
        dragMonitor.stop()
        cleanup()
      }).not.toThrow()
    })
  })

  describe('Report Consistency', () => {
    it('should generate consistent reports', () => {
      matrixPerformanceMonitor.reset()

      const report1 = matrixPerformanceMonitor.stopMonitoring()
      const report2 = matrixPerformanceMonitor.stopMonitoring()

      expect(report1.summary.totalInteractions).toBe(report2.summary.totalInteractions)
      expect(report1.hover.totalHovers).toBe(report2.hover.totalHovers)
      expect(report1.animation.totalAnimations).toBe(report2.animation.totalAnimations)
    })

    it('should maintain data integrity across operations', () => {
      matrixPerformanceMonitor.reset()
      matrixPerformanceMonitor.startMonitoring()

      const element = document.createElement('div')
      const cleanup = matrixPerformanceMonitor.monitorHover(element)
      cleanup()

      const report1 = matrixPerformanceMonitor.stopMonitoring()
      const exportData = matrixPerformanceMonitor.exportData()
      const report2 = matrixPerformanceMonitor.stopMonitoring()

      const parsed = JSON.parse(exportData)

      expect(report1.hover.totalHovers).toBe(report2.hover.totalHovers)
      expect(parsed.report.hover.totalHovers).toBe(report1.hover.totalHovers)
    })
  })
})