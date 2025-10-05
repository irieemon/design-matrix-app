import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

logger.debug('🔧 Supabase config check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  hasServiceKey: !!supabaseServiceRoleKey,
  urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
  keyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'missing',
  serviceKeyPreview: supabaseServiceRoleKey ? `${supabaseServiceRoleKey.substring(0, 20)}...` : 'missing'
})

if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('❌ Missing Supabase environment variables')
  logger.debug('Available env vars:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')))
  logger.error('You need to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
}

// Create Supabase client with performance optimizations
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      // TEMPORARY FIX: Re-enable session persistence to allow authentication to complete
      // NOTE: This re-introduces XSS token theft vulnerability (PRIO-SEC-001, CVSS 9.1)
      // TODO: Implement httpOnly cookie authentication to resolve security issue properly
      persistSession: true,
      detectSessionInUrl: true,
      // Performance optimizations
      flowType: 'pkce' // Use more efficient PKCE flow
    },
    // Database connection optimizations
    db: {
      schema: 'public'
    },
    // Global request optimizations
    global: {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    },
    // Enable connection pooling and optimize timeouts
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
)

// Service role client for admin operations (bypasses RLS)
// Use unique storage key to avoid "Multiple GoTrueClient instances" warning
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: 'sb-admin-client'  // Unique key to prevent collision with main client
    },
    db: {
      schema: 'public'
    }
  }
)

// FIX #4: Enhanced cleanup to include actual Supabase storage keys
const cleanupAuthStorage = () => {
  try {
    // Extract project reference from Supabase URL for dynamic key cleanup
    const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

    // Build list of keys to clean (both legacy and potentially corrupted)
    const keysToClean = [
      'prioritas-auth',              // Old custom auth key
      'sb-prioritas-auth-token',     // Old custom supabase key
      'prioritasUser',               // Legacy user storage
      'prioritasUserJoinDate',       // Legacy join date
      'supabase.auth.token',         // Old Supabase auth key
      // SECURITY FIX: Remove PII storage per PRIO-SEC-002 (CVSS 7.8)
      'collaboratorEmailMappings',   // GDPR violation: plaintext email storage
      // Add project-specific keys if we have a project ref
      ...(projectRef ? [
        `sb-${projectRef}-auth-token`,                    // Actual Supabase session
        `sb-${projectRef}-auth-token-code-verifier`,      // PKCE verifier
        `sb-${projectRef}-auth-token.0`,                  // Additional token data
        `sb-${projectRef}-auth-token.1`                   // Additional token data
      ] : [])
    ]

    let cleanedCount = 0
    keysToClean.forEach(key => {
      try {
        const value = localStorage.getItem(key)
        if (value !== null) {
          // Validate JSON to catch corrupted storage
          try {
            JSON.parse(value)
          } catch {
            // Corrupted JSON, definitely should remove
            logger.warn(`🚨 Found corrupted storage for key: ${key}`)
          }

          localStorage.removeItem(key)
          cleanedCount++
          logger.debug('🧹 Removed storage key:', key)
        }
      } catch (error) {
        logger.warn(`⚠️ Failed to clean key ${key}:`, error)
      }
    })

    if (cleanedCount > 0) {
      logger.debug(`✅ Storage cleanup completed - removed ${cleanedCount} keys`)
    } else {
      logger.debug('✅ Storage cleanup completed - no stale keys found')
    }
  } catch (error) {
    logger.warn('⚠️ Error during auth storage cleanup:', error)
  }
}

// CRITICAL FIX: Only run cleanup on first load, not during session restoration
let hasRunCleanup = false
if (!hasRunCleanup) {
  cleanupAuthStorage()
  hasRunCleanup = true
}

// Auth helper functions
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    logger.error('Error getting current user:', error)
    return null
  }
  return user
}

// Profile cache for better performance
const profileCache = new Map<string, { profile: any; timestamp: number; expires: number }>()
const PROFILE_CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

