import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
    const { action } = req.body
    
    // Initialize Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase configuration missing' })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    console.log('🔧 Storage repair action:', action)
    
    if (action === 'check_bucket') {
      // 1. Check if bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
      
      if (bucketsError) {
        console.error('❌ Cannot list buckets:', bucketsError)
        return res.status(500).json({ 
          error: 'Cannot access storage', 
          details: bucketsError,
          suggestions: [
            'Check if SUPABASE_SERVICE_ROLE_KEY is configured (not anon key)',
            'Verify Supabase project URL is correct',
            'Check if Storage API is enabled in Supabase dashboard'
          ]
        })
      }
      
      console.log('🪣 Available buckets:', buckets?.map(b => b.name) || [])
      
      const projectFilesBucket = buckets?.find(b => b.name === 'project-files')
      
      return res.status(200).json({
        bucketsFound: buckets?.length || 0,
        availableBuckets: buckets?.map(b => ({ name: b.name, id: b.id, public: b.public })) || [],
        projectFilesBucketExists: !!projectFilesBucket,
        projectFilesBucket: projectFilesBucket || null,
        needsRepair: !projectFilesBucket
      })
    }
    
    if (action === 'create_bucket') {
      // 2. Create the bucket if it doesn't exist
      console.log('🏗️ Creating project-files bucket...')
      
      const { data, error } = await supabase.storage.createBucket('project-files', {
        public: false, // Private bucket for user files
        allowedMimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*'],
        fileSizeLimit: 52428800 // 50MB limit
      })
      
      if (error) {
        console.error('❌ Failed to create bucket:', error)
        return res.status(500).json({ 
          error: 'Failed to create bucket', 
          details: error,
          suggestions: [
            'You may need SUPABASE_SERVICE_ROLE_KEY instead of anon key',
            'Check Storage permissions in Supabase dashboard',
            'Verify the bucket name is unique'
          ]
        })
      }
      
      console.log('✅ Bucket created:', data)
      return res.status(200).json({ 
        success: true, 
        bucket: data,
        message: 'project-files bucket created successfully'
      })
    }
    
    if (action === 'test_upload') {
      // 3. Test if we can upload a small test file
      console.log('🧪 Testing file upload...')
      
      const testContent = 'This is a test file to verify storage access'
      const testFile = new Blob([testContent], { type: 'text/plain' })
      
      const { data, error } = await supabase.storage
        .from('project-files')
        .upload('test/test-file.txt', testFile, {
          cacheControl: '3600',
          upsert: true
        })
      
      if (error) {
        console.error('❌ Test upload failed:', error)
        return res.status(500).json({ 
          error: 'Cannot upload to bucket', 
          details: error,
          suggestions: [
            'Check RLS (Row Level Security) policies on storage.objects',
            'Verify bucket permissions',
            'Check if authenticated users can insert into storage.objects'
          ]
        })
      }
      
      console.log('✅ Test upload successful:', data)
      
      // Clean up test file
      await supabase.storage.from('project-files').remove(['test/test-file.txt'])
      
      return res.status(200).json({ 
        success: true,
        testUpload: data,
        message: 'Storage is working correctly'
      })
    }
    
    if (action === 'list_missing_files') {
      // 4. Find files that exist in database but not in storage
      const { projectId } = req.body
      
      if (!projectId) {
        return res.status(400).json({ error: 'projectId required for listing missing files' })
      }
      
      // Get files from database
      const { data: dbFiles, error: dbError } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
      
      if (dbError) {
        return res.status(500).json({ error: 'Cannot query database', details: dbError })
      }
      
      const missingFiles = []
      
      // Check each file in storage
      for (const file of dbFiles || []) {
        try {
          const { data, error } = await supabase.storage
            .from('project-files')
            .createSignedUrl(file.storage_path, 60)
          
          if (error) {
            missingFiles.push({
              id: file.id,
              name: file.name,
              storage_path: file.storage_path,
              file_size: file.file_size,
              file_type: file.file_type,
              reason: error.message
            })
          }
        } catch (error) {
          missingFiles.push({
            id: file.id,
            name: file.name,
            storage_path: file.storage_path,
            file_size: file.file_size,
            file_type: file.file_type,
            reason: 'Exception checking file'
          })
        }
      }
      
      return res.status(200).json({
        projectId,
        totalFiles: dbFiles?.length || 0,
        missingFiles: missingFiles.length,
        missingFileDetails: missingFiles,
        allFilesMissing: missingFiles.length === (dbFiles?.length || 0)
      })
    }
    
    return res.status(400).json({ 
      error: 'Invalid action',
      availableActions: ['check_bucket', 'create_bucket', 'test_upload', 'list_missing_files']
    })
    
  } catch (error) {
    console.error('💥 Storage repair failed:', error)
    return res.status(500).json({ 
      error: 'Storage repair failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}