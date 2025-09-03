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

  // Subscribe to real-time changes
  static subscribeToIdeas(callback: (ideas: IdeaCard[]) => void) {
    const subscription = supabase
      .channel('ideas_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ideas'
        },
        () => {
          // Refetch all ideas when any change occurs
          this.getAllIdeas().then(callback)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }
}