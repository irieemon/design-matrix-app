import { useState, useEffect } from 'react'
import { ProjectFile, Project } from '../types'
import { logger } from '../utils/logger'

interface UseProjectFilesReturn {
  projectFiles: Record<string, ProjectFile[]>
  getCurrentProjectFiles: () => ProjectFile[]
  handleFilesUploaded: (newFiles: ProjectFile[]) => void
  handleDeleteFile: (fileId: string) => void
}

export const useProjectFiles = (currentProject: Project | null): UseProjectFilesReturn => {
  // Initialize projectFiles from localStorage or empty object
  const [projectFiles, setProjectFiles] = useState<Record<string, ProjectFile[]>>(() => {
    try {
      const savedFiles = localStorage.getItem('project-files')
      logger.debug('Raw localStorage data:', savedFiles)
      if (savedFiles && savedFiles !== 'null' && savedFiles !== '{}') {
        const parsedFiles = JSON.parse(savedFiles)
        logger.debug('Initializing project files from localStorage:', parsedFiles)
        logger.debug('Number of projects with files:', Object.keys(parsedFiles).length)
        return parsedFiles
      } else {
        logger.debug('Initializing with empty project files (no valid data found)')
        return {}
      }
    } catch (error) {
      logger.error('Error loading project files from localStorage:', error)
      return {}
    }
  })

  // Save files to localStorage whenever projectFiles changes (but not on initial load)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return // Skip saving on initial component mount
    }
    
    try {
      const dataToSave = JSON.stringify(projectFiles)
      const sizeInMB = new Blob([dataToSave]).size / (1024 * 1024)
      logger.debug('💾 Saving project files to localStorage:', projectFiles)
      logger.debug('💾 Data size:', sizeInMB.toFixed(2), 'MB')
      
      if (sizeInMB > 5) { // localStorage limit is usually 5-10MB
        logger.warn('⚠️ File data is getting large, may hit localStorage limits')
      }
      
      localStorage.setItem('project-files', dataToSave)
      logger.debug('✅ Successfully saved to localStorage')
    } catch (error) {
      logger.error('❌ Error saving project files to localStorage:', error)
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert('Storage quota exceeded! Files are too large to store locally. Consider using smaller files or clearing old files.')
      }
    }
  }, [projectFiles, isInitialLoad])

  // File management functions
  const handleFilesUploaded = (newFiles: ProjectFile[]) => {
    if (!currentProject?.id) return
    
    logger.debug('📁 handleFilesUploaded called with:', newFiles.length, 'files for project:', currentProject.id)
    logger.debug('📁 New files:', newFiles)
    
    setProjectFiles(prev => {
      const updated = {
        ...prev,
        [currentProject.id]: [...(prev[currentProject.id] || []), ...newFiles]
      }
      logger.debug('📁 Updated project files state:', updated)
      return updated
    })
  }

  const handleDeleteFile = (fileId: string) => {
    if (!currentProject?.id) return
    
    setProjectFiles(prev => ({
      ...prev,
      [currentProject.id]: (prev[currentProject.id] || []).filter(f => f.id !== fileId)
    }))
  }

  // Get files for current project
  const getCurrentProjectFiles = (): ProjectFile[] => {
    if (!currentProject?.id) return []
    return projectFiles[currentProject.id] || []
  }

  return {
    projectFiles,
    getCurrentProjectFiles,
    handleFilesUploaded,
    handleDeleteFile
  }
}