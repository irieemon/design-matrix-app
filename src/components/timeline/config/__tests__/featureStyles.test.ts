import { describe, it, expect } from 'vitest'
import { getFeatureStyles } from '../featureStyles'

describe('getFeatureStyles', () => {
  describe('priority-based styling', () => {
    it('should return high priority styling', () => {
      const styles = getFeatureStyles('high', 'planned')

      expect(styles).toEqual({
        bgColor: 'bg-red-200',
        textColor: 'text-red-800',
        borderColor: 'border-red-400'
      })
    })

    it('should return medium priority styling', () => {
      const styles = getFeatureStyles('medium', 'planned')

      expect(styles).toEqual({
        bgColor: 'bg-yellow-200',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-400'
      })
    })

    it('should return low priority styling', () => {
      const styles = getFeatureStyles('low', 'planned')

      expect(styles).toEqual({
        bgColor: 'bg-blue-200',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-400'
      })
    })
  })

  describe('status-based styling', () => {
    it('should apply completed status styling', () => {
      const highCompleted = getFeatureStyles('high', 'completed')
      const mediumCompleted = getFeatureStyles('medium', 'completed')
      const lowCompleted = getFeatureStyles('low', 'completed')

      // All completed features should have same styling regardless of priority
      expect(highCompleted).toEqual({
        bgColor: 'bg-slate-300',
        textColor: 'text-slate-600',
        borderColor: 'border-slate-400'
      })

      expect(mediumCompleted).toEqual({
        bgColor: 'bg-slate-300',
        textColor: 'text-slate-600',
        borderColor: 'border-slate-400'
      })

      expect(lowCompleted).toEqual({
        bgColor: 'bg-slate-300',
        textColor: 'text-slate-600',
        borderColor: 'border-slate-400'
      })
    })

    it('should apply in-progress status styling', () => {
      const highInProgress = getFeatureStyles('high', 'in-progress')
      const mediumInProgress = getFeatureStyles('medium', 'in-progress')
      const lowInProgress = getFeatureStyles('low', 'in-progress')

      expect(highInProgress).toEqual({
        bgColor: 'bg-red-300', // 200 -> 300 for more saturation
        textColor: 'text-red-800',
        borderColor: 'border-red-400'
      })

      expect(mediumInProgress).toEqual({
        bgColor: 'bg-yellow-300',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-400'
      })

      expect(lowInProgress).toEqual({
        bgColor: 'bg-blue-300',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-400'
      })
    })

    it('should apply planned status styling (default)', () => {
      const highPlanned = getFeatureStyles('high', 'planned')
      const mediumPlanned = getFeatureStyles('medium', 'planned')
      const lowPlanned = getFeatureStyles('low', 'planned')

      expect(highPlanned).toEqual({
        bgColor: 'bg-red-200',
        textColor: 'text-red-800',
        borderColor: 'border-red-400'
      })

      expect(mediumPlanned).toEqual({
        bgColor: 'bg-yellow-200',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-400'
      })

      expect(lowPlanned).toEqual({
        bgColor: 'bg-blue-200',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-400'
      })
    })
  })

  describe('status override behavior', () => {
    it('should override priority styling for completed status', () => {
      // High priority completed should not be red
      const highCompleted = getFeatureStyles('high', 'completed')
      expect(highCompleted.bgColor).toBe('bg-slate-300')
      expect(highCompleted.bgColor).not.toBe('bg-red-200')
      expect(highCompleted.bgColor).not.toBe('bg-red-300')
    })

    it('should modify but not override priority styling for in-progress status', () => {
      const highInProgress = getFeatureStyles('high', 'in-progress')

      // Should still be red-based but with increased saturation
      expect(highInProgress.bgColor).toBe('bg-red-300')
      expect(highInProgress.textColor).toBe('text-red-800')
      expect(highInProgress.borderColor).toBe('border-red-400')
    })

    it('should preserve priority styling for planned status', () => {
      const highPlanned = getFeatureStyles('high', 'planned')

      // Should maintain original priority styling
      expect(highPlanned.bgColor).toBe('bg-red-200')
      expect(highPlanned.textColor).toBe('text-red-800')
      expect(highPlanned.borderColor).toBe('border-red-400')
    })
  })

  describe('edge cases', () => {
    it('should handle invalid priority gracefully', () => {
      // @ts-expect-error Testing invalid priority
      const styles = getFeatureStyles('invalid' as any, 'planned')

      expect(styles).toEqual({
        bgColor: 'bg-slate-200',
        textColor: 'text-slate-800',
        borderColor: 'border-slate-400'
      })
    })

    it('should handle invalid status gracefully', () => {
      // @ts-expect-error Testing invalid status
      const styles = getFeatureStyles('high', 'invalid' as any)

      expect(styles).toEqual({
        bgColor: 'bg-red-200',
        textColor: 'text-red-800',
        borderColor: 'border-red-400'
      })
    })

    it('should handle both invalid priority and status', () => {
      // @ts-expect-error Testing invalid inputs
      const styles = getFeatureStyles('invalid' as any, 'invalid' as any)

      expect(styles).toEqual({
        bgColor: 'bg-slate-200',
        textColor: 'text-slate-800',
        borderColor: 'border-slate-400'
      })
    })
  })

  describe('comprehensive status and priority combinations', () => {
    const priorities = ['high', 'medium', 'low'] as const
    const statuses = ['planned', 'in-progress', 'completed'] as const

    it('should return valid styling for all combinations', () => {
      priorities.forEach(priority => {
        statuses.forEach(status => {
          const styles = getFeatureStyles(priority, status)

          // Verify all required properties are present
          expect(styles).toHaveProperty('bgColor')
          expect(styles).toHaveProperty('textColor')
          expect(styles).toHaveProperty('borderColor')

          // Verify they are non-empty strings
          expect(typeof styles.bgColor).toBe('string')
          expect(typeof styles.textColor).toBe('string')
          expect(typeof styles.borderColor).toBe('string')
          expect(styles.bgColor.length).toBeGreaterThan(0)
          expect(styles.textColor.length).toBeGreaterThan(0)
          expect(styles.borderColor.length).toBeGreaterThan(0)

          // Verify they follow Tailwind CSS class naming conventions
          expect(styles.bgColor).toMatch(/^bg-\w+-\d+$/)
          expect(styles.textColor).toMatch(/^text-\w+-\d+$/)
          expect(styles.borderColor).toMatch(/^border-\w+-\d+$/)
        })
      })
    })

    it('should have consistent completed styling regardless of priority', () => {
      const completedStyles = priorities.map(priority => getFeatureStyles(priority, 'completed'))

      // All completed styles should be identical
      const firstCompleted = completedStyles[0]
      completedStyles.forEach(style => {
        expect(style).toEqual(firstCompleted)
      })
    })

    it('should maintain priority distinctions for planned and in-progress statuses', () => {
      const plannedStyles = priorities.map(priority => getFeatureStyles(priority, 'planned'))
      const inProgressStyles = priorities.map(priority => getFeatureStyles(priority, 'in-progress'))

      // All planned styles should be different from each other
      expect(plannedStyles[0]).not.toEqual(plannedStyles[1])
      expect(plannedStyles[1]).not.toEqual(plannedStyles[2])
      expect(plannedStyles[0]).not.toEqual(plannedStyles[2])

      // All in-progress styles should be different from each other
      expect(inProgressStyles[0]).not.toEqual(inProgressStyles[1])
      expect(inProgressStyles[1]).not.toEqual(inProgressStyles[2])
      expect(inProgressStyles[0]).not.toEqual(inProgressStyles[2])
    })
  })
})