import { supabase } from './supabase'
import type { IdeaCard, Project } from '../types'

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
          console.log('Real-time change detected:', payload)
          realTimeWorking = true
          
          // Refresh ideas based on project context
          const refreshPromise = projectId 
            ? this.getProjectIdeas(projectId)
            : this.getAllIdeas()
          
          refreshPromise.then(callback)
        }
      )
      .subscribe((status, err) => {
        console.log('Subscription status:', status)
        if (err) console.error('Subscription error:', err)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates!')
        }
      })

    // Polling fallback - temporarily disabled due to database connection issues
    const pollInterval = setInterval(async () => {
      if (!realTimeWorking) {
        console.log('📊 Polling disabled - database connection issues detected')
        // Skip polling until database issues are resolved
        return
        
        try {
          const { data, error } = await supabase
            .from('ideas')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single()
          
          if (!error && data && data.updated_at > lastUpdateTime) {
            console.log('Polling detected changes, refreshing ideas...')
            lastUpdateTime = data.updated_at
            
            // Refresh ideas based on project context
            const refreshPromise = projectId 
              ? this.getProjectIdeas(projectId)
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
}