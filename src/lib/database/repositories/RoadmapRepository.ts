/**
 * RoadmapRepository - Data access layer for project roadmaps
 *
 * Handles all database operations related to project roadmaps including
 * CRUD operations, versioning, and roadmap queries.
 */

import { supabase } from '../../supabase'
import { logger } from '../../../utils/logger'
import { DatabaseHelpers } from '../utils/DatabaseHelpers'

export interface RoadmapData {
  id?: string
  project_id: string
  version: number
  name: string
  roadmap_data: any
  created_by: string
  ideas_analyzed: number
  created_at?: string
  updated_at?: string
}

export class RoadmapRepository {
  /**
   * Save a new project roadmap with auto-incremented version
   */
  static async saveProjectRoadmap(
    projectId: string,
    roadmapData: any,
    createdBy: string,
    ideasAnalyzed: number
  ): Promise<string | null> {
    try {
      logger.debug('🗺️ RoadmapRepository: Saving roadmap for project:', projectId)

      // Get the next version number
      const { data: existingRoadmaps } = await supabase
        .from('project_roadmaps')
        .select('version')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)

      const nextVersion = existingRoadmaps && existingRoadmaps.length > 0
        ? existingRoadmaps[0].version + 1
        : 1

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
        logger.error('❌ RoadmapRepository: Error saving roadmap:', error)
        throw error
      }

      logger.debug('✅ RoadmapRepository: Roadmap saved successfully:', data.id)
      return data.id
    } catch (error) {
      logger.error('💥 RoadmapRepository: Error in saveProjectRoadmap:', error)
      return null
    }
  }

  /**
   * Get all roadmaps for a project, ordered by version (descending)
   */
  static async getProjectRoadmaps(projectId: string): Promise<RoadmapData[]> {
    try {
      const { data, error } = await supabase
        .from('project_roadmaps')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false })

      if (error) {
        logger.error('❌ RoadmapRepository: Error fetching roadmaps:', error)
        throw error
      }

      return data || []
    } catch (error) {
      logger.error('💥 RoadmapRepository: Error in getProjectRoadmaps:', error)
      return []
    }
  }

  /**
   * Get a specific roadmap by ID
   */
  static async getProjectRoadmap(roadmapId: string): Promise<RoadmapData | null> {
    try {
      const { data, error } = await supabase
        .from('project_roadmaps')
        .select('*')
        .eq('id', roadmapId)
        .single()

      if (error) {
        if (DatabaseHelpers.isNotFoundError(error)) {
          return null
        }
        logger.error('❌ RoadmapRepository: Error fetching roadmap:', error)
        throw error
      }

      return data
    } catch (error) {
      logger.error('💥 RoadmapRepository: Error in getProjectRoadmap:', error)
      return null
    }
  }

  /**
   * Update an existing roadmap
   */
  static async updateProjectRoadmap(
    roadmapId: string,
    updatedRoadmapData: any
  ): Promise<boolean> {
    try {
      logger.debug('🔄 RoadmapRepository: Updating roadmap:', roadmapId)

      const { error } = await supabase
        .from('project_roadmaps')
        .update({
          roadmap_data: updatedRoadmapData
          // Note: updated_at column doesn't exist in schema or is auto-managed by Supabase
        })
        .eq('id', roadmapId)

      if (error) {
        logger.error('❌ RoadmapRepository: Error updating roadmap:', error)
        throw error
      }

      logger.debug('✅ RoadmapRepository: Roadmap updated successfully')
      return true
    } catch (error) {
      logger.error('💥 RoadmapRepository: Error in updateProjectRoadmap:', error)
      return false
    }
  }

  /**
   * Delete a roadmap
   */
  static async deleteProjectRoadmap(roadmapId: string): Promise<boolean> {
    try {
      logger.debug('🗑️ RoadmapRepository: Deleting roadmap:', roadmapId)

      const { error } = await supabase
        .from('project_roadmaps')
        .delete()
        .eq('id', roadmapId)

      if (error) {
        logger.error('❌ RoadmapRepository: Error deleting roadmap:', error)
        throw error
      }

      logger.debug('✅ RoadmapRepository: Roadmap deleted successfully')
      return true
    } catch (error) {
      logger.error('💥 RoadmapRepository: Error in deleteProjectRoadmap:', error)
      return false
    }
  }

  /**
   * Get the latest roadmap for a project
   */
  static async getLatestRoadmap(projectId: string): Promise<RoadmapData | null> {
    try {
      const { data, error } = await supabase
        .from('project_roadmaps')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (DatabaseHelpers.isNotFoundError(error)) {
          return null
        }
        logger.error('❌ RoadmapRepository: Error fetching latest roadmap:', error)
        throw error
      }

      return data
    } catch (error) {
      logger.error('💥 RoadmapRepository: Error in getLatestRoadmap:', error)
      return null
    }
  }
}
