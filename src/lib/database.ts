/**
 * DatabaseService - Backward-compatible facade for database operations
 *
 * REFACTORED: This class now acts as a facade, delegating to modular services
 * while maintaining 100% backward compatibility with existing consumers.
 *
 * All functionality has been extracted into specialized modules:
 * - IdeaService: Idea CRUD and locking
 * - ProjectService: Project CRUD
 * - CollaborationService: Project collaboration
 * - RoadmapRepository: Roadmap data access
 * - InsightsRepository: Insights data access
 * - IdeaLockingService: Editing locks
 * - RealtimeSubscriptionManager: Real-time subscriptions
 *
 * This file maintains the original static class pattern to ensure
 * NO breaking changes for 30+ consumer files.
 */

import type {
  IdeaCard,
  Project,
  ApiResponse,
  IdeaQueryOptions,
  CreateIdeaInput
} from '../types'

// Import modular services
import { IdeaService } from './services/IdeaService'
import { ProjectService } from './services/ProjectService'
import { CollaborationService } from './services/CollaborationService'
import { RoadmapRepository } from './database/repositories/RoadmapRepository'
import { InsightsRepository } from './database/repositories/InsightsRepository'
import { IdeaLockingService } from './database/services/IdeaLockingService'
import { RealtimeSubscriptionManager } from './database/services/RealtimeSubscriptionManager'

export class DatabaseService {
  // NOTE: All internal state and helper methods have been moved to specialized services:
  // - IdeaLockingService: Lock debouncing and state management
  // - DatabaseHelpers: Error handling and logging utilities
  // - ValidationHelpers: Input validation and sanitization

  // ============================================================================
  // IDEA OPERATIONS - Delegate to IdeaService
  // ============================================================================

  /**
   * Fetch ideas for a specific project (using admin client to bypass RLS)
   * DELEGATES TO: IdeaService.getIdeasByProject
   */
  static async getIdeasByProject(
    projectId?: string,
    _options?: IdeaQueryOptions
  ): Promise<ApiResponse<IdeaCard[]>> {
    const result = await IdeaService.getIdeasByProject(projectId, _options)
    return IdeaService.serviceResultToApiResponse(result)
  }

  /**
   * Legacy method for backward compatibility
   * DELEGATES TO: IdeaService.getAllIdeas
   */
  static async getAllIdeas(): Promise<IdeaCard[]> {
    return await IdeaService.getAllIdeas()
  }

  /**
   * Legacy method for backward compatibility
   * DELEGATES TO: IdeaService.getProjectIdeas
   */
  static async getProjectIdeas(projectId?: string): Promise<IdeaCard[]> {
    return await IdeaService.getProjectIdeas(projectId)
  }

  /**
   * Create a new idea
   * DELEGATES TO: IdeaService.createIdea
   */
  static async createIdea(idea: CreateIdeaInput): Promise<ApiResponse<IdeaCard>> {
    const result = await IdeaService.createIdea(idea)
    return IdeaService.serviceResultToApiResponse(result)
  }

  /**
   * Update an existing idea
   * DELEGATES TO: IdeaService.updateIdea
   */
  static async updateIdea(id: string, updates: Partial<Omit<IdeaCard, 'id' | 'created_at'>>): Promise<IdeaCard | null> {
    const result = await IdeaService.updateIdea(id, updates)
    return result.success ? result.data : null
  }

  /**
   * Delete an idea
   * DELEGATES TO: IdeaService.deleteIdea
   */
  static async deleteIdea(id: string): Promise<boolean> {
    const result = await IdeaService.deleteIdea(id)
    return result.success ? result.data : false
  }

  // ============================================================================
  // IDEA LOCKING - Delegate to IdeaLockingService
  // ============================================================================

  /**
   * Lock/unlock idea for editing with debouncing
   * DELEGATES TO: IdeaLockingService.lockIdeaForEditing
   */
  static async lockIdeaForEditing(ideaId: string, userId: string): Promise<boolean> {
    return await IdeaLockingService.lockIdeaForEditing(ideaId, userId)
  }

  /**
   * Unlock an idea
   * DELEGATES TO: IdeaLockingService.unlockIdea
   */
  static async unlockIdea(ideaId: string, userId: string): Promise<boolean> {
    return await IdeaLockingService.unlockIdea(ideaId, userId)
  }

