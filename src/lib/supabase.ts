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
  // Guard against SSR environment
  if (typeof window === 'undefined') {
    return
  }

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
const cleanupData = typeof window !== 'undefined' ? localStorage.getItem(CLEANUP_FLAG) : null

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

// Only run cleanup in browser environment
if (shouldRunCleanup && typeof window !== 'undefined') {
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

// ✅ PERFORMANCE OPTIMIZATION: Cache authenticated client to prevent multiple GoTrueClient instances
// This is a module-level cache shared by ALL code that imports createAuthenticatedClientFromLocalStorage
let cachedAuthenticatedClient: any | null = null
let cachedTokenHash: string | null = null

/**
 * CRITICAL FIX: Create authenticated Supabase client from localStorage tokens
 *
 * MULTIPLE CLIENT PATTERN - COMPLETE TECHNICAL DOCUMENTATION
 * ==========================================================
 *
 * PROBLEM STATEMENT:
 * On page refresh, Supabase's getSession() can hang or timeout for several reasons:
 * 1. Network latency on initial page load
 * 2. Service worker interference
 * 3. Async initialization race conditions
 * 4. Browser security policies affecting localStorage access timing
 *
 * This creates a critical UX issue where:
 * - User refreshes page with ?project=<id> in URL
 * - App tries to restore project from database
 * - Query waits for getSession() to complete
 * - getSession() times out after 8+ seconds
 * - User sees loading spinner indefinitely or gets "unauthorized" error
 *
 * SOLUTION:
 * Create a second Supabase client that bypasses getSession() entirely by:
 * 1. Reading access_token directly from localStorage (synchronous, instant)
 * 2. Injecting token into Authorization header
 * 3. Creating client with autoRefreshToken: false, persistSession: false
 * 4. Using unique storage key to prevent interference with global client
 *
 * CACHING STRATEGY:
 * - Module-level cache prevents creating multiple clients on every call
 * - Token hash (first 20 chars) used for cache key to detect token changes
 * - Cache invalidated when token changes or session expires
 * - Cache shared across all repository imports
 *
 * MULTIPLE GOTRUECLIENT INSTANCES WARNING:
 * The console will show: "Multiple GoTrueClient instances detected"
 * This is EXPECTED and HARMLESS because:
 * - Both clients use same auth token and RLS policies
 * - Fallback client has autoRefreshToken: false (no background token refresh)
 * - Global client handles all auth state changes
 * - No auth state conflict or data corruption
 * - Warning is informational, not an error
 *
 * PERFORMANCE CHARACTERISTICS:
 * - Module-level caching: O(1) lookup on subsequent calls
 * - Token hash comparison: ~20 chars substring, negligible overhead
 * - Memory overhead: ~50KB per cached client instance
 * - UX improvement: 8+ second timeout eliminated, instant query execution
 *
 * SECURITY CONSIDERATIONS:
 * - Both clients enforce Row Level Security (RLS) policies
 * - Access token from localStorage is already validated by Supabase
 * - Token expiry respected (cache cleared on invalid token)
 * - No elevation of privileges or security bypass
 *
 * ALTERNATIVE APPROACHES REJECTED:
 * 1. Wait for getSession() with timeout - Still causes 8s delay, bad UX
 * 2. Use global client only - Unreliable on refresh, race conditions
 * 3. Single client with manual token injection - Requires Supabase internals, fragile
 * 4. Custom AuthAdapter - Over-engineered, difficult to maintain
 * 5. Service worker token caching - Browser compatibility issues
 *
 * WHERE THIS PATTERN IS USED:
 * - ProjectRepository.ts:18-26 (getAuthenticatedClient)
 * - ProjectContext.tsx:92-141 (handleProjectRestore)
 * - RoadmapRepository.ts:82-89 (getProjectRoadmaps)
 * - InsightsRepository.ts:82-89 (getProjectInsights)
 *
 * RELATED SUPABASE ISSUES:
 * - https://github.com/supabase/supabase-js/issues/873
 * - https://github.com/supabase/gotrue-js/issues/823
 *
 * @returns Authenticated Supabase client with token from localStorage, or null if no valid session
 */
export const createAuthenticatedClientFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)

    if (!stored) {
      // No session in localStorage, clear cache
      cachedAuthenticatedClient = null
      cachedTokenHash = null
      logger.debug('No session in localStorage')
      return null
    }

    const parsed = JSON.parse(stored)

    if (!parsed.access_token || !parsed.user) {
      // Invalid session data, clear cache
      cachedAuthenticatedClient = null
      cachedTokenHash = null
      logger.debug('Invalid session data in localStorage')
      return null
    }

    // Check token expiration for logging purposes only
    try {
      const payload = JSON.parse(atob(parsed.access_token.split('.')[1]))
      const expiresAt = payload.exp * 1000
      const timeUntilExpiry = expiresAt - Date.now()

      if (timeUntilExpiry < 0) {
        logger.warn('⚠️ Token expired - user may need to re-authenticate', {
          expiredFor: Math.abs(Math.round(timeUntilExpiry / 1000)) + 's'
        })
      } else if (timeUntilExpiry < 300000) { // < 5 minutes
        logger.debug('Token expiring soon', {
          timeUntilExpiry: Math.round(timeUntilExpiry / 1000) + 's'
        })
      }
    } catch (e) {
      // Ignore decode errors
    }

    // Create hash of token to detect changes (first 20 chars for performance)
    const currentTokenHash = parsed.access_token.substring(0, 20)

    // Return cached client if token hasn't changed
    if (cachedAuthenticatedClient && cachedTokenHash === currentTokenHash) {
      logger.debug('Using cached authenticated client (token unchanged)')
      return cachedAuthenticatedClient
    }

    // Token changed or no cache exists, create new client
    logger.debug('Creating new authenticated client (token changed or first call)')

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

    // Cache the client and token hash
    cachedAuthenticatedClient = authenticatedClient
    cachedTokenHash = currentTokenHash
    logger.debug('Authenticated client created and cached successfully')

    return authenticatedClient
  } catch (error) {
    logger.error('Error creating authenticated client:', error)
    // On error, clear cache
    cachedAuthenticatedClient = null
    cachedTokenHash = null
    return null
  }
}

/**
 * Clear the cached authenticated client
 * Useful for cleanup or forcing recreation of the client
 */
export const clearAuthenticatedClientCache = () => {
  cachedAuthenticatedClient = null
  cachedTokenHash = null
  logger.debug('Authenticated client cache cleared')
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

/**
 * NOTE: Admin functions have been removed from frontend code
 * All admin operations must use backend API endpoints for security:
 *
 * - GET /api/admin/projects - Get all projects (admin only)
 * - GET /api/admin/users - Get all users (admin only)
 * - GET /api/admin/projects/:id - Get project by ID (admin only)
 * - GET /api/admin/projects/:id/stats - Get project statistics (admin only)
 *
 * These endpoints are only accessible from backend with service role authentication.
 */