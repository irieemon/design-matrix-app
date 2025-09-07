import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('🔧 Supabase config check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
  keyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'missing'
})

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  console.log('Available env vars:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')))
  console.log('You need to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
}

// Create Supabase client
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
)

// Auth helper functions
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error getting current user:', error)
    return null
  }
  return user
}

export const getUserProfile = async (userId: string) => {
  console.log('🔍 getUserProfile called for userId:', userId)
  
  try {
    const profilePromise = supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    const timeoutPromise = new Promise((resolve) => 
      setTimeout(() => resolve({ data: null, error: { message: 'Profile lookup timeout' } }), 5000)
    )
    
    const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any
    console.log('🔍 getUserProfile query result:', { data, error })
    
    if (error) {
      console.error('❌ Error getting user profile:', error)
      
      // If it's a timeout or table doesn't exist, try to create the profile
      if (error.message === 'Profile lookup timeout' || error.code === '42P01') {
        console.log('🏗️ Attempting to create user profile for userId:', userId)
        return await createUserProfile(userId)
      }
      
      return null
    }
    return data
  } catch (err) {
    console.error('💥 Exception in getUserProfile:', err)
    return null
  }
}

export const createUserProfile = async (userId: string, email?: string) => {
  console.log('🏗️ Creating user profile for userId:', userId)
  
  try {
    // Try to get the current user's email from auth if not provided
    if (!email) {
      const { data: { user } } = await supabase.auth.getUser()
      email = user?.email || 'unknown@example.com'
    }
    
    const newProfile = {
      id: userId,
      email: email,
      full_name: email?.split('@')[0] || 'User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('user_profiles')
      .insert([newProfile])
      .select()
      .single()
    
    if (error) {
      console.error('❌ Error creating user profile:', error)
      
      // If table doesn't exist, return a fallback profile
      if (error.code === '42P01') {
        console.log('📄 Database table missing, using fallback profile')
        return {
          id: userId,
          email: email,
          full_name: email?.split('@')[0] || 'User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
      
      return null
    }
    
    console.log('✅ User profile created successfully:', data)
    return data
  } catch (err) {
    console.error('💥 Exception creating user profile:', err)
    
    // Return fallback profile even if database operations fail
    return {
      id: userId,
      email: email || 'unknown@example.com',
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
    console.error('Error updating user profile:', error)
    throw error
  }
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error signing out:', error)
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
    console.error('Error getting user projects:', error)
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
  return data.map(item => item.project_id)
}

export const getUserProjectRole = async (projectId: string, userId: string) => {
  const { data, error } = await supabase
    .rpc('get_user_project_role', {
      project_uuid: projectId,
      user_uuid: userId
    })
  
  if (error) {
    console.error('Error getting user project role:', error)
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
    console.error('Error checking project access:', error)
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
    console.error('Error getting user teams:', error)
    throw error
  }
  
  return data.map(member => ({
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
    console.error('Error getting user invitations:', error)
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
    console.error('Error fetching invitation:', fetchError)
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
    console.error('Error updating invitation:', updateError)
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
      console.error('Error adding team member:', memberError)
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
      console.error('Error adding project collaborator:', collaboratorError)
      throw collaboratorError
    }
  }
  
  return invitation
}