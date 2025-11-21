/**
 * Storage Path Debugger Utility
 * Helps diagnose and fix Supabase storage path issues
 */

import { supabase } from './supabase'
import { logger } from '../utils/logger'

export class StorageDebugger {
  private static readonly BUCKET_NAME = 'project-files'

  /**
   * Debug file access issues by checking the actual storage structure
   */
  static async debugFileAccess(projectId: string, fileName?: string): Promise<void> {
    logger.debug('🔍 Starting storage debug for project:', projectId)
    
    try {
      // List all files in the project directory
      const projectPath = `projects/${projectId}`
      logger.debug('📁 Listing files in:', projectPath)
      
      const { data: projectFiles, error: projectError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(projectPath)
      
      if (projectError) {
        logger.error('❌ Could not list project directory:', projectError)
        return
      }
      
      logger.debug('📋 Project directory contents:', projectFiles?.map(f => f.name))
      
      // Check files subdirectory
      const filesPath = `${projectPath}/files`
      const { data: filesInDir, error: filesDirError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(filesPath)
      
      if (!filesDirError && filesInDir) {
        logger.debug('📁 Files in /files subdirectory:', filesInDir.map(f => ({
          name: f.name,
          size: f.metadata?.size,
          lastModified: f.updated_at
        })))
        
        // If looking for a specific file, try to find it
        if (fileName) {
          const matchingFiles = filesInDir.filter(f => 
            f.name.includes(fileName) || fileName.includes(f.name)
          )
          
          if (matchingFiles.length > 0) {
            logger.debug('🎯 Found matching files:', matchingFiles.map(f => f.name))
            
            // Try to get signed URLs for matching files
            for (const file of matchingFiles) {
              const fullPath = `${filesPath}/${file.name}`
              logger.debug('🔗 Testing signed URL for:', fullPath)
              
              const { data, error } = await supabase.storage
                .from(this.BUCKET_NAME)
                .createSignedUrl(fullPath, 60) // 1 minute test URL
              
              if (error) {
                logger.error('❌ Failed to create signed URL:', error)
              } else {
                logger.debug('✅ Successfully created signed URL for:', file.name, 'URL length:', data?.signedUrl?.length || 0)
              }
            }
          } else {
            logger.warn('⚠️ No matching files found for:', fileName)
          }
        }
      } else {
        logger.warn('⚠️ No files found in /files subdirectory:', filesDirError)
      }
      
    } catch (_error) {
      logger.error('💥 Storage debug failed:', error)
    }
  }

  /**
   * Verify database storage_path values match actual storage structure
   */
  static async verifyDatabasePaths(projectId: string): Promise<void> {
    logger.debug('🔍 Verifying database paths for project:', projectId)
    
    try {
      // Get all files from database
      const { data: dbFiles, error: dbError } = await supabase
        .from('project_files')
        .select('id, name, storage_path')
        .eq('project_id', projectId)
      
      if (dbError) {
        logger.error('❌ Could not fetch database files:', dbError)
        return
      }
      
      logger.debug('📋 Database files found:', dbFiles?.length || 0)
      
      // Check each file in storage
      for (const file of dbFiles || []) {
        logger.debug('🔍 Checking file:', file.name, 'at path:', file.storage_path)
        
        const { data, error } = await supabase.storage
          .from(this.BUCKET_NAME)
          .createSignedUrl(file.storage_path, 60) // 1 minute test URL
        
        if (error) {
          logger.error('❌ File not accessible in storage:', {
            id: file.id,
            name: file.name,
            storagePath: file.storage_path,
            error: error.message
          })
        } else {
          logger.debug('✅ File accessible:', file.name, 'URL length:', data?.signedUrl?.length || 0)
        }
      }
      
    } catch (_error) {
      logger.error('💥 Database path verification failed:', error)
    }
  }

  /**
   * List all files in storage for a project
   */
  static async listAllProjectFiles(projectId: string): Promise<void> {
    logger.debug('📁 Listing all storage files for project:', projectId)
    
    try {
      const projectPath = `projects/${projectId}`
      
      // Recursive function to list all files
      const listRecursive = async (path: string, depth = 0): Promise<void> => {
        const indent = '  '.repeat(depth)
        logger.debug(`${indent}📂 Checking: ${path}`)
        
        const { data: items, error } = await supabase.storage
          .from(this.BUCKET_NAME)
          .list(path)
        
        if (error) {
          logger.error(`${indent}❌ Error listing ${path}:`, error)
          return
        }
        
        for (const item of items || []) {
          if (item.name) {
            const itemPath = path ? `${path}/${item.name}` : item.name
            
            // If it's a file (has metadata), show it
            if (item.metadata) {
              logger.debug(`${indent}📄 ${item.name} (${item.metadata.size} bytes)`)
            } else {
              // It's a directory, recurse into it
              logger.debug(`${indent}📁 ${item.name}/`)
              await listRecursive(itemPath, depth + 1)
            }
          }
        }
      }
      
      await listRecursive(projectPath)
      
    } catch (_error) {
      logger.error('💥 Failed to list project files:', error)
    }
  }

  /**
   * Test file upload and retrieval flow
   */
  static async testUploadRetrievalFlow(projectId: string): Promise<void> {
    logger.debug('🧪 Testing upload/retrieval flow for project:', projectId)
    
    try {
      // Create a test file
      const testContent = 'This is a test file for debugging storage paths'
      const testBlob = new Blob([testContent], { type: 'text/plain' })
      const testFile = new File([testBlob], 'debug_test.txt', { type: 'text/plain' })
      
      // Upload the test file
      const uniqueFileName = `debug_${Date.now()}_test.txt`
      const storagePath = `projects/${projectId}/files/${uniqueFileName}`
      
      logger.debug('📤 Uploading test file to:', storagePath)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(storagePath, testFile)
      
      if (uploadError) {
        logger.error('❌ Test upload failed:', uploadError)
        return
      }
      
      logger.debug('✅ Test file uploaded:', uploadData.path)
      
      // Try to retrieve it immediately
      const { data: retrieveData, error: retrieveError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(uploadData.path, 300) // 5 minutes
      
      if (retrieveError) {
        logger.error('❌ Test retrieval failed:', retrieveError)
      } else {
        logger.debug('✅ Test file retrieved successfully:', retrieveData.signedUrl)
      }
      
      // Clean up test file
      const { error: deleteError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([uploadData.path])
      
      if (deleteError) {
        logger.warn('⚠️ Failed to clean up test file:', deleteError)
      } else {
        logger.debug('🗑️ Test file cleaned up')
      }
      
    } catch (_error) {
      logger.error('💥 Upload/retrieval test failed:', error)
    }
  }
}