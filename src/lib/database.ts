import { supabase } from './supabase'
import type { IdeaCard, Project } from '../types'
import { EmailService } from './emailService'
import { RealtimeDiagnostic } from '../utils/realtimeDiagnostic'
import { logger } from '../utils/logger'

export class DatabaseService {
  // Debounce map to prevent rapid-fire updates
  private static lockDebounceMap = new Map<string, NodeJS.Timeout>()
  // Console logging throttle to reduce spam
  private static lastLogTime = new Map<string, number>()
  
  // Throttled console logging helper
  private static throttledLog(key: string, message: string, data?: any, throttleMs: number = 1000) {
    const now = Date.now()
    const lastLog = this.lastLogTime.get(key) || 0
    
    if (now - lastLog > throttleMs) {
      logger.debug(message, data)
      this.lastLogTime.set(key, now)
    }
  }
  // Fetch ideas for a specific project (supports user-based access control via RLS)
  static async getIdeasByProject(projectId?: string): Promise<IdeaCard[]> {
    try {
      let query = supabase
        .from('ideas')
        .select('*')
        .order('created_at', { ascending: false })

      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error } = await query

      if (error) {
        logger.error('Error fetching ideas:', error)
        return []
      }

      return data || []
    } catch (error) {
      logger.error('Database error:', error)
      return []
    }
  }

  // Legacy method for backward compatibility
  static async getAllIdeas(): Promise<IdeaCard[]> {
    return this.getIdeasByProject()
  }

  // Create a new idea
  static async createIdea(idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>): Promise<IdeaCard | null> {
    try {
      logger.debug('🗃️ DatabaseService: Creating idea:', idea)
      
      // Generate ID for the idea (using shortened UUID for text field)
      const ideaWithId = {
        ...idea,
        id: crypto.randomUUID().replace(/-/g, '').substring(0, 16),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      const { data, error } = await supabase
        .from('ideas')
        .insert([ideaWithId])
        .select()
        .single()

      if (error) {
        logger.error('❌ DatabaseService: Error creating idea:', error)
        return null
      }

      logger.debug('✅ DatabaseService: Idea created successfully:', data)
      return data
    } catch (error) {
      logger.error('❌ DatabaseService: Database error:', error)
      return null
    }
  }

  // Update an existing idea
  static async updateIdea(id: string, updates: Partial<Omit<IdeaCard, 'id' | 'created_at'>>): Promise<IdeaCard | null> {
    try {
      logger.debug('Updating idea:', id, 'with updates:', updates)
      
      const { data, error } = await supabase
        .from('ideas')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        logger.error('Error updating idea:', error)
        return null
      }

      logger.debug('Update successful:', data)
      return data
    } catch (error) {
      logger.error('Database error:', error)
      return null
    }
  }

  // Delete an idea
  static async deleteIdea(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', id)

      if (error) {
        logger.error('Error deleting idea:', error)
        return false
      }

      return true
    } catch (error) {
      logger.error('Database error:', error)
      return false
    }
  }

  // Lock/unlock idea for editing with debouncing
  static async lockIdeaForEditing(ideaId: string, userId: string): Promise<boolean> {
    try {
      const debounceKey = `${ideaId}_${userId}_lock`
      
      // Clear existing debounce if any
      if (this.lockDebounceMap.has(debounceKey)) {
        clearTimeout(this.lockDebounceMap.get(debounceKey)!)
      }

      // First check if it's already locked by someone else
      const { data: existingIdea, error: fetchError } = await supabase
        .from('ideas')
        .select('editing_by, editing_at')
        .eq('id', ideaId)
        .single()

      if (fetchError) {
        logger.error('Error checking idea lock:', fetchError)
        return false
      }

      // Check if it's locked by someone else (within the last 5 minutes)
      if (existingIdea.editing_by && existingIdea.editing_by !== userId) {
        const editingAt = new Date(existingIdea.editing_at || '')
        const now = new Date()
        const timeDiff = now.getTime() - editingAt.getTime()
        const fiveMinutes = 5 * 60 * 1000

        // If locked within the last 5 minutes by someone else, deny lock
        if (timeDiff < fiveMinutes) {
          return false
        }
      }

      // Debounce lock updates - only update if same user hasn't locked recently
      if (existingIdea.editing_by === userId) {
        this.throttledLog(`lock_debounce_${ideaId}`, '🔒 User already has lock, skipping timestamp update to prevent flashing', undefined, 10000)
        
        // DISABLE timestamp updates to prevent flashing - the initial lock is enough
        // The 5-minute timeout will be handled by UI logic instead of database heartbeat
        return true
      }

      // Lock the idea for editing (first time)
      const { error } = await supabase
        .from('ideas')
        .update({
          editing_by: userId,
          editing_at: new Date().toISOString()
        })
        .eq('id', ideaId)

      if (error) {
        logger.error('Error locking idea:', error)
        return false
      }

      return true
    } catch (error) {
      logger.error('Database error:', error)
      return false
    }
  }

  static async unlockIdea(ideaId: string, userId: string): Promise<boolean> {
    try {
      // Only unlock if the current user is the one who locked it
      const { error } = await supabase
        .from('ideas')
        .update({
          editing_by: null,
          editing_at: null
        })
        .eq('id', ideaId)
        .eq('editing_by', userId)

      if (error) {
        logger.error('Error unlocking idea:', error)
        return false
      }

      return true
    } catch (error) {
      logger.error('Database error:', error)
      return false
    }
  }

  // Clean up stale locks (older than 5 minutes)
  static async cleanupStaleLocks(): Promise<void> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      await supabase
        .from('ideas')
        .update({
          editing_by: null,
          editing_at: null
        })
        .lt('editing_at', fiveMinutesAgo)
    } catch (error) {
      logger.error('Error cleaning up stale locks:', error)
    }
  }

  // Global real-time status that persists across subscriptions
  private static realTimeWorking = false
  
  // Subscribe to real-time changes with polling fallback
  static subscribeToIdeas(callback: (ideas: IdeaCard[]) => void, projectId?: string) {
    logger.debug('Setting up real-time subscription with polling fallback...', { projectId })
    
    let lastUpdateTime = new Date().toISOString()
    
    // Real-time subscription
    const channel = supabase
      .channel('ideas_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ideas'
        },
        (payload) => {
          logger.debug('🔴 Real-time change detected:', payload.eventType)
          DatabaseService.realTimeWorking = true
          
          // Skip refresh for editing_at-only changes to prevent feedback loop
          if (payload.eventType === 'UPDATE' && payload.old && payload.new) {
            const oldData = payload.old
            const newData = payload.new
            
            // Log what changed for debugging
            const changedFields = Object.keys(newData).filter(key => {
              return oldData[key] !== newData[key]
            })
            logger.debug('🔍 Changed fields:', changedFields)
            
            // SPECIAL CASE: If only lock-related fields changed, block ALL refreshes
            // This prevents the flashing entirely by treating lock operations as non-significant
            const lockOnlyChange = changedFields.length > 0 && changedFields.every(field => 
              field === 'editing_at' || field === 'editing_by' || field === 'updated_at'
            )
            
            if (lockOnlyChange) {
              logger.debug('🔒 BLOCKED refresh - lock-only changes detected:', changedFields)
              return // Block ALL lock-related updates
            }
            
            // More robust check: compare all keys except timestamps AND locks
            const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])
            const significantChanges = Array.from(allKeys).some(key => {
              // Skip ALL lock and timestamp fields completely
              if (key === 'editing_at' || key === 'updated_at' || key === 'editing_by') return false
              
              // Handle null vs undefined consistently
              const oldValue = oldData[key]
              const newValue = newData[key]
              
              // Both null/undefined - no change
              if ((oldValue == null) && (newValue == null)) return false
              
              // One null, other not - significant change
              if ((oldValue == null) !== (newValue == null)) return true
              
              // Both have values - compare them
              const hasChanged = oldValue !== newValue
              
              // Log significant field changes for debugging
              if (hasChanged) {
                logger.debug(`⚡ SIGNIFICANT CHANGE detected in field '${key}': '${oldValue}' → '${newValue}'`)
              }
              
              return hasChanged
            })
            
            if (!significantChanges) {
              logger.debug('⏸️ BLOCKED refresh - no content changes detected:', changedFields)
              return // CRITICAL: Block the callback completely
            } else {
              logger.debug('✅ ALLOWING refresh - content changes detected:', changedFields)
            }
          }
          
          logger.debug('✅ Real-time callback executing - refreshing ideas')
          
          // Refresh ideas based on project context
          const refreshPromise = projectId 
            ? this.getProjectIdeas(projectId!)
            : this.getAllIdeas()
          
          refreshPromise.then((freshIdeas) => {
            logger.debug('📊 Fresh ideas fetched, calling callback with', freshIdeas.length, 'ideas')
            callback(freshIdeas)
          })
        }
      )
      .subscribe((status, err) => {
        logger.debug('Subscription status:', status)
        
        if (err) {
          logger.error('Subscription error:', err)
          DatabaseService.realTimeWorking = false
        } else if (status === 'SUBSCRIBED') {
          logger.debug('Successfully subscribed to real-time updates!')
          // Don't run diagnostic if real-time is already known to work
          if (!DatabaseService.realTimeWorking) {
            setTimeout(() => {
              if (!DatabaseService.realTimeWorking) {
                logger.warn('⚠️ Real-time subscription established but no events received. Running diagnostic...')
                RealtimeDiagnostic.checkRealtimeConfiguration()
              }
            }, 5000)
          } else {
            logger.debug('✅ Real-time already confirmed working, skipping diagnostic')
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          logger.warn('Real-time subscription failed or closed:', status)
          DatabaseService.realTimeWorking = false
        }
      })

    // Polling fallback for when real-time doesn't work
    const pollInterval = setInterval(async () => {
      if (!DatabaseService.realTimeWorking) {
        this.throttledLog('polling_fallback', '📊 Real-time not working, using polling fallback...', undefined, 5000)
        
        try {
          const { data, error } = await supabase
            .from('ideas')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single()
          
          if (!error && data && data!.updated_at && data!.updated_at > lastUpdateTime) {
            logger.debug('Polling detected changes, refreshing ideas...')
            lastUpdateTime = data!.updated_at!
            
            // Refresh ideas based on project context
            const refreshPromise = projectId 
              ? this.getProjectIdeas(projectId!)
              : this.getAllIdeas()
            
            refreshPromise.then(callback)
          }
        } catch (pollError) {
          logger.warn('Polling error:', pollError)
        }
      }
    }, 2000)

    return () => {
      logger.debug('Unsubscribing from real-time updates and stopping polling')
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }

  // Project Management
  static async getAllProjects(): Promise<Project[]> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) {
        logger.error('Error fetching projects:', error)
        return []
      }

      return data || []
    } catch (error) {
      logger.error('Error fetching projects:', error)
      return []
    }
  }

  // Get projects owned by a specific user
  static async getUserOwnedProjects(userId: string): Promise<Project[]> {
    try {
      logger.debug('📋 Getting projects owned by user:', userId)
      
      // Query without timeout to see what's happening
      logger.debug('📋 Starting query...')
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })
      
      logger.debug('📋 Query completed. Error:', error, 'Data:', data)

      if (error) {
        logger.error('❌ Error fetching user projects:', error)
        return []
      }

      logger.debug('✅ Found', data?.length || 0, 'projects for user:', data)
      return data || []
    } catch (error) {
      logger.error('Error fetching user projects:', error)
      return []
    }
  }

  static async getCurrentProject(): Promise<Project | null> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)

      if (error) {
        logger.debug('Error fetching current project:', error)
        return null
      }

      // Return the first active project if it exists, null otherwise
      return data && data.length > 0 ? data[0] : null
    } catch (error) {
      logger.error('Error fetching current project:', error)
      return null
    }
  }

  static async getProjectById(projectId: string): Promise<Project | null> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error) {
        logger.error('Error fetching project:', error)
        return null
      }

      return data
    } catch (error) {
      logger.error('Error fetching project:', error)
      return null
    }
  }

  static async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project | null> {
    try {
      const projectWithId = {
        ...project,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      const { data, error } = await supabase
        .from('projects')
        .insert([projectWithId])
        .select()
        .single()

      if (error) {
        logger.error('Error creating project:', error)
        return null
      }

      logger.debug('✅ Project created:', data)
      return data
    } catch (error) {
      logger.error('Error creating project:', error)
      return null
    }
  }

  static async updateProject(projectId: string, updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>): Promise<Project | null> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .select()
        .single()

      if (error) {
        logger.error('Error updating project:', error)
        return null
      }

      logger.debug('✅ Project updated:', data)
      return data
    } catch (error) {
      logger.error('Error updating project:', error)
      return null
    }
  }

  static async deleteProject(projectId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) {
        logger.error('Error deleting project:', error)
        return false
      }

      logger.debug('✅ Project deleted:', projectId)
      return true
    } catch (error) {
      logger.error('Error deleting project:', error)
      return false
    }
  }

  static async getProjectIdeas(projectId: string): Promise<IdeaCard[]> {
    try {
      this.throttledLog(`fetch_ideas_${projectId}`, `🔍 DatabaseService: Fetching ideas for project: ${projectId}`)
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('❌ Error fetching project ideas:', error)
        return []
      }

      this.throttledLog(
        `ideas_summary_${projectId}`, 
        `✅ DatabaseService: Found ${data?.length || 0} ideas for project ${projectId}`,
        data?.map(i => ({ id: i.id, content: i.content, project_id: i.project_id })),
        2000 // 2 second throttle for summary logs
      )
      return data || []
    } catch (error) {
      logger.error('Error fetching project ideas:', error)
      return []
    }
  }

  // Subscribe to project changes
  static subscribeToProjects(callback: (projects: Project[]) => void) {
    logger.debug('📡 Setting up real-time subscription for projects...')
    
    const channel = supabase
      .channel('projects')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        async (payload) => {
          logger.debug('📡 Real-time project update:', payload)
          // Fetch all projects and update
          const projects = await this.getAllProjects()
          callback(projects)
        }
      )
      .subscribe((status) => {
        logger.debug('📡 Projects subscription status:', status)
      })

    // Return unsubscribe function
    return () => {
      logger.debug('📡 Unsubscribing from project updates')
      supabase.removeChannel(channel)
    }
  }

  // Project Collaboration Methods
  static async addProjectCollaborator(projectId: string, userEmail: string, role: string = 'viewer', invitedBy: string, projectName?: string, inviterName?: string, inviterEmail?: string): Promise<boolean> {
    try {
      logger.debug('🔍 Looking up user by email:', userEmail)
      
      // For now, we'll create a simplified invitation system
      // In a real app, you would need a proper invitation system with email notifications
      
      // First, let's try to find if the user exists by checking if they have any projects
      // This is a workaround since we can't directly query auth.users
      const { error: userLookupError } = await supabase
        .from('projects')
        .select('owner_id')
        .limit(1000) // Get a reasonable sample
      
      if (userLookupError) {
        logger.error('Error looking up users:', userLookupError)
      }

      // For demo purposes, we'll generate a mock user ID based on the email
      // In a real implementation, this would be handled by a server-side function
      const mockUserId = btoa(userEmail).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)
      logger.debug('🆔 Generated mock user ID:', mockUserId, 'for email:', userEmail)

      // Store the email mapping in localStorage for demo purposes
      const emailMappings = JSON.parse(localStorage.getItem('collaboratorEmailMappings') || '{}')
      emailMappings[mockUserId] = userEmail
      localStorage.setItem('collaboratorEmailMappings', JSON.stringify(emailMappings))

      // Check if collaboration already exists by checking if we've invited this email before
      // First check if this email already has a mapping (meaning we've invited them before)
      const existingMockIds = Object.keys(emailMappings).filter(id => emailMappings[id] === userEmail)
      logger.debug('🔍 Existing mock IDs for this email:', existingMockIds)

      if (existingMockIds.length > 0) {
        // Check if any of these mock IDs are already collaborators on this project
        const { data: existingCollaborations } = await supabase
          .from('project_collaborators')
          .select('id, user_id')
          .eq('project_id', projectId)
          .in('user_id', existingMockIds)

        if (existingCollaborations && existingCollaborations.length > 0) {
          logger.debug('❌ This email is already a collaborator on this project')
          return false
        }
      }

      logger.debug('✅ No existing collaboration found, proceeding with invitation')

      // Add collaborator with pending status
      const { error } = await supabase
        .from('project_collaborators')
        .insert([{
          project_id: projectId,
          user_id: mockUserId,
          role,
          invited_by: invitedBy,
          status: 'pending'
        }])

      if (error) {
        logger.error('❌ Error adding collaborator:', error)
        logger.error('❌ Error details:', error.message, error.details, error.code)
        return false
      }

      logger.debug('✅ Collaborator invitation created successfully')
      logger.debug('📋 Added collaborator with details:', { projectId, mockUserId, role, invitedBy })
      
      // Send real email invitation
      logger.debug('📧 Sending real email invitation to:', userEmail)
      
      try {
        const invitationUrl = EmailService.generateInvitationUrl(projectId)
        const emailSuccess = await EmailService.sendCollaborationInvitation({
          inviterName: inviterName || 'Project Owner',
          inviterEmail: inviterEmail || 'noreply@prioritas.app',
          inviteeEmail: userEmail,
          projectName: projectName || 'Untitled Project',
          role,
          invitationUrl
        })
        
        if (emailSuccess) {
          logger.debug('✅ Real email invitation sent successfully!')
        } else {
          logger.debug('⚠️ Email sending failed, but invitation record was created')
        }
      } catch (emailError) {
        logger.error('❌ Error sending email invitation:', emailError)
        logger.debug('⚠️ Database record created but email failed')
      }
      
      return true
    } catch (error) {
      logger.error('💥 Error adding project collaborator:', error)
      logger.error('💥 Stack trace:', error)
      return false
    }
  }

  static async getProjectCollaborators(projectId: string) {
    try {
      logger.debug('🔍 DatabaseService: Fetching collaborators for project:', projectId)
      
      const { data, error } = await supabase
        .from('project_collaborators')
        .select('*')
        .eq('project_id', projectId)
        .in('status', ['active', 'pending'])

      logger.debug('📊 DatabaseService: Raw collaborator query result:', { data, error })

      if (error) {
        logger.error('❌ DatabaseService: Error fetching collaborators:', error)
        return []
      }

      if (!data || data.length === 0) {
        logger.debug('📋 DatabaseService: No collaborators found for project:', projectId)
        return []
      }

      // Since we can't join with auth.users, we'll create mock user data
      // In a real app, this would be handled by a server-side function or proper user table
      const emailMappings = JSON.parse(localStorage.getItem('collaboratorEmailMappings') || '{}')
      logger.debug('🗂️ DatabaseService: Email mappings from localStorage:', emailMappings)
      
      const collaboratorsWithUserData = (data || []).map(collaborator => {
        // Get the actual email from our localStorage mapping
        const actualEmail = emailMappings[collaborator.user_id] || `user${collaborator.user_id.substring(0, 8)}@example.com`
        const userName = actualEmail.split('@')[0]
        
        const result = {
          ...collaborator,
          user: {
            id: collaborator.user_id,
            email: actualEmail,
            raw_user_meta_data: {
              full_name: userName.charAt(0).toUpperCase() + userName.slice(1)
            }
          }
        }
        
        logger.debug('👤 DatabaseService: Processed collaborator:', result)
        return result
      })

      logger.debug('✅ DatabaseService: Returning collaborators with user data:', collaboratorsWithUserData)
      return collaboratorsWithUserData
    } catch (error) {
      logger.error('💥 DatabaseService: Error fetching project collaborators:', error)
      return []
    }
  }

  static async removeProjectCollaborator(projectId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (error) {
        logger.error('Error removing collaborator:', error)
        return false
      }

      logger.debug('✅ Collaborator removed successfully')
      return true
    } catch (error) {
      logger.error('Error removing project collaborator:', error)
      return false
    }
  }

  static async updateCollaboratorRole(projectId: string, userId: string, newRole: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .update({ 
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (error) {
        logger.error('Error updating collaborator role:', error)
        return false
      }

      logger.debug('✅ Collaborator role updated successfully')
      return true
    } catch (error) {
      logger.error('Error updating collaborator role:', error)
      return false
    }
  }

  static async getUserProjectRole(projectId: string, userId: string): Promise<string | null> {
    try {
      // Check if user owns the project
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single()

      if (project && project.owner_id === userId) {
        return 'owner'
      }

      // Check collaborator role
      const { data: collaborator, error } = await supabase
        .from('project_collaborators')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (error || !collaborator) {
        return null
      }

      return collaborator.role
    } catch (error) {
      logger.error('Error getting user project role:', error)
      return null
    }
  }

  // Check if user has access to project
  static async canUserAccessProject(projectId: string, userId: string): Promise<boolean> {
    const role = await this.getUserProjectRole(projectId, userId)
    return role !== null
  }

  // Get all projects where user is owner or collaborator
  static async getUserProjects(userId: string): Promise<Project[]> {
    try {
      // Get projects where user is owner
      const { data: ownedProjects, error: ownedError } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })

      // Get projects where user is collaborator
      const { data: collaborations, error: collabError } = await supabase
        .from('project_collaborators')
        .select(`
          project:projects(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')

      const collaboratedProjects = collaborations?.map(c => c.project).filter(Boolean) || []

      if (ownedError || collabError) {
        logger.error('Error fetching user projects:', { ownedError, collabError })
        return []
      }

      // Combine and deduplicate projects
      const allProjects = [...(ownedProjects || []), ...collaboratedProjects]
      const uniqueProjects = allProjects.filter((project, index, arr) => 
        arr.findIndex(p => p.id === project.id) === index
      )

      return uniqueProjects
    } catch (error) {
      logger.error('Error fetching user projects:', error)
      return []
    }
  }

  // Subscribe to collaborator changes
  static subscribeToProjectCollaborators(projectId: string, callback: (collaborators: any[]) => void) {
    logger.debug('📡 Setting up real-time subscription for project collaborators...')
    
    const channel = supabase
      .channel(`project_collaborators_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_collaborators',
          filter: `project_id=eq.${projectId}`
        },
        async (payload) => {
          logger.debug('📡 Real-time collaborator update:', payload)
          // Fetch updated collaborators and update
          const collaborators = await this.getProjectCollaborators(projectId)
          callback(collaborators)
        }
      )
      .subscribe((status) => {
        logger.debug('📡 Project collaborators subscription status:', status)
      })

    // Return unsubscribe function
    return () => {
      logger.debug('📡 Unsubscribing from project collaborators updates')
      supabase.removeChannel(channel)
    }
  }

  // Roadmap Management
  static async saveProjectRoadmap(projectId: string, roadmapData: any, createdBy: string, ideasAnalyzed: number): Promise<string | null> {
    try {
      logger.debug('🗺️ DatabaseService: Saving roadmap for project:', projectId)

      // Get the next version number
      const { data: existingRoadmaps } = await supabase
        .from('project_roadmaps')
        .select('version')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)

      const nextVersion = existingRoadmaps && existingRoadmaps.length > 0 ? existingRoadmaps[0].version + 1 : 1
      
      const roadmapName = `Roadmap v${nextVersion} - ${new Date().toLocaleDateString()}`

      const { data, error } = await supabase
        .from('project_roadmaps')
        .insert([{
          project_id: projectId,
          version: nextVersion,
          name: roadmapName,
          roadmap_data: roadmapData,
          created_by: createdBy,
          ideas_analyzed: ideasAnalyzed
        }])
        .select('id')
        .single()

      if (error) {
        logger.error('❌ DatabaseService: Error saving roadmap:', error)
        return null
      }

      logger.debug('✅ DatabaseService: Roadmap saved successfully:', data.id)
      return data.id
    } catch (error) {
      logger.error('💥 DatabaseService: Error in saveProjectRoadmap:', error)
      return null
    }
  }

  static async getProjectRoadmaps(projectId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('project_roadmaps')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false })

      if (error) {
        logger.error('❌ DatabaseService: Error fetching roadmaps:', error)
        return []
      }

      return data || []
    } catch (error) {
      logger.error('💥 DatabaseService: Error in getProjectRoadmaps:', error)
      return []
    }
  }

  static async getProjectRoadmap(roadmapId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('project_roadmaps')
        .select('*')
        .eq('id', roadmapId)
        .single()

      if (error) {
        logger.error('❌ DatabaseService: Error fetching roadmap:', error)
        return null
      }

      return data
    } catch (error) {
      logger.error('💥 DatabaseService: Error in getProjectRoadmap:', error)
      return null
    }
  }

  // Insights Management
  static async saveProjectInsights(projectId: string, insightsData: any, createdBy: string, ideasAnalyzed: number): Promise<string | null> {
    try {
      logger.debug('📊 DatabaseService: Saving insights for project:', projectId)

      // Get the next version number
      const { data: existingInsights } = await supabase
        .from('project_insights')
        .select('version')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)

      const nextVersion = existingInsights && existingInsights.length > 0 ? existingInsights[0].version + 1 : 1
      
      const insightsName = `Insights v${nextVersion} - ${new Date().toLocaleDateString()}`

      const { data, error } = await supabase
        .from('project_insights')
        .insert([{
          project_id: projectId,
          version: nextVersion,
          name: insightsName,
          insights_data: insightsData,
          created_by: createdBy,
          ideas_analyzed: ideasAnalyzed
        }])
        .select('id')
        .single()

      if (error) {
        logger.error('❌ DatabaseService: Error saving insights:', error)
        return null
      }

      logger.debug('✅ DatabaseService: Insights saved successfully:', data.id)
      return data.id
    } catch (error) {
      logger.error('💥 DatabaseService: Error in saveProjectInsights:', error)
      return null
    }
  }

  static async getProjectInsights(projectId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('project_insights')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false })

      if (error) {
        logger.error('❌ DatabaseService: Error fetching insights:', error)
        return []
      }

      return data || []
    } catch (error) {
      logger.error('💥 DatabaseService: Error in getProjectInsights:', error)
      return []
    }
  }

  static async getProjectInsight(insightId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('project_insights')
        .select('*')
        .eq('id', insightId)
        .single()

      if (error) {
        logger.error('❌ DatabaseService: Error fetching insight:', error)
        return null
      }

      return data
    } catch (error) {
      logger.error('💥 DatabaseService: Error in getProjectInsight:', error)
      return null
    }
  }
}