export const getUserProfile = async (userId: string) => {
  const profileStart = performance.now()
  logger.debug('🔍 getUserProfile called for userId:', userId)

  // Check cache first
  const cached = profileCache.get(userId)
  if (cached && Date.now() < cached.expires) {
    logger.debug('🎯 Using cached profile:', { userId, age: Date.now() - cached.timestamp })
    return cached.profile
  }

  try {
    // Optimized query with minimal data selection
    // Use Promise.race for timeout instead of abortSignal (not supported by PostgrestBuilder)
    const profilePromise = supabase
      .from('user_profiles')
      .select('id, email, full_name, role, avatar_url, created_at, updated_at')
      .eq('id', userId)
      .single()

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout after 1500ms')), 1500)
    })

    const { data, error } = await Promise.race([profilePromise, timeoutPromise]).catch(err => {
      if (err.message?.includes('timeout')) {
        return { data: null, error: { name: 'AbortError', message: err.message } }
      }
      throw err
    })
    const profileTime = performance.now() - profileStart
    logger.debug('🔍 getUserProfile query result:', { data, error, timing: `${profileTime.toFixed(1)}ms` })
    
    if (error) {
      logger.error('❌ Error getting user profile:', error)

      // If it's a timeout or table doesn't exist, try to create the profile
      if (error.name === 'AbortError' || ('code' in error && error.code === '42P01')) {
        logger.debug('🏗️ Attempting to create user profile for userId:', userId)
        
        // Add timeout to entire profile creation process
        try {
          const createProfilePromise = createUserProfile(userId)
          const overallTimeoutPromise = new Promise((resolve) => 
            setTimeout(async () => {
              logger.warn('⏰ Profile creation taking too long, using emergency fallback')
              // Try to get current user from auth for correct email
              try {
                const { data: { user } } = await supabase.auth.getUser()
                resolve({
                  id: userId,
                  email: user?.email || '',
                  full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
              } catch (err) {
                resolve({
                  id: userId,
                  email: '',
                  full_name: 'Unknown User',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
              }
            }, 5000)
          )
          
          return await Promise.race([createProfilePromise, overallTimeoutPromise]) as any
        } catch (createError) {
          logger.error('❌ Profile creation failed:', createError)
          // Try to get current user from auth for correct email
          try {
            const { data: { user } } = await supabase.auth.getUser()
            return {
              id: userId,
              email: user?.email || '',
              full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          } catch {
            return {
              id: userId,
              email: '',
              full_name: 'Unknown User',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          }
        }
      }
      
      return null
    }

    // Cache successful result
    if (data) {
      profileCache.set(userId, {
        profile: data,
        timestamp: Date.now(),
        expires: Date.now() + PROFILE_CACHE_DURATION
      })
    }

    return data
  } catch (err) {
    logger.error('💥 Exception in getUserProfile:', err)
    return null
  }
}

// Clean up expired profile cache entries
setInterval(() => {
  const now = Date.now()
  for (const [key, cached] of profileCache.entries()) {
    if (now > cached.expires) {
      profileCache.delete(key)
    }
  }
}, 60000) // Clean up every minute

export const createUserProfile = async (userId: string, email?: string) => {
  const createStart = performance.now()
  logger.debug('🏗️ Creating user profile for userId:', userId)

  try {
    // Try to get the current user's email from auth if not provided
    if (!email) {
      try {
        logger.debug('📧 Getting user email from auth...')
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          logger.error('❌ Error getting user from auth:', userError)
          email = ''
        } else {
          email = user?.email || ''
          logger.debug('📧 Got email from auth:', email)
        }
      } catch (emailError) {
        logger.warn('⚠️ Failed to get user email, using default:', emailError)
        email = 'unknown@example.com'
      }
    }
    
    const newProfile = {
      id: userId,
      email: email,
      full_name: email?.split('@')[0] || 'User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    logger.debug('📝 Attempting to insert profile:', newProfile)
    
    // Optimized profile creation with timeout using Promise.race
    const insertPromise = supabase
      .from('user_profiles')
      .insert([newProfile])
      .select()
      .single()

    const insertTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Insert timeout after 1000ms')), 1000)
    })

    const { data, error } = await Promise.race([insertPromise, insertTimeoutPromise]).catch(err => {
      if (err.message?.includes('timeout')) {
        return { data: null, error: { name: 'AbortError', message: err.message } }
      }
      throw err
    })
    const createTime = performance.now() - createStart
    
    if (error) {
      logger.error('❌ Error creating user profile:', error)

      // If table doesn't exist or timeout, return a fallback profile
      if (('code' in error && error.code === '42P01') || error.name === 'AbortError') {
        logger.warn('📄 Database issue, using fallback profile:', error.message)
        const fallbackProfile = {
          id: userId,
          email: email,
          full_name: email?.split('@')[0] || 'User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        logger.debug('✅ Returning fallback profile:', fallbackProfile)
        return fallbackProfile
      }
      
      logger.error('❌ Profile creation failed, returning null')
      return null
    }
    
    logger.debug('✅ User profile created successfully:', data, `(${createTime.toFixed(1)}ms)`)
    return data
  } catch (err) {
    const createTime = performance.now() - createStart
    logger.error('💥 Exception creating user profile:', err, `(${createTime.toFixed(1)}ms)`)

    // Return fallback profile even if database operations fail
    return {
      id: userId,
      email: email || '',
      full_name: email?.split('@')[0] || 'User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }
}

export const updateUserProfile = async (userId: string, updates: any) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  
  if (error) {
    logger.error('Error updating user profile:', error)
    throw error
  }
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    logger.error('Error signing out:', error)
    throw error
  }
}

// Project helpers
export const getUserProjects = async (userId: string) => {
  const collaboratorIds = await getCollaboratorProjectIds(userId)
  const projectIds = collaboratorIds.length > 0 ? collaboratorIds.join(',') : 'null'
  
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      owner:user_profiles!projects_owner_id_fkey(*),
      team:teams(*),
      collaborators:project_collaborators(
        *,
        user:user_profiles(*)
      )
    `)
    .or(`owner_id.eq.${userId},id.in.(${projectIds})`)
    .order('updated_at', { ascending: false })
  
  if (error) {
    logger.error('Error getting user projects:', error)
    throw error
  }
  
  return data
}

const getCollaboratorProjectIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('project_collaborators')
    .select('project_id')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
  
  if (error) return []
  return (data || []).map(item => item.project_id)
}

export const getUserProjectRole = async (projectId: string, userId: string) => {
  const { data, error } = await supabase
    .rpc('get_user_project_role', {
      project_uuid: projectId,
      user_uuid: userId
    })
  
  if (error) {
    logger.error('Error getting user project role:', error)
    return 'none'
  }
  
  return data || 'none'
}

export const canUserAccessProject = async (projectId: string, userId: string) => {
  const { data, error } = await supabase
    .rpc('can_user_access_project', {
      project_uuid: projectId,
      user_uuid: userId
    })
  
  if (error) {
    logger.error('Error checking project access:', error)
    return false
  }
  
  return data || false
}

// Team helpers
export const getUserTeams = async (userId: string) => {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      team:teams(
        *,
        owner:user_profiles!teams_owner_id_fkey(*)
      )
    `)
    .eq('user_id', userId)
    .not('joined_at', 'is', null)
  
  if (error) {
    logger.error('Error getting user teams:', error)
    throw error
  }
  
  return (data || []).map(member => ({
    ...member.team,
    user_role: member.role
  }))
}

// Invitation helpers
export const getUserInvitations = async (userEmail: string) => {
  const { data, error } = await supabase
    .from('invitations')
    .select(`
      *,
      inviter:user_profiles!invitations_invited_by_fkey(*),
      team:teams(*),
      project:projects(*)
    `)
    .eq('email', userEmail)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  
  if (error) {
    logger.error('Error getting user invitations:', error)
    throw error
  }
  
  return data
}

export const acceptInvitation = async (invitationId: string, userId: string) => {
  const { data: invitation, error: fetchError } = await supabase
    .from('invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('status', 'pending')
    .single()
  
  if (fetchError) {
    logger.error('Error fetching invitation:', fetchError)
    throw fetchError
  }
  
  if (!invitation || new Date(invitation.expires_at) < new Date()) {
    throw new Error('Invitation not found or expired')
  }
  
  // Accept the invitation
  const { error: updateError } = await supabase
    .from('invitations')
    .update({ 
      status: 'accepted', 
      accepted_at: new Date().toISOString() 
    })
    .eq('id', invitationId)
  
  if (updateError) {
    logger.error('Error updating invitation:', updateError)
    throw updateError
  }
  
  // Add user to team or project
  if (invitation.type === 'team') {
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: invitation.team_id,
        user_id: userId,
        role: invitation.role as any,
        invited_by: invitation.invited_by,
        invited_at: invitation.created_at,
        joined_at: new Date().toISOString()
      })
    
    if (memberError) {
      logger.error('Error adding team member:', memberError)
      throw memberError
    }
  } else if (invitation.type === 'project') {
    const { error: collaboratorError } = await supabase
      .from('project_collaborators')
      .insert({
        project_id: invitation.project_id,
        user_id: userId,
        role: invitation.role as any,
        invited_by: invitation.invited_by,
        invited_at: invitation.created_at,
        accepted_at: new Date().toISOString()
      })
    
    if (collaboratorError) {
      logger.error('Error adding project collaborator:', collaboratorError)
      throw collaboratorError
    }
  }
  
  return invitation
}

// Admin helper functions using service role
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) {
      logger.error('Error checking admin status:', error)
      return false
    }

    return data?.role === 'admin' || data?.role === 'super_admin'
  } catch (error) {
    logger.error('Failed to check admin status:', error)
    return false
  }
}

export const adminGetAllProjects = async (): Promise<any[]> => {
  try {
    logger.debug('Admin: Fetching all projects with service role')

    // Use service role to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select(`
        *,
        owner:user_profiles!projects_owner_id_fkey(id, email, full_name)
      `)
      .order('updated_at', { ascending: false })

    if (error) {
      logger.error('Admin: Error fetching projects with service role:', error)
      throw new Error(error.message)
    }

    logger.debug(`Admin: Successfully fetched ${data?.length || 0} projects`)
    return data || []
  } catch (error) {
    logger.error('Admin: Failed to get all projects:', error)
    throw error
  }
}

export const adminGetAllUsers = async (): Promise<any[]> => {
  try {
    logger.debug('Admin: Fetching all users with service role')

    // Use service role to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Admin: Error fetching users with service role:', error)
      throw new Error(error.message)
    }

    logger.debug(`Admin: Successfully fetched ${data?.length || 0} users`)
    return data || []
  } catch (error) {
    logger.error('Admin: Failed to get all users:', error)
    throw error
  }
}