import { useState, useEffect } from 'react'
import { ProjectFile, Project } from '../types'
import { logger } from '../utils/logger'
import { FileService } from '../lib/fileService'
import { supabase } from '../lib/supabase'

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

  // Load files when current project changes and set up real-time subscription
  useEffect(() => {
    if (currentProject?.id) {
      loadProjectFiles(currentProject.id)
      
      // Set up real-time subscription for file updates
      logger.debug('🔔 Setting up real-time subscription for project files:', currentProject.id)
      
      const subscription = supabase
        .channel(`project_files_${currentProject.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'project_files',
            filter: `project_id=eq.${currentProject.id}`
          },
          (payload) => {
            logger.debug('🔔 Real-time file insert received:', payload)
            
            // Add new file to state if it's not already there
            if (payload.new) {
              const newFile = payload.new as any
              setProjectFiles(prev => {
                const currentFiles = prev[currentProject.id] || []
                
                // Check if file already exists
                const fileExists = currentFiles.some(file => file.id === newFile.id)
                if (fileExists) {
                  logger.debug('⚠️ File already exists, skipping insert:', newFile.id)
                  return prev
                }
                
                logger.debug('✅ New file added in real-time:', newFile.id, 'Status:', newFile.analysis_status)
                
                return {
                  ...prev,
                  [currentProject.id]: [newFile, ...currentFiles]
                }
              })
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'project_files',
            filter: `project_id=eq.${currentProject.id}`
          },
          (payload) => {
            logger.debug('🔔 Real-time file update received:', payload)
            
            // Update the specific file in state
            if (payload.new) {
              const updatedFile = payload.new as any
              setProjectFiles(prev => {
                const currentFiles = prev[currentProject.id] || []
                
                // Check if file exists in current state
                const fileExists = currentFiles.some(file => file.id === updatedFile.id)
                if (!fileExists) {
                  logger.debug('⚠️ File not found in current state, skipping update:', updatedFile.id)
                  return prev
                }
                
                const updatedFiles = currentFiles.map(file => 
                  file.id === updatedFile.id 
                    ? { 
                        ...file, 
                        analysis_status: updatedFile.analysis_status,
                        ai_analysis: updatedFile.ai_analysis,
                        updated_at: updatedFile.updated_at
                      } 
                    : file
                )
                
                logger.debug('✅ File updated in real-time:', updatedFile.id, 'Status:', updatedFile.analysis_status)
                
                return {
                  ...prev,
                  [currentProject.id]: updatedFiles
                }
              })
            }
          }
        )
        .subscribe()
      
      // Cleanup subscription on unmount or project change
      return () => {
        logger.debug('🔇 Cleaning up real-time subscription for project:', currentProject.id)
        subscription.unsubscribe()
      }
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