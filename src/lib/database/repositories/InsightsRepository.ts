/**
 * InsightsRepository - Data access layer for project insights
 *
 * Handles all database operations related to project insights including
 * CRUD operations, versioning, and insights queries.
 */

import { supabase, createAuthenticatedClientFromLocalStorage } from '../../supabase'
import { logger } from '../../../utils/logger'
import { DatabaseHelpers } from '../utils/DatabaseHelpers'

export interface InsightData {
  id?: string
  project_id: string
  version: number
  name: string
  insights_data: any
  created_by: string
  ideas_analyzed: number
  created_at?: string
  updated_at?: string
}

export class InsightsRepository {
  /**
   * Save new project insights with auto-incremented version
   */
  static async saveProjectInsights(
    projectId: string,
    insightsData: any,
    createdBy: string,
    ideasAnalyzed: number
  ): Promise<string | null> {
    try {
      logger.debug('📊 InsightsRepository: Saving insights for project:', projectId)

      // Get the next version number
      const { data: existingInsights } = await supabase
        .from('project_insights')
        .select('version')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)

      const nextVersion = existingInsights && existingInsights.length > 0
        ? existingInsights[0].version + 1
        : 1

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
        logger.error('❌ InsightsRepository: Error saving insights:', error)
        throw error
      }

      logger.debug('✅ InsightsRepository: Insights saved successfully:', data.id)
      return data.id
    } catch (_error) {
      logger.error('💥 InsightsRepository: Error in saveProjectInsights:', error)
      return null
    }
  }

  /**
   * Get all insights for a project, ordered by version (descending)
   */
  static async getProjectInsights(projectId: string): Promise<InsightData[]> {
    try {
      // CRITICAL FIX: Use authenticated client from localStorage when available
      // On refresh, getSession() may timeout but localStorage has valid auth token
      let client = supabase
      const fallbackClient = createAuthenticatedClientFromLocalStorage()
      if (fallbackClient) {
        logger.debug('📊 Using authenticated client from localStorage for insights query')
        client = fallbackClient
      }

      const { data, error } = await client
        .from('project_insights')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false })

      if (error) {
        logger.error('❌ InsightsRepository: Error fetching insights:', error)
        throw error
      }

      return data || []
    } catch (_error) {
      logger.error('💥 InsightsRepository: Error in getProjectInsights:', error)
      return []
    }
  }

  /**
   * Get a specific insight by ID
   */
  static async getProjectInsight(insightId: string): Promise<InsightData | null> {
    try {
      const { data, error } = await supabase
        .from('project_insights')
        .select('*')
        .eq('id', insightId)
        .single()

      if (error) {
        if (DatabaseHelpers.isNotFoundError(error)) {
          return null
        }
        logger.error('❌ InsightsRepository: Error fetching insight:', error)
        throw error
      }

      return data
    } catch (_error) {
      logger.error('💥 InsightsRepository: Error in getProjectInsight:', error)
      return null
    }
  }

  /**
   * Update an existing insight
   */
  static async updateProjectInsight(
    insightId: string,
    updatedInsightData: any
  ): Promise<boolean> {
    try {
      logger.debug('🔄 InsightsRepository: Updating insight:', insightId)

      const { error } = await supabase
        .from('project_insights')
        .update({
          insights_data: updatedInsightData,
          updated_at: DatabaseHelpers.formatTimestamp()
        })
        .eq('id', insightId)

      if (error) {
        logger.error('❌ InsightsRepository: Error updating insight:', error)
        throw error
      }

      logger.debug('✅ InsightsRepository: Insight updated successfully')
      return true
    } catch (_error) {
      logger.error('💥 InsightsRepository: Error in updateProjectInsight:', error)
      return false
    }
  }

  /**
   * Delete an insight
   */
  static async deleteProjectInsight(insightId: string): Promise<boolean> {
    try {
      logger.debug('🗑️ InsightsRepository: Deleting insight:', insightId)

      const { error } = await supabase
        .from('project_insights')
        .delete()
        .eq('id', insightId)

      if (error) {
        logger.error('❌ InsightsRepository: Error deleting insight:', error)
        throw error
      }

      logger.debug('✅ InsightsRepository: Insight deleted successfully')
      return true
    } catch (_error) {
      logger.error('💥 InsightsRepository: Error in deleteProjectInsight:', error)
      return false
    }
  }

  /**
   * Get the latest insight for a project
   */
  static async getLatestInsight(projectId: string): Promise<InsightData | null> {
    try {
      const { data, error } = await supabase
        .from('project_insights')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (DatabaseHelpers.isNotFoundError(error)) {
          return null
        }
        logger.error('❌ InsightsRepository: Error fetching latest insight:', error)
        throw error
      }

      return data
    } catch (_error) {
      logger.error('💥 InsightsRepository: Error in getLatestInsight:', error)
      return null
    }
  }
}
