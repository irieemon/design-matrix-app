import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger'
import { SUPABASE_STORAGE_KEY, CACHE_DURATIONS } from './config'
import { withTimeout } from '../utils/promiseUtils'
import { ProfileService } from '../services/ProfileService'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ✅ SECURITY FIX: Service role key removed from frontend
// Frontend uses ONLY authenticated anon key clients with RLS enforcement

logger.debug('🔧 Supabase config check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
  keyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'missing'
})

if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('❌ Missing Supabase environment variables')
  logger.debug('Available env vars:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')))
  logger.error('You need to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
}

// CRITICAL FIX: Clean up ALL storage to fix persistSession: true migration
// MUST run BEFORE Supabase client creation!
// When switching from persistSession: false to true, old session data causes timeouts
// This aggressive cleanup ensures a clean slate for the new configuration
const cleanupLegacyAuthStorage = () => {
  try {
    // Extract project reference from Supabase URL for dynamic key cleanup
    const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
    logger.debug('Starting storage cleanup:', { projectRef })

    // AGGRESSIVE CLEANUP: Remove ALL Supabase-related storage
    // This is necessary because old persistSession: false data breaks persistSession: true
    const keysToClean = [
      // Legacy custom auth keys
      'prioritas-auth',
      'sb-prioritas-auth-token',
      'prioritasUser',
      'prioritasUserJoinDate',
      'supabase.auth.token',

      // SECURITY FIX: Remove PII storage per PRIO-SEC-002 (CVSS 7.8)
      'collaboratorEmailMappings',   // GDPR violation: plaintext email storage

      // CRITICAL: Remove ALL Supabase session keys (old and new formats)
      ...(projectRef ? [
        `sb-${projectRef}-auth-token`,                    // Old format session
        `sb-${projectRef}-auth-token-code-verifier`,      // PKCE verifier
        `sb-${projectRef}-auth-token.0`,                  // Additional token data
        `sb-${projectRef}-auth-token.1`,                  // Additional token data
        `sb-${projectRef}-auth-token-refresh`,            // Refresh token
        // CRITICAL: Also check for any keys that might interfere
        ...Array.from({ length: 10 }, (_, i) => `sb-${projectRef}-auth-token.${i}`)
      ] : [])
    ]

    let cleanedCount = 0

    // Clean specific keys
    keysToClean.forEach(key => {
      try {
        const value = localStorage.getItem(key)
        if (value !== null) {
          localStorage.removeItem(key)
          cleanedCount++
          logger.debug(`🧹 Removed key: ${key}`)
        }
      } catch (error) {
        logger.warn(`⚠️ Failed to clean key ${key}:`, error)
      }
    })

    // AGGRESSIVE: Also scan for any remaining Supabase keys we might have missed
    // CRITICAL: Exclude cleanup flag AND active session key to prevent deleting valid sessions
    const CLEANUP_FLAG_PREFIX = 'sb-migration-cleanup-done'
    try {
      const allKeys = Object.keys(localStorage)
      const supabaseKeys = allKeys.filter(key =>
        (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth-token')) &&
        !key.startsWith(CLEANUP_FLAG_PREFIX) &&  // Don't delete our own cleanup flag!
        key !== SUPABASE_STORAGE_KEY              // Don't delete active session key!
      )

      supabaseKeys.forEach(key => {
        try {
          localStorage.removeItem(key)
          cleanedCount++
          logger.debug(`🧹 Removed discovered Supabase key: ${key}`)
        } catch (error) {
          logger.warn(`⚠️ Failed to clean discovered key ${key}:`, error)
        }
      })
    } catch (error) {
      logger.warn('⚠️ Error scanning localStorage:', error)
    }

    // Clean sessionStorage completely
    try {
      sessionStorage.clear()
      logger.debug('🧹 Cleared all sessionStorage')
    } catch (error) {
      logger.warn('⚠️ Failed to clean sessionStorage:', error)
    }

    if (cleanedCount > 0) {
      logger.debug(`Storage cleanup complete: removed ${cleanedCount} entries`)
    } else {
      logger.debug('No legacy storage found - clean slate')
    }
  } catch (error) {
    logger.warn('⚠️ Error during storage cleanup:', error)
  }
}

// CRITICAL: Run cleanup IMMEDIATELY on module load
// This must happen BEFORE creating the Supabase client
// CRITICAL FIX: Use localStorage (not sessionStorage) so cleanup doesn't run on every refresh
const CLEANUP_FLAG = 'sb-migration-cleanup-done-v3'  // v3 with localStorage persistence
const CLEANUP_EXPIRY_DAYS = 30 // Re-run cleanup after 30 days in case of issues

// Check if cleanup has already run (with time-based expiry)
let shouldRunCleanup = true
const cleanupData = localStorage.getItem(CLEANUP_FLAG)

if (cleanupData) {
  try {
    const { timestamp } = JSON.parse(cleanupData)
    const daysSinceCleanup = (Date.now() - timestamp) / (1000 * 60 * 60 * 24)

    if (daysSinceCleanup < CLEANUP_EXPIRY_DAYS) {
      shouldRunCleanup = false
      logger.debug(`Storage cleanup already completed ${daysSinceCleanup.toFixed(1)} days ago`)
    } else {
      logger.debug(`Re-running storage cleanup (last run: ${daysSinceCleanup.toFixed(1)} days ago)`)
    }
  } catch (parseError) {
    logger.debug('Invalid cleanup flag data, running cleanup')
    shouldRunCleanup = true
  }
}

if (shouldRunCleanup) {
  logger.debug('Running storage cleanup before Supabase initialization')
  cleanupLegacyAuthStorage()
  try {
    localStorage.setItem(CLEANUP_FLAG, JSON.stringify({
      timestamp: Date.now(),
      version: 'v3'
    }))
    logger.debug('Cleanup flag set - will not run again for 30 days')
  } catch (error) {
    logger.warn('Could not set cleanup flag:', error)
  }
}

// NOW create Supabase client AFTER cleanup has run
// This ensures the client doesn't read any old incompatible storage data
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      // PHASE 2: Enable session persistence for login AND page refresh
      // This allows both: (1) Login to work, (2) Sessions to persist across refreshes
      autoRefreshToken: true,   // Auto-refresh tokens before expiry
      persistSession: true,      // Store and detect sessions (critical for both login and refresh)
      detectSessionInUrl: false, // OAuth handled server-side
      // CRITICAL FIX: Use undefined to let Supabase use its default localStorage adapter
      // The explicit storage adapter with typeof window checks broke session reading during initialization
      // Supabase's default adapter handles SSR and browser contexts correctly
      storage: undefined,
      // CRITICAL: Use explicit storage key so cleanup can preserve it
      storageKey: SUPABASE_STORAGE_KEY,
      flowType: 'pkce'          // PKCE flow for security
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

// ✅ SECURITY FIX: supabaseAdmin client REMOVED from frontend
// Admin operations MUST be performed via backend API endpoints only
// Frontend uses authenticated anon key client with RLS enforcement

// Auth helper functions
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    logger.error('Error getting current user:', error)
    return null
  }
  return user
}

