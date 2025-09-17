import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
    const { projectId, confirmReset } = req.body
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId required' })
    }
    
    // Initialize Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase configuration missing' })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // First, check what files exist
    const { data: files, error: filesError } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
    
    if (filesError) {
      return res.status(500).json({ error: 'Cannot query files', details: filesError })
    }
    
    if (!confirmReset) {
      // Just return what would be deleted
      return res.status(200).json({
        action: 'preview',
        projectId,
        filesFound: files?.length || 0,
        files: files?.map(f => ({
          id: f.id,
          name: f.name,
          file_type: f.file_type,
          file_size: f.file_size,
          storage_path: f.storage_path
        })) || [],
        message: 'This will delete all file records from the database for this project. Send confirmReset: true to proceed.',
        warning: 'This action cannot be undone! Make sure you have the original files to re-upload.'
      })
    }
    
    // Actually delete the files
    console.log(`🗑️ Deleting ${files?.length || 0} file records for project ${projectId}`)
    
    const { error: deleteError } = await supabase
      .from('project_files')
      .delete()
      .eq('project_id', projectId)
    
    if (deleteError) {
      return res.status(500).json({ error: 'Cannot delete files', details: deleteError })
    }
    
    console.log(`✅ Deleted ${files?.length || 0} file records`)
    
    return res.status(200).json({
      success: true,
      projectId,
      deletedFiles: files?.length || 0,
      deletedFileNames: files?.map(f => f.name) || [],
      message: 'File records deleted successfully. You can now re-upload your files and they should work properly.',
      nextSteps: [
        '1. Go to your project in the app',
        '2. Upload your images again using the file upload feature', 
        '3. The files should now be stored correctly in Supabase Storage',
        '4. GPT-4V will use your actual images instead of demo images'
      ]
    })
    
  } catch (error) {
    console.error('💥 Reset project files failed:', error)
    return res.status(500).json({ 
      error: 'Reset failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}