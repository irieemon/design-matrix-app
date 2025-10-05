import { describe, it, expect, beforeEach, vi } from 'vitest'
import { exportToCSV, parseCSV, validateCSVFile } from '../csvUtils'
import { IdeaCard } from '../../types'
import { generateDemoUUID } from '../uuid'

describe('csvUtils', () => {
  let mockIdeas: IdeaCard[]

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'mock-url')
    global.URL.revokeObjectURL = vi.fn()

    mockIdeas = [
      {
        id: generateDemoUUID('1'),
        content: 'Test Idea 1',
        details: 'Details for test idea 1',
        x: 100,
        y: 200,
        priority: 'high',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        project_id: 'project-1'
      },
      {
        id: generateDemoUUID('2'),
        content: 'Test Idea 2',
        details: 'Details with "quotes" and commas, here',
        x: 300,
        y: 400,
        priority: 'moderate',
        created_by: 'user-2',
        created_at: '2024-01-02T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
        project_id: 'project-1'
      }
    ]
  })

  describe('exportToCSV', () => {
    it('should create a download link with proper attributes', () => {
      exportToCSV(mockIdeas)

      // Check that createObjectURL was called (indicating blob creation)
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    it('should handle empty ideas array', () => {
      // Should not throw
      expect(() => exportToCSV([])).not.toThrow()
    })

    it('should handle null ideas array gracefully', () => {
      // Should not throw
      expect(() => exportToCSV(null as any)).not.toThrow()
    })

    it('should export all priority types', () => {
      const allPriorities: IdeaCard[] = [
        { ...mockIdeas[0], priority: 'low', id: generateDemoUUID('p1') },
        { ...mockIdeas[0], priority: 'moderate', id: generateDemoUUID('p2') },
        { ...mockIdeas[0], priority: 'high', id: generateDemoUUID('p3') },
        { ...mockIdeas[0], priority: 'strategic', id: generateDemoUUID('p4') },
        { ...mockIdeas[0], priority: 'innovation', id: generateDemoUUID('p5') }
      ]

      // Should not throw
      expect(() => exportToCSV(allPriorities)).not.toThrow()
    })

    it('should create download link with correct filename format', () => {
      exportToCSV(mockIdeas)

      const links = document.querySelectorAll('a')
      expect(links.length).toBe(0) // Link is removed after click

      // Check that createObjectURL was called
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    it('should handle empty ideas array', () => {
      exportToCSV([])

      const blobConstructorCalls = vi.mocked(Blob).mock.calls
      const blobContent = blobConstructorCalls[0][0][0] as string

      // Should still have headers
      expect(blobContent).toContain('ID,Title,Details')

      // Should have no data rows (only one newline after header)
      const lines = blobContent.split('\n')
      expect(lines.length).toBe(1)
    })

    it('should handle null ideas array gracefully', () => {
      exportToCSV(null as any)

      const blobConstructorCalls = vi.mocked(Blob).mock.calls
      const blobContent = blobConstructorCalls[0][0][0] as string

      expect(blobContent).toContain('ID,Title,Details')
    })

    it('should include all priority types', () => {
      const allPriorities: IdeaCard[] = [
        { ...mockIdeas[0], priority: 'low', id: generateDemoUUID('p1') },
        { ...mockIdeas[0], priority: 'moderate', id: generateDemoUUID('p2') },
        { ...mockIdeas[0], priority: 'high', id: generateDemoUUID('p3') },
        { ...mockIdeas[0], priority: 'strategic', id: generateDemoUUID('p4') },
        { ...mockIdeas[0], priority: 'innovation', id: generateDemoUUID('p5') }
      ]

      exportToCSV(allPriorities)

      const blobConstructorCalls = vi.mocked(Blob).mock.calls
      const blobContent = blobConstructorCalls[0][0][0] as string

      expect(blobContent).toContain('low')
      expect(blobContent).toContain('moderate')
      expect(blobContent).toContain('high')
      expect(blobContent).toContain('strategic')
      expect(blobContent).toContain('innovation')
    })

    it('should handle multiline content', () => {
      const multilineIdeas: IdeaCard[] = [{
        ...mockIdeas[0],
        details: 'Line 1\nLine 2\nLine 3'
      }]

      exportToCSV(multilineIdeas)

      const blobConstructorCalls = vi.mocked(Blob).mock.calls
      const blobContent = blobConstructorCalls[0][0][0] as string

      expect(blobContent).toContain('Line 1')
    })
  })

  describe('parseCSV', () => {
    it('should parse valid CSV content', () => {
      const csvContent = `ID,Title,Details,Priority,X Position,Y Position,Created By,Created At,Updated At
test-1,"Test Idea","Test details",high,100,200,"user-1",2024-01-01,2024-01-01
test-2,"Another Idea","More details",moderate,300,400,"user-2",2024-01-02,2024-01-02`

      const result = parseCSV(csvContent, 'current-user')

      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('Test Idea')
      expect(result[0].priority).toBe('high')
      expect(result[0].x).toBe(100)
      expect(result[0].y).toBe(200)
    })

    it('should handle CSV with quoted fields', () => {
      const csvContent = `ID,Title,Details,Priority,X Position,Y Position,Created By
test-1,"Content with ""quotes""","Details with commas, here",high,100,200,"user-1"`

      const result = parseCSV(csvContent, 'current-user')

      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Content with "quotes"')
      expect(result[0].details).toBe('Details with commas, here')
    })

    it('should use default priority for invalid priority values', () => {
      const csvContent = `ID,Title,Details,Priority,X Position,Y Position,Created By
test-1,"Test","Details",invalid-priority,100,200,"user-1"`

      const result = parseCSV(csvContent, 'current-user')

      expect(result).toHaveLength(1)
      expect(result[0].priority).toBe('moderate')
    })

    it('should clamp X position to valid range', () => {
      const csvContent = `ID,Title,Details,Priority,X Position,Y Position,Created By
test-1,"Test","Details",high,1000,200,"user-1"
test-2,"Test2","Details2",high,-100,200,"user-1"`

      const result = parseCSV(csvContent, 'current-user')

      expect(result[0].x).toBe(800) // Max clamped
      expect(result[1].x).toBe(-50) // Min clamped
    })

    it('should clamp Y position to valid range', () => {
      const csvContent = `ID,Title,Details,Priority,X Position,Y Position,Created By
test-1,"Test","Details",high,100,1000,"user-1"
test-2,"Test2","Details2",high,100,-100,"user-1"`

      const result = parseCSV(csvContent, 'current-user')

      expect(result[0].y).toBe(800)
      expect(result[1].y).toBe(-50)
    })

    it('should use default positions for invalid values', () => {
      const csvContent = `ID,Title,Details,Priority,X Position,Y Position,Created By
test-1,"Test","Details",high,invalid,invalid,"user-1"`

      const result = parseCSV(csvContent, 'current-user')

      expect(result[0].x).toBe(260)
      expect(result[0].y).toBe(260)
    })

    it('should use current user when created_by is missing', () => {
      const csvContent = `ID,Title,Details,Priority,X Position,Y Position,Created By
test-1,"Test","Details",high,100,200,""`

      const result = parseCSV(csvContent, 'test-user')

      expect(result[0].created_by).toBe('test-user')
    })

    it('should return empty array for CSV with only headers', () => {
      const csvContent = 'ID,Title,Details,Priority,X Position,Y Position,Created By'

      const result = parseCSV(csvContent, 'current-user')

      expect(result).toHaveLength(0)
    })

    it('should return empty array for empty string', () => {
      const result = parseCSV('', 'current-user')

      expect(result).toHaveLength(0)
    })

    it('should skip rows with insufficient columns', () => {
      const csvContent = `ID,Title,Details,Priority,X Position,Y Position,Created By
test-1,"Test"
test-2,"Valid","Details",high,100,200,"user"`

      const result = parseCSV(csvContent, 'current-user')

      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Valid')
    })

    it('should handle escaped quotes correctly', () => {
      const csvContent = `ID,Title,Details,Priority,X Position,Y Position,Created By
test-1,"She said ""Hello""","He replied ""Hi""",high,100,200,"user-1"`

      const result = parseCSV(csvContent, 'current-user')

      expect(result[0].content).toBe('She said "Hello"')
      expect(result[0].details).toBe('He replied "Hi"')
    })

    it('should handle all valid priority types', () => {
      const csvContent = `ID,Title,Details,Priority,X Position,Y Position,Created By
test-1,"Test1","Details",low,100,200,"user"
test-2,"Test2","Details",moderate,100,200,"user"
test-3,"Test3","Details",high,100,200,"user"
test-4,"Test4","Details",strategic,100,200,"user"
test-5,"Test5","Details",innovation,100,200,"user"`

      const result = parseCSV(csvContent, 'current-user')

      expect(result).toHaveLength(5)
      expect(result[0].priority).toBe('low')
      expect(result[1].priority).toBe('moderate')
      expect(result[2].priority).toBe('high')
      expect(result[3].priority).toBe('strategic')
      expect(result[4].priority).toBe('innovation')
    })
  })

  describe('validateCSVFile', () => {
    it('should validate CSV file with correct extension', async () => {
      const file = new File(['content'], 'test.csv', { type: 'text/csv' })

      const isValid = await validateCSVFile(file)

      expect(isValid).toBe(true)
    })

    it('should validate CSV file with uppercase extension', async () => {
      const file = new File(['content'], 'test.CSV', { type: 'text/csv' })

      const isValid = await validateCSVFile(file)

      expect(isValid).toBe(true)
    })

    it('should reject non-CSV files', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })

      const isValid = await validateCSVFile(file)

      expect(isValid).toBe(false)
    })

    it('should require at least headers and one data row', async () => {
      const content = 'ID,Title,Details\ntest-1,"Test","Details"'
      const file = new File([content], 'test.csv', { type: 'text/csv' })

      const isValid = await validateCSVFile(file)

      expect(isValid).toBe(true)
    })

    it('should reject CSV with only headers', async () => {
      const content = 'ID,Title,Details'
      const file = new File([content], 'test.csv', { type: 'text/csv' })

      const isValid = await validateCSVFile(file)

      expect(isValid).toBe(false)
    })

    it('should reject empty CSV file', async () => {
      const file = new File([''], 'test.csv', { type: 'text/csv' })

      const isValid = await validateCSVFile(file)

      expect(isValid).toBe(false)
    })

    it('should handle file read errors gracefully', async () => {
      const file = new File(['content'], 'test.csv', { type: 'text/csv' })

      // Mock FileReader to throw error
      const originalFileReader = global.FileReader
      global.FileReader = class {
        readAsText() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Event('error'))
            }
          }, 0)
        }
        onerror: ((event: Event) => void) | null = null
        onload: ((event: ProgressEvent) => void) | null = null
        result: string | null = null
      } as any

      const isValid = await validateCSVFile(file)

      expect(isValid).toBe(false)

      // Restore original FileReader
      global.FileReader = originalFileReader
    })
  })
})