// CRITICAL FIX: Lazy-initialized singleton to prevent multiple GoTrueClient instances
// EXPORTED so useAuth.ts and other modules can share the SAME instance
let profileServiceInstance: ProfileService | null = null

export function getProfileService(): ProfileService {
  if (!profileServiceInstance) {
    profileServiceInstance = new ProfileService(supabase, CACHE_DURATIONS.PROFILE)
  }
  return profileServiceInstance
}

/**
 * Get user profile by ID
 *
 * Note: This is a legacy wrapper around ProfileService for backwards compatibility.
 * New code should use ProfileService directly.
 *
 * @param userId User ID
 * @returns User profile or null
 */
export const getUserProfile = async (userId: string) => {
  const profileStart = performance.now()
  logger.debug('🔍 getUserProfile called for userId:', userId)

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      logger.warn('No authenticated user for getUserProfile')
      return null
    }

    const profile = await getProfileService().getProfile(userId, user.email || '')
    const profileTime = performance.now() - profileStart
    logger.debug('🔍 getUserProfile result:', { profile, timing: `${profileTime.toFixed(1)}ms` })

    return profile
  } catch (err) {
    const profileTime = performance.now() - profileStart
    logger.error('💥 Exception in getUserProfile:', err, `(${profileTime.toFixed(1)}ms)`)
    return null
  }
}

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

    // Optimized profile creation with timeout
    const insertPromise = Promise.resolve(supabase
      .from('user_profiles')
      .insert([newProfile])
      .select()
      .single())

    const result = await withTimeout(
      insertPromise,
      1000,
      'Insert timeout after 1000ms'
    ).catch(err => {
      if (err.message?.includes('timeout')) {
        return { data: null, error: { name: 'AbortError', message: err.message } }
      }
      throw err
    })

    const { data, error } = result
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

