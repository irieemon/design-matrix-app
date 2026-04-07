import { supabase, createAuthenticatedClientFromLocalStorage } from './supabase'
import { logger } from '../utils/logger'
import { getCsrfToken } from '../utils/cookieUtils'
import { ProjectFile } from '../types'

export interface UploadFileResult {
  success: boolean
  file?: ProjectFile
  error?: string
}

export interface DeleteFileResult {
  success: boolean
  error?: string
}

export class FileService {
  private static readonly BUCKET_NAME = 'project-files'
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

  /**
   * Upload a file to Supabase Storage and save metadata to database
   */
  static async uploadFile(
    file: File,
    projectId: string,
    contentPreview: string,
    uploadedBy?: string
  ): Promise<UploadFileResult> {
    try {
      logger.debug('🚀 Starting file upload:', {
        fileName: file.name,
        fileSize: file.size,
        projectId,
        uploadedBy
      })

      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
        }
      }

      // Generate unique file path with sanitized filename
      const fileExtension = file.name.split('.').pop() || ''
      const sanitizedFileName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid characters with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single underscore
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      const uniqueFileName = `${crypto.randomUUID()}_${sanitizedFileName}`
      const storagePath = `projects/${projectId}/files/${uniqueFileName}`

      logger.debug('📁 Upload path:', storagePath)

