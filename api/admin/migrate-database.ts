import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const { action, confirm } = req.body
    
    if (action !== 'add_ai_analysis_columns') {
      return res.status(400).json({ error: 'Unknown migration action' })
    }
    
    if (!confirm) {
      return res.status(400).json({ 
        error: 'Migration requires confirmation',
        message: 'Send { "action": "add_ai_analysis_columns", "confirm": true } to proceed'
      })
    }
    
    // Initialize Supabase client with service role (admin) key
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ADMIN_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ 
        error: 'Missing Supabase configuration',
        details: 'Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables'
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('🔄 Running database migration: add_ai_analysis_columns')
    
    // Add the columns
    const migrationSQL = `
      ALTER TABLE project_files 
      ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
      ADD COLUMN IF NOT EXISTS analysis_status TEXT CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed', 'skipped'));
      
      CREATE INDEX IF NOT EXISTS idx_project_files_analysis_status ON project_files(analysis_status);
    `
    
    const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    
    if (migrationError) {
      console.error('❌ Migration failed:', migrationError)
      return res.status(500).json({ 
        error: 'Migration failed', 
        details: migrationError 
      })
    }
    
    console.log('✅ Migration completed successfully')
    
    return res.status(200).json({
      success: true,
      message: 'Database migration completed successfully',
      migration: 'add_ai_analysis_columns',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('💥 Migration error:', error)
    return res.status(500).json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}