/**
 * Update user profile
 *
 * Note: This is a legacy wrapper around ProfileService for backwards compatibility.
 * New code should use ProfileService directly.
 *
 * @param userId User ID
 * @param updates Profile updates
 * @returns Updated profile
 */
export const updateUserProfile = async (userId: string, updates: any) => {
  return getProfileService().updateProfile(userId, updates)
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    logger.error('Error signing out:', error)
    throw error
  }
}

/**
 * CRITICAL FIX: Create authenticated Supabase client from localStorage tokens
 *
 * Used as fallback when getSession() and setSession() hang on refresh.
 * Creates a new client with the access_token as a custom auth header.
 * This bypasses Supabase's auth methods entirely and authenticates directly.
 *
 * @returns Authenticated Supabase client or null if no valid session in localStorage
 */
export const createAuthenticatedClientFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)

    if (!stored) {
      logger.debug('No session in localStorage')
      return null
    }

    const parsed = JSON.parse(stored)

    if (!parsed.access_token || !parsed.user) {
      logger.debug('Invalid session data in localStorage')
      return null
    }

    logger.debug('Creating authenticated client with token')

    // CRITICAL FIX: Use unique storage key to prevent "Multiple GoTrueClient instances" warning
    const uniqueStorageKey = `sb-fallback-${parsed.access_token.substring(0, 12)}`

    // Create new Supabase client with access token in headers
    // This authenticates ALL requests without needing getSession/setSession
    const authenticatedClient = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key',
      {
        auth: {
          autoRefreshToken: false,  // Disable to prevent getSession() calls
          persistSession: false,     // Disable to prevent session storage writes
          detectSessionInUrl: false,
          storage: undefined,        // No storage for fallback client
          storageKey: uniqueStorageKey // Unique key to prevent GoTrueClient conflicts
        },
        global: {
          headers: {
            'Authorization': `Bearer ${parsed.access_token}`,  // Direct auth header
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      }
    )

    logger.debug('Authenticated client created successfully with unique storage key')
    return authenticatedClient
  } catch (error) {
    logger.error('Error creating authenticated client:', error)
    return null
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

// ⚠️ DEPRECATED: Admin functions should be backend-only
// These functions are kept for backwards compatibility but will fail
// Migrate to backend API endpoints: /api/admin/projects, /api/admin/users
export const adminGetAllProjects = async (): Promise<any[]> => {
  logger.error('❌ adminGetAllProjects called from frontend - DEPRECATED')
  logger.error('🔒 Admin operations must use backend API: /api/admin/projects')
  throw new Error('Admin operations must be performed via backend API endpoints')
}

export const adminGetAllUsers = async (): Promise<any[]> => {
  logger.error('❌ adminGetAllUsers called from frontend - DEPRECATED')
  logger.error('🔒 Admin operations must use backend API: /api/admin/users')
  throw new Error('Admin operations must be performed via backend API endpoints')
}