  /**
   * Clean up stale locks (older than 5 minutes)
   * DELEGATES TO: IdeaLockingService.cleanupStaleLocks
   */
  static async cleanupStaleLocks(): Promise<void> {
    await IdeaLockingService.cleanupStaleLocks()
  }

  /**
   * Simplified channel name generation
   * DELEGATES TO: RealtimeSubscriptionManager.generateChannelName
   */
  static generateChannelName(projectId?: string, userId?: string): string {
    return RealtimeSubscriptionManager.generateChannelName(projectId, userId)
  }

  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS - Delegate to RealtimeSubscriptionManager
  // ============================================================================

  /**
   * Subscribe to real-time changes with improved error handling
   * DELEGATES TO: RealtimeSubscriptionManager.subscribeToIdeas
   * NOTE: Wraps the callback to fetch actual data from IdeaService
   */
  static subscribeToIdeas(
    callback: (ideas: IdeaCard[]) => void,
    projectId?: string,
    userId?: string,
    options?: { skipInitialLoad?: boolean }
  ) {
    return RealtimeSubscriptionManager.subscribeToIdeas(
      async (_ideas) => {
        // Fetch fresh ideas from IdeaService
        const freshIdeas = projectId
          ? await this.getProjectIdeas(projectId)
          : await this.getAllIdeas()
        callback(freshIdeas || [])
      },
      projectId,
      userId,
      options
    )
  }

  // ============================================================================
  // PROJECT MANAGEMENT - Delegate to ProjectService
  // ============================================================================

  /**
   * Get all projects
   * DELEGATES TO: ProjectService.legacyGetAllProjects
   */
  static async getAllProjects(): Promise<Project[]> {
    return await ProjectService.legacyGetAllProjects()
  }

  /**
   * Get projects owned by a specific user
   * DELEGATES TO: ProjectService.legacyGetUserOwnedProjects
   */
  static async getUserOwnedProjects(userId: string): Promise<Project[]> {
    return await ProjectService.legacyGetUserOwnedProjects(userId)
  }

  /**
   * Get current project
   * DELEGATES TO: ProjectService.legacyGetCurrentProject
   */
  static async getCurrentProject(): Promise<Project | null> {
    return await ProjectService.legacyGetCurrentProject()
  }

  /**
   * Get project by ID
   * DELEGATES TO: ProjectService.legacyGetProjectById
   */
  static async getProjectById(projectId: string): Promise<Project | null> {
    return await ProjectService.legacyGetProjectById(projectId)
  }

  /**
   * Create a new project
   * DELEGATES TO: ProjectService.legacyCreateProject
   */
  static async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project | null> {
    return await ProjectService.legacyCreateProject(project)
  }

  /**
   * Update an existing project
   * DELEGATES TO: ProjectService.legacyUpdateProject
   */
  static async updateProject(projectId: string, updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>): Promise<Project | null> {
    return await ProjectService.legacyUpdateProject(projectId, updates)
  }

  /**
   * Delete a project
   * DELEGATES TO: ProjectService.legacyDeleteProject
   */
  static async deleteProject(projectId: string): Promise<boolean> {
    return await ProjectService.legacyDeleteProject(projectId)
  }

  /**
   * Subscribe to project changes
   * DELEGATES TO: ProjectService.subscribeToProjects (wrapped with data fetching)
   */
  static subscribeToProjects(callback: (projects: Project[]) => void) {
    return ProjectService.subscribeToProjects(
      async (_projects) => {
        // Fetch fresh projects
        const freshProjects = await this.getAllProjects()
        callback(freshProjects)
      }
    )
  }

  // ============================================================================
  // PROJECT COLLABORATION - Delegate to CollaborationService
  // ============================================================================

  /**
   * Add project collaborator
   * DELEGATES TO: CollaborationService.legacyAddProjectCollaborator
   */
  static async addProjectCollaborator(
    projectId: string,
    userEmail: string,
    role: string = 'viewer',
    invitedBy: string,
    projectName?: string,
    inviterName?: string,
    inviterEmail?: string
  ): Promise<boolean> {
    return await CollaborationService.legacyAddProjectCollaborator(
      projectId,
      userEmail,
      role,
      invitedBy,
      projectName,
      inviterName,
      inviterEmail
    )
  }

  /**
   * Get project collaborators
   * DELEGATES TO: CollaborationService.legacyGetProjectCollaborators
   */
  static async getProjectCollaborators(projectId: string) {
    return await CollaborationService.legacyGetProjectCollaborators(projectId)
  }

