import { createClient } from '@supabase/supabase-js'

// These would normally be environment variables
// For demo purposes, we'll use placeholder values
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Database types
export interface DatabaseIdea {
  id: string
  content: string
  details: string
  x: number
  y: number
  priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
  created_by: string
  created_at: string
  updated_at: string
}