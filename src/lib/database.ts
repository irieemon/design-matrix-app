import { supabase } from './supabase'
import type { IdeaCard, Project } from '../types'
import { EmailService } from './emailService'
import { RealtimeDiagnostic } from '../utils/realtimeDiagnostic'

export class DatabaseService {
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
        console.error('Error fetching ideas:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Database error:', error)
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
      console.log('🗃️ DatabaseService: Creating idea:', idea)
      
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
        console.error('❌ DatabaseService: Error creating idea:', error)
        return null
      }

      console.log('✅ DatabaseService: Idea created successfully:', data)
      return data
    } catch (error) {
      console.error('❌ DatabaseService: Database error:', error)
      return null
    }
  }

  // Update an existing idea
  static async updateIdea(id: string, updates: Partial<Omit<IdeaCard, 'id' | 'created_at'>>): Promise<IdeaCard | null> {
    try {
      console.log('Updating idea:', id, 'with updates:', updates)
      
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
        console.error('Error updating idea:', error)
        return null
      }

      console.log('Update successful:', data)
      return data
    } catch (error) {
      console.error('Database error:', error)
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
        console.error('Error deleting idea:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Database error:', error)
      return false
    }
  }

  // Lock/unlock idea for editing
  static async lockIdeaForEditing(ideaId: string, userId: string): Promise<boolean> {
    try {
      // First check if it's already locked by someone else
      const { data: existingIdea, error: fetchError } = await supabase
        .from('ideas')
        .select('editing_by, editing_at')
        .eq('id', ideaId)
        .single()

      if (fetchError) {
        console.error('Error checking idea lock:', fetchError)
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

      // Lock the idea for editing
      const { error } = await supabase
        .from('ideas')
        .update({
          editing_by: userId,
          editing_at: new Date().toISOString()
        })
        .eq('id', ideaId)

      if (error) {
        console.error('Error locking idea:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Database error:', error)
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
        console.error('Error unlocking idea:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Database error:', error)
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
      console.error('Error cleaning up stale locks:', error)
    }
  }

  // Subscribe to real-time changes with polling fallback
  static subscribeToIdeas(callback: (ideas: IdeaCard[]) => void, projectId?: string) {
    console.log('Setting up real-time subscription with polling fallback...', { projectId })
    
    let lastUpdateTime = new Date().toISOString()
    let realTimeWorking = false
    
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
          console.log('🔴 Real-time change detected:', payload.eventType, payload.new, payload.old)
          console.log('✅ Real-time is working! Disabling polling fallback.')
          realTimeWorking = true
          
          // Refresh ideas based on project context
          const refreshPromise = projectId 
            ? this.getProjectIdeas(projectId!)
            : this.getAllIdeas()
          
          refreshPromise.then(callback)
        }
      )
      .subscribe((status, err) => {
        console.log('Subscription status:', status)
        
        if (err) {
          console.error('Subscription error:', err)
          realTimeWorking = false
        } else if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates!')
          // Set a timeout to test if real-time actually works
          setTimeout(() => {
            if (!realTimeWorking) {
              console.warn('⚠️ Real-time subscription established but no events received. Running diagnostic...')
              RealtimeDiagnostic.checkRealtimeConfiguration()
            }
          }, 5000)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('Real-time subscription failed or closed:', status)
          realTimeWorking = false
        }
      })

    // Polling fallback for when real-time doesn't work
    const pollInterval = setInterval(async () => {
      if (!realTimeWorking) {
        console.log('📊 Real-time not working, using polling fallback...')
        
        try {
          const { data, error } = await supabase
            .from('ideas')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single()
          
          if (!error && data && data!.updated_at && data!.updated_at > lastUpdateTime) {
            console.log('Polling detected changes, refreshing ideas...')
            lastUpdateTime = data!.updated_at!
            
            // Refresh ideas based on project context
            const refreshPromise = projectId 
              ? this.getProjectIdeas(projectId!)
              : this.getAllIdeas()
            
            refreshPromise.then(callback)
          }
        } catch (pollError) {
          console.warn('Polling error:', pollError)
        }
      }
    }, 2000)

    return () => {
      console.log('Unsubscribing from real-time updates and stopping polling')
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
        console.error('Error fetching projects:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching projects:', error)
      return []
    }
  }

  // Get projects owned by a specific user
  static async getUserOwnedProjects(userId: string): Promise<Project[]> {
    try {
      console.log('📋 Getting projects owned by user:', userId)
      
      // Query without timeout to see what's happening
      console.log('📋 Starting query...')
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })
      
      console.log('📋 Query completed. Error:', error, 'Data:', data)

      if (error) {
        console.error('❌ Error fetching user projects:', error)
        return []
      }

      console.log('✅ Found', data?.length || 0, 'projects for user:', data)
      return data || []
    } catch (error) {
      console.error('Error fetching user projects:', error)
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
        console.log('Error fetching current project:', error)
        return null
      }

      // Return the first active project if it exists, null otherwise
      return data && data.length > 0 ? data[0] : null
    } catch (error) {
      console.error('Error fetching current project:', error)
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
        console.error('Error fetching project:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching project:', error)
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
        console.error('Error creating project:', error)
        return null
      }

      console.log('✅ Project created:', data)
      return data
    } catch (error) {
      console.error('Error creating project:', error)
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
        console.error('Error updating project:', error)
        return null
      }

      console.log('✅ Project updated:', data)
      return data
    } catch (error) {
      console.error('Error updating project:', error)
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
        console.error('Error deleting project:', error)
        return false
      }

      console.log('✅ Project deleted:', projectId)
      return true
    } catch (error) {
      console.error('Error deleting project:', error)
      return false
    }
  }

  static async getProjectIdeas(projectId: string): Promise<IdeaCard[]> {
    try {
      console.log('🔍 DatabaseService: Fetching ideas for project:', projectId)
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching project ideas:', error)
        return []
      }

      console.log('✅ DatabaseService: Found', data?.length || 0, 'ideas for project', projectId)
      console.log('📋 DatabaseService: Ideas summary:', data?.map(i => ({ id: i.id, content: i.content, project_id: i.project_id })))
      return data || []
    } catch (error) {
      console.error('Error fetching project ideas:', error)
      return []
    }
  }

  // Subscribe to project changes
  static subscribeToProjects(callback: (projects: Project[]) => void) {
    console.log('📡 Setting up real-time subscription for projects...')
    
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
          console.log('📡 Real-time project update:', payload)
          // Fetch all projects and update
          const projects = await this.getAllProjects()
          callback(projects)
        }
      )
      .subscribe((status) => {
        console.log('📡 Projects subscription status:', status)
      })

    // Return unsubscribe function
    return () => {
      console.log('📡 Unsubscribing from project updates')
      supabase.removeChannel(channel)
    }
  }

  // Project Collaboration Methods
  static async addProjectCollaborator(projectId: string, userEmail: string, role: string = 'viewer', invitedBy: string, projectName?: string, inviterName?: string, inviterEmail?: string): Promise<boolean> {
    try {
      console.log('🔍 Looking up user by email:', userEmail)
      
      // For now, we'll create a simplified invitation system
      // In a real app, you would need a proper invitation system with email notifications
      
      // First, let's try to find if the user exists by checking if they have any projects
      // This is a workaround since we can't directly query auth.users
      const { error: userLookupError } = await supabase
        .from('projects')
        .select('owner_id')
        .limit(1000) // Get a reasonable sample
      
      if (userLookupError) {
        console.error('Error looking up users:', userLookupError)
      }

      // For demo purposes, we'll generate a mock user ID based on the email
      // In a real implementation, this would be handled by a server-side function
      const mockUserId = btoa(userEmail).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)
      console.log('🆔 Generated mock user ID:', mockUserId, 'for email:', userEmail)

      // Store the email mapping in localStorage for demo purposes
      const emailMappings = JSON.parse(localStorage.getItem('collaboratorEmailMappings') || '{}')
      emailMappings[mockUserId] = userEmail
      localStorage.setItem('collaboratorEmailMappings', JSON.stringify(emailMappings))

      // Check if collaboration already exists by checking if we've invited this email before
      // First check if this email already has a mapping (meaning we've invited them before)
      const existingMockIds = Object.keys(emailMappings).filter(id => emailMappings[id] === userEmail)
      console.log('🔍 Existing mock IDs for this email:', existingMockIds)

      if (existingMockIds.length > 0) {
        // Check if any of these mock IDs are already collaborators on this project
        const { data: existingCollaborations } = await supabase
          .from('project_collaborators')
          .select('id, user_id')
          .eq('project_id', projectId)
          .in('user_id', existingMockIds)

        if (existingCollaborations && existingCollaborations.length > 0) {
          console.log('❌ This email is already a collaborator on this project')
          return false
        }
      }

      console.log('✅ No existing collaboration found, proceeding with invitation')

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
        console.error('❌ Error adding collaborator:', error)
        console.error('❌ Error details:', error.message, error.details, error.code)
        return false
      }

      console.log('✅ Collaborator invitation created successfully')
      console.log('📋 Added collaborator with details:', { projectId, mockUserId, role, invitedBy })
      
      // Send real email invitation
      console.log('📧 Sending real email invitation to:', userEmail)
      
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
          console.log('✅ Real email invitation sent successfully!')
        } else {
          console.log('⚠️ Email sending failed, but invitation record was created')
        }
      } catch (emailError) {
        console.error('❌ Error sending email invitation:', emailError)
        console.log('⚠️ Database record created but email failed')
      }
      
      return true
    } catch (error) {
      console.error('💥 Error adding project collaborator:', error)
      console.error('💥 Stack trace:', error)
      return false
    }
  }

  static async getProjectCollaborators(projectId: string) {
    try {
      console.log('🔍 DatabaseService: Fetching collaborators for project:', projectId)
      
      const { data, error } = await supabase
        .from('project_collaborators')
        .select('*')
        .eq('project_id', projectId)
        .in('status', ['active', 'pending'])

      console.log('📊 DatabaseService: Raw collaborator query result:', { data, error })

      if (error) {
        console.error('❌ DatabaseService: Error fetching collaborators:', error)
        return []
      }

      if (!data || data.length === 0) {
        console.log('📋 DatabaseService: No collaborators found for project:', projectId)
        return []
      }

      // Since we can't join with auth.users, we'll create mock user data
      // In a real app, this would be handled by a server-side function or proper user table
      const emailMappings = JSON.parse(localStorage.getItem('collaboratorEmailMappings') || '{}')
      console.log('🗂️ DatabaseService: Email mappings from localStorage:', emailMappings)
      
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
        
        console.log('👤 DatabaseService: Processed collaborator:', result)
        return result
      })

      console.log('✅ DatabaseService: Returning collaborators with user data:', collaboratorsWithUserData)
      return collaboratorsWithUserData
    } catch (error) {
      console.error('💥 DatabaseService: Error fetching project collaborators:', error)
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
        console.error('Error removing collaborator:', error)
        return false
      }

      console.log('✅ Collaborator removed successfully')
      return true
    } catch (error) {
      console.error('Error removing project collaborator:', error)
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
        console.error('Error updating collaborator role:', error)
        return false
      }

      console.log('✅ Collaborator role updated successfully')
      return true
    } catch (error) {
      console.error('Error updating collaborator role:', error)
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
      console.error('Error getting user project role:', error)
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
        console.error('Error fetching user projects:', { ownedError, collabError })
        return []
      }

      // Combine and deduplicate projects
      const allProjects = [...(ownedProjects || []), ...collaboratedProjects]
      const uniqueProjects = allProjects.filter((project, index, arr) => 
        arr.findIndex(p => p.id === project.id) === index
      )

      return uniqueProjects
    } catch (error) {
      console.error('Error fetching user projects:', error)
      return []
    }
  }

  // Subscribe to collaborator changes
  static subscribeToProjectCollaborators(projectId: string, callback: (collaborators: any[]) => void) {
    console.log('📡 Setting up real-time subscription for project collaborators...')
    
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
          console.log('📡 Real-time collaborator update:', payload)
          // Fetch updated collaborators and update
          const collaborators = await this.getProjectCollaborators(projectId)
          callback(collaborators)
        }
      )
      .subscribe((status) => {
        console.log('📡 Project collaborators subscription status:', status)
      })

    // Return unsubscribe function
    return () => {
      console.log('📡 Unsubscribing from project collaborators updates')
      supabase.removeChannel(channel)
    }
  }

  // Roadmap Management
  static async saveProjectRoadmap(projectId: string, roadmapData: any, createdBy: string, ideasAnalyzed: number): Promise<string | null> {
    try {
      console.log('🗺️ DatabaseService: Saving roadmap for project:', projectId)

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
        console.error('❌ DatabaseService: Error saving roadmap:', error)
        return null
      }

      console.log('✅ DatabaseService: Roadmap saved successfully:', data.id)
      return data.id
    } catch (error) {
      console.error('💥 DatabaseService: Error in saveProjectRoadmap:', error)
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
        console.error('❌ DatabaseService: Error fetching roadmaps:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('💥 DatabaseService: Error in getProjectRoadmaps:', error)
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
        console.error('❌ DatabaseService: Error fetching roadmap:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('💥 DatabaseService: Error in getProjectRoadmap:', error)
      return null
    }
  }

  // Insights Management
  static async saveProjectInsights(projectId: string, insightsData: any, createdBy: string, ideasAnalyzed: number): Promise<string | null> {
    try {
      console.log('📊 DatabaseService: Saving insights for project:', projectId)

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
        console.error('❌ DatabaseService: Error saving insights:', error)
        return null
      }

      console.log('✅ DatabaseService: Insights saved successfully:', data.id)
      return data.id
    } catch (error) {
      console.error('💥 DatabaseService: Error in saveProjectInsights:', error)
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
        console.error('❌ DatabaseService: Error fetching insights:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('💥 DatabaseService: Error in getProjectInsights:', error)
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
        console.error('❌ DatabaseService: Error fetching insight:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('💥 DatabaseService: Error in getProjectInsight:', error)
      return null
    }
  }
}