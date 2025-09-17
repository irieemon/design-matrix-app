import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { projectId } = req.query
    
    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'Project ID required' })
    }
    
    // Initialize Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase configuration missing' })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    console.log('🔍 Checking storage sync for project:', projectId)
    
    // 1. Get files from database
    const { data: dbFiles, error: dbError } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
    
    if (dbError) {
      console.error('❌ Database query error:', dbError)
      return res.status(500).json({ error: 'Database query failed', details: dbError })
    }
    
    console.log('📋 Files in database:', dbFiles?.length || 0)
    
    // 2. Check storage bucket contents
    const { data: storageList, error: storageError } = await supabase.storage
      .from('project-files')
      .list(`projects/${projectId}`, { limit: 1000 })
    
    if (storageError) {
      console.error('❌ Storage list error:', storageError)
    } else {
      console.log('🗂️ Top-level storage contents:', storageList?.map(f => f.name) || [])
    }
    
    // 3. Check files subdirectory
    const { data: filesDir, error: filesDirError } = await supabase.storage
      .from('project-files')
      .list(`projects/${projectId}/files`, { limit: 1000 })
    
    if (filesDirError) {
      console.error('❌ Files directory error:', filesDirError)
    } else {
      console.log('📁 Files subdirectory contents:', filesDir?.map(f => f.name) || [])
    }
    
    // 4. Check root bucket contents
    const { data: rootList, error: rootError } = await supabase.storage
      .from('project-files')
      .list('', { limit: 100 })
    
    if (rootError) {
      console.error('❌ Root bucket error:', rootError)
    } else {
      console.log('🏠 Root bucket contents:', rootList?.map(f => f.name) || [])
    }
    
    // 5. Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('❌ Buckets list error:', bucketsError)
    } else {
      console.log('🪣 Available buckets:', buckets?.map(b => b.name) || [])
    }
    
    // Summary
    const summary = {
      projectId,
      databaseFiles: dbFiles?.length || 0,
      databaseFilePaths: dbFiles?.map(f => f.storage_path) || [],
      storageTopLevel: storageList?.map(f => f.name) || [],
      storageFilesDir: filesDir?.map(f => f.name) || [],
      rootBucket: rootList?.map(f => f.name) || [],
      availableBuckets: buckets?.map(b => b.name) || [],
      dbFiles: dbFiles?.map(f => ({
        id: f.id,
        name: f.name,
        storage_path: f.storage_path,
        file_type: f.file_type,
        file_size: f.file_size
      })) || []
    }
    
    console.log('📊 Storage sync summary:', summary)
    
    return res.status(200).json(summary)
    
  } catch (error) {
    console.error('💥 Storage sync check failed:', error)
    return res.status(500).json({ 
      error: 'Storage sync check failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}