      // CRITICAL: Use lock-free authenticated client to avoid supabase-js #873 deadlock.
      // The singleton `supabase` client triggers an internal getSession() on storage/db calls,
      // which deadlocks on the auth lock when called from the upload hot path (anti-pattern #2).
      // See: src/lib/supabase.ts createAuthenticatedClientFromLocalStorage docs.
      const authedClient = createAuthenticatedClientFromLocalStorage()
      if (!authedClient) {
        return {
          success: false,
          error: 'Not authenticated. Please sign in again.'
        }
      }

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await authedClient.storage
        .from(this.BUCKET_NAME)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        logger.error('❌ Storage upload failed:', uploadError)
        return {
          success: false,
          error: `Upload failed: ${uploadError.message}`
        }
      }

      logger.debug('✅ File uploaded to storage:', uploadData.path)
      
      // Log detailed path information for debugging
      logger.debug('📋 Upload path details:', {
        uploadedPath: uploadData.path,
        originalStoragePath: storagePath,
        pathsMatch: uploadData.path === storagePath,
        bucketName: this.BUCKET_NAME
      })

      // Create file metadata record
      const fileRecord = {
        project_id: projectId,
        name: file.name,
        original_name: file.name,
        file_type: fileExtension.toLowerCase(),
        file_size: file.size,
        storage_path: uploadData.path, // This is the actual path returned by Supabase
        content_preview: contentPreview,
        mime_type: file.type,
        uploaded_by: uploadedBy || null,
        analysis_status: 'pending' // Initialize with pending status for AI analysis
      }

      const { data: dbData, error: dbError } = await authedClient
        .from('project_files')
        .insert([fileRecord])
        .select()
        .single()

      if (dbError) {
        logger.error('❌ Database insert failed:', dbError)

        // Cleanup: delete uploaded file if database insert fails (use same lock-free client)
        await this.cleanupFailedUpload(uploadData.path, authedClient)
        
        return {
          success: false,
          error: `Database error: ${dbError.message}`
        }
      }

      logger.debug('✅ File metadata saved to database:', dbData.id)

      // Convert database record to ProjectFile format
      const projectFile: ProjectFile = {
        id: dbData.id,
        project_id: dbData.project_id,
        name: dbData.name,
        original_name: dbData.original_name,
        file_type: dbData.file_type,
        file_size: dbData.file_size,
        mime_type: dbData.mime_type,
        storage_path: dbData.storage_path,
        content_preview: dbData.content_preview,
        uploaded_by: dbData.uploaded_by,
        created_at: dbData.created_at,
        updated_at: dbData.updated_at,
        analysis_status: dbData.analysis_status,
        ai_analysis: dbData.ai_analysis
      }

      // Trigger AI analysis in the background (fire and forget)
      // Works in both development and production
      this.triggerFileAnalysis(projectFile.id, projectId).catch(error => {
        logger.warn('⚠️ Background file analysis failed:', error)
      })

      return {
        success: true,
        file: projectFile
      }

    } catch (error) {
      logger.error('💥 Upload exception:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      }
    }
  }

  /**
   * Get all files for a project
   */
  static async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    try {
      logger.debug('📂 Loading files for project:', projectId)

      // CRITICAL FIX: Try to get authenticated client from localStorage first
      // On refresh, getSession() may timeout but localStorage has valid auth token
      // This ensures files query has proper auth context for RLS
      let client = supabase
      const fallbackClient = createAuthenticatedClientFromLocalStorage()
      if (fallbackClient) {
        logger.debug('📂 Using authenticated client from localStorage for files query')
        client = fallbackClient
      } else {
        logger.debug('📂 Using default supabase client for files query')
      }

      const { data, error } = await client
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('❌ Error loading project files:', error)
        logger.error('❌ Error details:', {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details
        })
        return []
      }

      const files: ProjectFile[] = (data || []).map(record => ({
        id: record.id,
        project_id: record.project_id,
        name: record.name,
        original_name: record.original_name,
        file_type: record.file_type,
        file_size: record.file_size,
        mime_type: record.mime_type,
        storage_path: record.storage_path,
        content_preview: record.content_preview,
        uploaded_by: record.uploaded_by,
        created_at: record.created_at,
        updated_at: record.updated_at,
        ai_analysis: record.ai_analysis,
        analysis_status: record.analysis_status
      }))

      logger.debug('📂 Loaded project files:', files.length)
      return files

    } catch (error) {
      logger.error('💥 Error loading project files:', error)
      return []
    }
  }

  /**
   * Delete a file from both storage and database
   */
  static async deleteFile(fileId: string): Promise<DeleteFileResult> {
    try {
      logger.debug('🗑️ Deleting file:', fileId)

      // First, get the file record to find storage path
      const { data: fileRecord, error: fetchError } = await supabase
        .from('project_files')
        .select('storage_path')
        .eq('id', fileId)
        .single()

      if (fetchError) {
        logger.error('❌ Error fetching file record:', fetchError)
        return {
          success: false,
          error: `Could not find file: ${fetchError.message}`
        }
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([fileRecord.storage_path])

      if (storageError) {
        logger.warn('⚠️ Storage deletion failed (continuing with DB cleanup):', storageError)
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('project_files')
        .delete()
        .eq('id', fileId)

      if (dbError) {
        logger.error('❌ Database deletion failed:', dbError)
        return {
          success: false,
          error: `Database deletion failed: ${dbError.message}`
        }
      }

      logger.debug('✅ File deleted successfully:', fileId)
      return { success: true }

    } catch (error) {
      logger.error('💥 Delete exception:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deletion error'
      }
    }
  }

  /**
   * Get signed URL for a file (works with private buckets)
   */
  static async getFileUrl(storagePath: string): Promise<string | null> {
    try {
      logger.debug('🔗 Getting signed URL for storage path:', storagePath)
      
      // Clean and normalize the storage path
      let cleanPath = storagePath
      
      // Remove any leading slashes that might cause issues
      if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1)
        logger.debug('🧹 Removed leading slash from path:', cleanPath)
      }
      
      // Log the exact path we're trying to access
      logger.debug('🎯 Attempting to access file at path:', cleanPath)
      logger.debug('📦 Using bucket:', this.BUCKET_NAME)
      
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(cleanPath, 3600) // URL valid for 1 hour

      if (error) {
        logger.error('❌ Error creating signed URL:', error)
        logger.error('❌ Storage path that failed:', cleanPath)
        logger.error('❌ Bucket name:', this.BUCKET_NAME)
        
        // Try to list files in the project directory to debug
        try {
          const pathParts = cleanPath.split('/')
          if (pathParts.length >= 2) {
            const projectPath = `${pathParts[0]}/${pathParts[1]}`
            logger.debug('🔍 Listing files in project directory:', projectPath)
            
            const { data: fileList, error: listError } = await supabase.storage
              .from(this.BUCKET_NAME)
              .list(projectPath)
            
            if (listError) {
              logger.error('❌ Could not list project files:', listError)
            } else {
              logger.debug('📁 Files in project directory:', fileList?.map(f => f.name))
              
              // Check if there are files in the 'files' subdirectory
              if (pathParts.length >= 3) {
                const filesPath = `${pathParts[0]}/${pathParts[1]}/files`
                const { data: filesInDir, error: filesDirError } = await supabase.storage
                  .from(this.BUCKET_NAME)
                  .list(filesPath)
                
                if (!filesDirError && filesInDir) {
                  logger.debug('📁 Files in files subdirectory:', filesInDir.map(f => f.name))
                }
              }
            }
          }
        } catch (debugError) {
          logger.warn('⚠️ Debug file listing failed:', debugError)
        }
        
        return null
      }

      logger.debug('✅ Successfully created signed URL')
      return data.signedUrl
    } catch (error) {
      logger.error('❌ Error getting file URL:', error)
      return null
    }
  }

  /**
   * Clean up failed upload by deleting file from storage
   */
  private static async cleanupFailedUpload(storagePath: string, client?: any): Promise<void> {
    try {
      // Use lock-free client when provided (avoids supabase-js #873 deadlock on hot path)
      const c = client || createAuthenticatedClientFromLocalStorage() || supabase
      await c.storage
        .from(this.BUCKET_NAME)
        .remove([storagePath])
      logger.debug('🧹 Cleaned up failed upload:', storagePath)
    } catch (error) {
      logger.warn('⚠️ Could not cleanup failed upload:', error)
    }
  }

  /**
   * Trigger AI analysis for a file (background process)
   */
  private static async triggerFileAnalysis(fileId: string, projectId: string): Promise<void> {
    try {
      logger.debug('🤖 Triggering AI analysis for file:', fileId)
      
      // Supabase-js v2 stores the session JSON under SUPABASE_STORAGE_KEY, not under
      // a flat 'sb-access-token' key. Use getSession() as the canonical accessor.
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token || ''
      const csrfToken = getCsrfToken()
      const response = await fetch('/api/ai?action=analyze-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          fileId,
          projectId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Analysis API error: ${response.status} - ${errorData.error}`)
      }

      const result = await response.json()
      logger.debug('✅ File analysis completed:', result.cached ? 'cached' : 'new')

    } catch (error) {
      logger.error('❌ File analysis trigger failed:', error)
      throw error
    }
  }

  /**
   * Initialize storage bucket if it doesn't exist (for development)
   */
  static async initializeBucket(): Promise<void> {
    try {
      const { data: buckets } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some(bucket => bucket.name === this.BUCKET_NAME)
      
      if (!bucketExists) {
        logger.debug('🪣 Creating storage bucket:', this.BUCKET_NAME)
        const { error } = await supabase.storage.createBucket(this.BUCKET_NAME, {
          public: false,
          allowedMimeTypes: ['*/*'],
          fileSizeLimit: this.MAX_FILE_SIZE
        })
        
        if (error) {
          logger.error('❌ Could not create bucket:', error)
        } else {
          logger.debug('✅ Storage bucket created:', this.BUCKET_NAME)
        }
      }
    } catch (error) {
      logger.warn('⚠️ Bucket initialization failed:', error)
    }
  }
}