import { supabase } from './supabase'
import type { IdeaCard } from '../types'

export class DatabaseService {
  // Fetch all ideas from Supabase
  static async getAllIdeas(): Promise<IdeaCard[]> {
    try {
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .order('created_at', { ascending: false })

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

  // Create a new idea
  static async createIdea(idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>): Promise<IdeaCard | null> {
    try {
      const { data, error } = await supabase
        .from('ideas')
        .insert([idea])
        .select()
        .single()

      if (error) {
        console.error('Error creating idea:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Database error:', error)
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
  static async lockIdeaForEditing(ideaId: string, userName: string): Promise<boolean> {
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
      if (existingIdea.editing_by && existingIdea.editing_by !== userName) {
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
          editing_by: userName,
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

  static async unlockIdea(ideaId: string, userName: string): Promise<boolean> {
    try {
      // Only unlock if the current user is the one who locked it
      const { error } = await supabase
        .from('ideas')
        .update({
          editing_by: null,
          editing_at: null
        })
        .eq('id', ideaId)
        .eq('editing_by', userName)

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

  // Subscribe to real-time changes
  static subscribeToIdeas(callback: (ideas: IdeaCard[]) => void) {
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
          // Refetch all ideas when any change occurs
          this.getAllIdeas().then(callback)
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      console.log('Unsubscribing from real-time updates')
      supabase.removeChannel(channel)
    }
  }
}