  /**
   * Remove project collaborator
   * DELEGATES TO: CollaborationService.legacyRemoveProjectCollaborator
   */
  static async removeProjectCollaborator(projectId: string, userId: string): Promise<boolean> {
    return await CollaborationService.legacyRemoveProjectCollaborator(projectId, userId)
  }

  /**
   * Update collaborator role
   * DELEGATES TO: CollaborationService.legacyUpdateCollaboratorRole
   */
  static async updateCollaboratorRole(projectId: string, userId: string, newRole: string): Promise<boolean> {
    return await CollaborationService.legacyUpdateCollaboratorRole(projectId, userId, newRole)
  }

  /**
   * Get user's role in project
   * DELEGATES TO: CollaborationService.legacyGetUserProjectRole
   */
  static async getUserProjectRole(projectId: string, userId: string): Promise<string | null> {
    return await CollaborationService.legacyGetUserProjectRole(projectId, userId)
  }

  /**
   * Check if user can access project
   * DELEGATES TO: CollaborationService.legacyCanUserAccessProject
   */
  static async canUserAccessProject(projectId: string, userId: string): Promise<boolean> {
    return await CollaborationService.legacyCanUserAccessProject(projectId, userId)
  }

  /**
   * Get all projects accessible to user (owned + collaborated)
   * DELEGATES TO: ProjectService.legacyGetUserProjects
   */
  static async getUserProjects(userId: string): Promise<Project[]> {
    return await ProjectService.legacyGetUserProjects(userId)
  }

  /**
   * Subscribe to collaborator changes
   * DELEGATES TO: CollaborationService.subscribeToProjectCollaborators (wrapped)
   */
  static subscribeToProjectCollaborators(projectId: string, callback: (collaborators: any[]) => void) {
    return CollaborationService.subscribeToProjectCollaborators(
      projectId,
      async (_collaborators) => {
        // Fetch fresh collaborators
        const freshCollaborators = await this.getProjectCollaborators(projectId)
        callback(freshCollaborators)
      }
    )
  }

  // ============================================================================
  // ROADMAP MANAGEMENT - Delegate to RoadmapRepository
  // ============================================================================

  /**
   * Save project roadmap
   * DELEGATES TO: RoadmapRepository.saveProjectRoadmap
   */
  static async saveProjectRoadmap(
    projectId: string,
    roadmapData: any,
    createdBy: string,
    ideasAnalyzed: number
  ): Promise<string | null> {
    return await RoadmapRepository.saveProjectRoadmap(projectId, roadmapData, createdBy, ideasAnalyzed)
  }

  /**
   * Get project roadmaps
   * DELEGATES TO: RoadmapRepository.getProjectRoadmaps
   */
  static async getProjectRoadmaps(projectId: string): Promise<any[]> {
    return await RoadmapRepository.getProjectRoadmaps(projectId)
  }

  /**
   * Get specific roadmap
   * DELEGATES TO: RoadmapRepository.getProjectRoadmap
   */
  static async getProjectRoadmap(roadmapId: string): Promise<any | null> {
    return await RoadmapRepository.getProjectRoadmap(roadmapId)
  }

  /**
   * Update project roadmap
   * DELEGATES TO: RoadmapRepository.updateProjectRoadmap
   */
  static async updateProjectRoadmap(roadmapId: string, updatedRoadmapData: any): Promise<boolean> {
    return await RoadmapRepository.updateProjectRoadmap(roadmapId, updatedRoadmapData)
  }

  // ============================================================================
  // INSIGHTS MANAGEMENT - Delegate to InsightsRepository
  // ============================================================================

  /**
   * Save project insights
   * DELEGATES TO: InsightsRepository.saveProjectInsights
   */
  static async saveProjectInsights(
    projectId: string,
    insightsData: any,
    createdBy: string,
    ideasAnalyzed: number
  ): Promise<string | null> {
    return await InsightsRepository.saveProjectInsights(projectId, insightsData, createdBy, ideasAnalyzed)
  }

  /**
   * Get project insights
   * DELEGATES TO: InsightsRepository.getProjectInsights
   */
  static async getProjectInsights(projectId: string): Promise<any[]> {
    return await InsightsRepository.getProjectInsights(projectId)
  }

  /**
   * Get specific insight
   * DELEGATES TO: InsightsRepository.getProjectInsight
   */
  static async getProjectInsight(insightId: string): Promise<any | null> {
    return await InsightsRepository.getProjectInsight(insightId)
  }
}
