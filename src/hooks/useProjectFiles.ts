import { useState, useEffect } from 'react'
import { ProjectFile, Project } from '../types'
import { logger } from '../utils/logger'
import { FileService } from '../lib/fileService'

interface UseProjectFilesReturn {
  projectFiles: Record<string, ProjectFile[]>
  getCurrentProjectFiles: () => ProjectFile[]
  handleFilesUploaded: (newFiles: ProjectFile[]) => void
  handleDeleteFile: (fileId: string) => void
  isLoading: boolean
  refreshProjectFiles: () => Promise<void>
}

export const useProjectFiles = (currentProject: Project | null): UseProjectFilesReturn => {
  const [projectFiles, setProjectFiles] = useState<Record<string, ProjectFile[]>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Load files from backend when project changes
  const loadProjectFiles = async (projectId: string) => {
    try {
      setIsLoading(true)
      logger.debug('📂 Loading files from backend for project:', projectId)
      
      const files = await FileService.getProjectFiles(projectId)
      
      setProjectFiles(prev => ({
        ...prev,
        [projectId]: files
      }))
      
      logger.debug('📂 Loaded project files from backend:', files.length)
    } catch (error) {
      logger.error('❌ Error loading project files from backend:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load files when current project changes
  useEffect(() => {
    if (currentProject?.id) {
      loadProjectFiles(currentProject.id)
    }
  }, [currentProject?.id])

  // Refresh function to manually reload files
  const refreshProjectFiles = async () => {
    if (currentProject?.id) {
      await loadProjectFiles(currentProject.id)
    }
  }

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

  const handleDeleteFile = async (fileId: string) => {
    if (!currentProject?.id) return
    
    try {
      logger.debug('🗑️ Deleting file:', fileId)
      const result = await FileService.deleteFile(fileId)
      
      if (result.success) {
        // Remove from local state
        setProjectFiles(prev => ({
          ...prev,
          [currentProject.id]: (prev[currentProject.id] || []).filter(f => f.id !== fileId)
        }))
        logger.debug('✅ File deleted successfully:', fileId)
      } else {
        logger.error('❌ Failed to delete file:', result.error)
        throw new Error(result.error)
      }
    } catch (error) {
      logger.error('💥 Error deleting file:', error)
      throw error
    }
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
    handleDeleteFile,
    isLoading,
    refreshProjectFiles
  }
}