import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get all environment variables that contain 'supabase' (case insensitive)
    const envVars = Object.keys(process.env)
      .filter(key => key.toLowerCase().includes('supabase'))
      .reduce((obj, key) => {
        // Don't expose the actual values, just show they exist and their length
        obj[key] = {
          exists: !!process.env[key],
          length: process.env[key]?.length || 0,
          preview: process.env[key] ? `${process.env[key].substring(0, 10)}...` : 'undefined'
        }
        return obj
      }, {} as Record<string, any>)

    // Also check for common storage-related keys
    const storageKeys = [
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY'
    ]
    
    const keyStatus = storageKeys.reduce((obj, key) => {
      obj[key] = {
        exists: !!process.env[key],
        length: process.env[key]?.length || 0
      }
      return obj
    }, {} as Record<string, any>)

    return res.status(200).json({
      supabaseEnvVars: envVars,
      requiredKeys: keyStatus,
      totalEnvVars: Object.keys(process.env).length,
      recommendations: [
        'For storage operations, you may need SUPABASE_SERVICE_ROLE_KEY instead of anon key',
        'Anon keys have limited permissions, service role keys have admin access',
        'Check Supabase dashboard > Settings > API for the service role key'
      ]
    })
    
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to check environment', 
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}