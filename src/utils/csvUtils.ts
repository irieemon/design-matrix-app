import { IdeaCard } from '../types'

// Export ideas to CSV format
export const exportToCSV = (ideas: IdeaCard[]): void => {
  const headers = [
    'ID',
    'Title', 
    'Details',
    'Priority',
    'X Position',
    'Y Position', 
    'Created By',
    'Created At',
    'Updated At'
  ]

  const csvContent = [
    headers.join(','),
    ...ideas.map(idea => [
      idea.id,
      `"${idea.content.replace(/"/g, '""')}"`, // Escape quotes
      `"${idea.details.replace(/"/g, '""')}"`,
      idea.priority,
      idea.x,
      idea.y,
      `"${idea.created_by}"`,
      idea.created_at,
      idea.updated_at
    ].join(','))
  ].join('\n')

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `design-matrix-ideas-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

// Parse CSV content and return ideas array
export const parseCSV = (csvContent: string, currentUser: string): Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>[] => {
  const lines = csvContent.trim().split('\n')
  if (lines.length <= 1) return [] // No data rows

  // const headers = lines[0].split(',').map(h => h.trim())
  const ideas: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    
    if (values.length >= 4) { // At minimum need title, details, priority, positions
      const idea = {
        content: cleanCSVValue(values[1] || ''),
        details: cleanCSVValue(values[2] || ''),
        priority: (values[3]?.trim() as IdeaCard['priority']) || 'moderate',
        x: parseInt(values[4]) || 260,
        y: parseInt(values[5]) || 260,
        created_by: cleanCSVValue(values[6]) || currentUser
      }

      // Validate priority
      const validPriorities = ['low', 'moderate', 'high', 'strategic', 'innovation']
      if (!validPriorities.includes(idea.priority)) {
        idea.priority = 'moderate'
      }

      // Validate positions
      idea.x = Math.max(-50, Math.min(800, idea.x))
      idea.y = Math.max(-50, Math.min(800, idea.y))

      ideas.push(idea)
    }
  }

  return ideas
}

// Parse a single CSV line handling quotes and commas
const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current) // Add last field
  return result
}

// Clean CSV value by removing surrounding quotes and unescaping
const cleanCSVValue = (value: string): string => {
  let cleaned = value.trim()
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1)
  }
  return cleaned.replace(/""/g, '"') // Unescape quotes
}

// Validate CSV file before import
export const validateCSVFile = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      resolve(false)
      return
    }
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const lines = content.trim().split('\n')
      
      // Check if it has at least headers and one data row
      resolve(lines.length >= 2)
    }
    reader.onerror = () => resolve(false)
    reader.readAsText(file)
  })
}