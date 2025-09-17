import { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client for server-side auth verification
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl!, supabaseKey!)

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string
    email?: string
  }
}

export async function authenticate(req: VercelRequest): Promise<{ user: { id: string; email?: string } | null; error?: string }> {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'Missing or invalid authorization header' }
    }

    // Extract the token
    const token = authHeader.substring(7)
    
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { user: null, error: 'Invalid or expired token' }
    }

    return { user, error: undefined }
  } catch (error) {
    console.error('Authentication error:', error)
    return { user: null, error: 'Authentication failed' }
  }
}

// Rate limiting with per-user tracking
const userRateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkUserRateLimit(userId: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now()
  const userLimit = userRateLimitStore.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    userRateLimitStore.set(userId, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (userLimit.count >= limit) {
    return false
  }
  
  userLimit.count++
  return true
}