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
    } catch (_error) {
      logger.error('❌ Error loading project files from backend:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load files when current project changes and set up real-time subscription + polling
  useEffect(() => {
    if (currentProject?.id) {
      loadProjectFiles(currentProject.id)

      // Set up polling fallback for AI analysis status updates
      logger.debug('📊 Setting up polling for AI analysis status updates')
      const pollInterval = setInterval(async () => {
        try {
          const files = await FileService.getProjectFiles(currentProject.id)

          setProjectFiles(prev => {
            const currentFiles = prev[currentProject.id] || []

            // Check if any file status has changed
            const hasStatusChanges = files.some(file => {
              const current = currentFiles.find(f => f.id === file.id)
              return current && current.analysis_status !== file.analysis_status
            })

            if (hasStatusChanges) {
              logger.debug('📊 Detected AI analysis status changes, updating UI...')
              return {
                ...prev,
                [currentProject.id]: files
              }
            }

            return prev
          })
        } catch (_error) {
          logger.error('❌ Error polling for status updates:', error)
        }
      }, 5000) // Poll every 5 seconds

      // Set up real-time subscription for file updates (non-blocking - polling fallback available)
      logger.debug('🔔 Setting up real-time subscription for project files:', currentProject.id)

      let subscription: any = null

      try {
        subscription = supabase
          .channel(`project_files_${currentProject.id}`)
          .on('broadcast', { event: 'test' }, payload => {
            logger.debug('🔔 Broadcast test received:', payload)
          })
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'project_files'
              // Removed filter to prevent binding mismatch - filter in callback instead
            },
            (payload) => {
              logger.debug('🔔 Real-time file insert received:', payload)

              // Add new file to state if it's not already there
              if (payload.new) {
                const newFile = payload.new as any

                // Filter client-side to avoid binding mismatch
                if (newFile.project_id !== currentProject.id) {
                  logger.debug('⏭️ Skipping insert for different project')
                  return
                }
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
              table: 'project_files'
              // Removed filter to prevent binding mismatch - filter in callback instead
            },
            (payload) => {
              logger.debug('🔔 Real-time file update received:', payload)
              logger.debug('🔔 Payload details:', {
                old: payload.old,
                new: payload.new,
                eventType: payload.eventType
              })

              // Update the specific file in state
              if (payload.new) {
                const updatedFile = payload.new as any

                // Filter client-side to avoid binding mismatch
                if (updatedFile.project_id !== currentProject.id) {
                  logger.debug('⏭️ Skipping update for different project')
                  return
                }
                logger.debug('🔔 Processing update for file:', updatedFile.id, {
                  oldStatus: payload.old?.analysis_status,
                  newStatus: updatedFile.analysis_status,
                  hasAiAnalysis: !!updatedFile.ai_analysis
                })

                setProjectFiles(prev => {
                  const currentFiles = prev[currentProject.id] || []
                  logger.debug('🔔 Current files in state:', currentFiles.map(f => ({ id: f.id, status: f.analysis_status })))

                  // Check if file exists in current state
                  const fileExists = currentFiles.some(file => file.id === updatedFile.id)
                  if (!fileExists) {
                    logger.debug('⚠️ File not found in current state, skipping update:', updatedFile.id)
                    logger.debug('⚠️ Available file IDs:', currentFiles.map(f => f.id))
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
                  logger.debug('✅ Updated files after change:', updatedFiles.map(f => ({ id: f.id, status: f.analysis_status })))

                  return {
                    ...prev,
                    [currentProject.id]: updatedFiles
                  }
                })
              } else {
                logger.debug('⚠️ No payload.new in UPDATE event')
              }
            }
          )
          .subscribe((status, err) => {
            logger.debug('🔔 Subscription status:', status, err)
            if (status === 'SUBSCRIBED') {
              logger.debug('✅ Successfully subscribed to real-time updates for project:', currentProject.id)
            } else if (status === 'CLOSED') {
              logger.debug('🔴 Subscription closed for project:', currentProject.id)
            } else if (status === 'CHANNEL_ERROR') {
              // NON-BLOCKING: Log error but don't crash - polling fallback will handle updates
              logger.warn('⚠️ Channel error for project (non-blocking, using polling fallback):', currentProject.id, err)
            }
          })

        // Test the subscription by sending a broadcast after setup
        setTimeout(() => {
          if (subscription) {
            logger.debug('🧪 Testing subscription with broadcast...')
            subscription.send({
              type: 'broadcast',
              event: 'test',
              payload: { message: 'test from useProjectFiles' }
            })
          }
        }, 2000)
      } catch (_error) {
        // NON-BLOCKING: If subscription setup fails, just log and continue with polling
        logger.warn('⚠️ Failed to set up real-time subscription (non-blocking, using polling fallback):', error)
      }

      // Cleanup subscription and polling on unmount or project change
      return () => {
        logger.debug('🔇 Cleaning up real-time subscription and polling for project:', currentProject.id)
        if (subscription) {
          try {
            subscription.unsubscribe()
          } catch (_error) {
            logger.warn('⚠️ Error unsubscribing from channel:', error)
          }
        }
        clearInterval(pollInterval)
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
    } catch (_error) {
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