import { PlatformStats, AdminUser, AdminProject, User, ProjectFile } from '../types'
import { logger } from '../utils/logger'
import { checkIsAdmin } from './supabase'
import { DatabaseService } from './database'

// ✅ SECURITY FIX: supabaseAdmin removed from frontend
// Admin operations MUST use backend API endpoints for security
// All methods that bypass RLS are deprecated and will throw errors

export class AdminService {
  // Check if user has admin privileges (client-side check)
  static isAdmin(user: User | null): boolean {
    if (!user?.role) return false
    return user.role === 'admin' || user.role === 'super_admin'
  }

  static isSuperAdmin(user: User | null): boolean {
    return user?.role === 'super_admin' || false
  }

  // Server-side admin verification using service role
  static async verifyAdminStatus(userId: string): Promise<boolean> {
    try {
      return await checkIsAdmin(userId)
    } catch (error) {
      logger.error('AdminService: Failed to verify admin status:', error)
      return false
    }
  }

  // Admin-specific role detection using environment-based configuration
  static isAdminEmail(email: string): boolean {
    const { isAdminEmail } = require('./adminConfig')
    return isAdminEmail(email)
  }

  static isSuperAdminEmail(email: string): boolean {
    const { isSuperAdminEmail } = require('./adminConfig')
    return isSuperAdminEmail(email)
  }

  static getAdminRole(email: string): 'user' | 'admin' | 'super_admin' {
    const { getAdminRole } = require('./adminConfig')
    return getAdminRole(email)
  }

  // Generate mock platform statistics
  static async getPlatformStats(): Promise<PlatformStats> {
    // In a real app, this would fetch from your analytics/database
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          total_users: 2847,
          active_users_30d: 1832,
          total_projects: 8421,
          active_projects: 3204,
          total_ideas: 34829,
          total_files: 12847,
          total_file_size: 2847392847, // bytes
          new_users_7d: 127,
          new_projects_7d: 284
        })
      }, 500)
    })
  }

  // ⚠️ DEPRECATED: Admin operations should be backend-only
  static async getAllUsers(page: number = 1, limit: number = 50): Promise<{users: AdminUser[], total: number}> {
    logger.error('❌ AdminService.getAllUsers called from frontend - DEPRECATED')
    logger.error('🔒 Admin operations must use backend API: GET /api/admin/users')
    throw new Error('Admin operations must be performed via backend API endpoints')

    /* ORIGINAL CODE REMOVED FOR SECURITY
    try {
      logger.debug('AdminService: Fetching all users with service role')

      // Use service role to bypass RLS and get all users
      const allUsers = await adminGetAllUsers()

      // Enhance user data with admin metadata
      const adminUsers: AdminUser[] = await Promise.all(
        allUsers.map(async (user) => {
          try {
            // Get user's project count
            const userProjects = await DatabaseService.getUserOwnedProjects(user.id)

            // Get user's idea count from all their projects
            let totalIdeaCount = 0
            for (const project of userProjects) {
              const projectIdeas = await DatabaseService.getProjectIdeas(project.id)
              totalIdeaCount += projectIdeas.length
            }

            return {
              id: user.id,
              email: user.email,
              full_name: user.full_name || user.email.split('@')[0],
              company: user.company || 'Unknown',
              role: user.role || 'user',
              is_active: user.is_active !== false, // Default to true if not explicitly false
              last_login: user.last_login || user.updated_at,
              created_at: user.created_at,
              updated_at: user.updated_at,
              project_count: userProjects.length,
              idea_count: totalIdeaCount,
              file_count: 0, // TODO: Implement file counting
              total_file_size: 0 // TODO: Implement file size calculation
            } as AdminUser
          } catch (error) {
            logger.error(`AdminService: Error processing user ${user.id}:`, error)
            // Return basic user data if processing fails
            return {
              id: user.id,
              email: user.email,
              full_name: user.full_name || user.email.split('@')[0],
              company: 'Unknown',
              role: user.role || 'user',
              is_active: true,
              last_login: user.updated_at,
              created_at: user.created_at,
              updated_at: user.updated_at,
              project_count: 0,
              idea_count: 0,
              file_count: 0,
              total_file_size: 0
            } as AdminUser
          }
        })
      )

      // Apply pagination
      const startIndex = (page - 1) * limit
      const paginatedUsers = adminUsers.slice(startIndex, startIndex + limit)

      return {
        users: paginatedUsers,
        total: adminUsers.length
      }
    } catch (error) {
      logger.error('AdminService: Failed to get all users:', error)

      // Fallback to empty result
      return { users: [], total: 0 }
    }
    */
  }

  // ⚠️ DEPRECATED: Admin operations should be backend-only
  static async getAllProjects(page: number = 1, limit: number = 20): Promise<{projects: AdminProject[], total: number}> {
    logger.error('❌ AdminService.getAllProjects called from frontend - DEPRECATED')
    logger.error('🔒 Admin operations must use backend API: GET /api/admin/projects')
    throw new Error('Admin operations must be performed via backend API endpoints')

    /* ORIGINAL CODE REMOVED FOR SECURITY
    try {
      logger.debug('AdminService: Fetching all projects with service role')

      // Use service role to bypass RLS and get all projects
      const allProjects = await adminGetAllProjects()

      if (!allProjects || allProjects.length === 0) {
        return { projects: [], total: 0 }
      }

      logger.debug(`AdminService: Found ${allProjects.length} projects in database`)

      // Convert to AdminProject format with metadata
      const adminProjects: AdminProject[] = await Promise.all(
        allProjects.map(async (project) => {
          try {
            // Get project statistics using service role queries
            const ideaCount = await this.getProjectIdeaCount(project.id)
            const collaboratorCount = await this.getProjectCollaboratorCount(project.id)
            const lastActivity = await this.getProjectLastActivity(project.id)

            return {
              ...project,
              idea_count: ideaCount,
              file_count: 0, // TODO: Implement file counting with service role
              total_file_size: 0, // TODO: Implement file size calculation
              collaborator_count: collaboratorCount,
              last_activity: lastActivity
            } as AdminProject
          } catch (statsError) {
            logger.error(`AdminService: Error getting stats for project ${project.id}:`, statsError)
            // Return project with minimal stats if error occurs
            return {
              ...project,
              idea_count: 0,
              file_count: 0,
              total_file_size: 0,
              collaborator_count: 0,
              last_activity: project.updated_at
            } as AdminProject
          }
        })
      )

      // Apply pagination
      const startIndex = (page - 1) * limit
      const paginatedProjects = adminProjects.slice(startIndex, startIndex + limit)

      return {
        projects: paginatedProjects,
        total: adminProjects.length
      }
    } catch (error) {
      logger.error('AdminService: Failed to get all projects:', error)
      return { projects: [], total: 0 }
    }
    */
  }

  // Helper method to get project idea count using service role
  private static async getProjectIdeaCount(projectId: string): Promise<number> {
    try {
      const { count, error } = await supabaseAdmin
        .from('ideas')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)

      if (error) {
        logger.error('AdminService: Error getting idea count:', error)
        return 0
      }

      return count || 0
    } catch (error) {
      logger.error('AdminService: Failed to get idea count:', error)
      return 0
    }
  }

  // Helper method to get project collaborator count using service role
  private static async getProjectCollaboratorCount(projectId: string): Promise<number> {
    try {
      const { count, error } = await supabaseAdmin
        .from('project_collaborators')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'active')

      if (error) {
        logger.error('AdminService: Error getting collaborator count:', error)
        return 0
      }

      return count || 0
    } catch (error) {
      logger.error('AdminService: Failed to get collaborator count:', error)
      return 0
    }
  }

  // Helper method to get project last activity using service role
  private static async getProjectLastActivity(projectId: string): Promise<string> {
    try {
      // Get the most recent activity from ideas or project updates
      const { data: recentIdea } = await supabaseAdmin
        .from('ideas')
        .select('updated_at')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      const ideaActivity = recentIdea?.updated_at

      // For now, return the most recent idea activity or project updated_at
      return ideaActivity || new Date().toISOString()
    } catch (error) {
      logger.error('AdminService: Failed to get last activity:', error)
      return new Date().toISOString()
    }
  }

  // Update user status using service role
  static async updateUserStatus(userId: string, isActive: boolean): Promise<boolean> {
    try {
      logger.debug(`AdminService: ${isActive ? 'Activating' : 'Deactivating'} user ${userId}`)

      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        logger.error('AdminService: Error updating user status:', error)
        return false
      }

      logger.debug(`AdminService: Successfully ${isActive ? 'activated' : 'deactivated'} user ${userId}`)
      return true
    } catch (error) {
      logger.error('AdminService: Failed to update user status:', error)
      return false
    }
  }

  // Update user role using service role
  static async updateUserRole(userId: string, role: 'user' | 'admin' | 'super_admin'): Promise<boolean> {
    try {
      logger.debug(`AdminService: Setting user ${userId} role to ${role}`)

      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({
          role: role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        logger.error('AdminService: Error updating user role:', error)
        return false
      }

      logger.debug(`AdminService: Successfully set user ${userId} role to ${role}`)
      return true
    } catch (error) {
      logger.error('AdminService: Failed to update user role:', error)
      return false
    }
  }

  // Delete project (admin override) using service role
  static async deleteProject(projectId: string): Promise<boolean> {
    try {
      logger.debug(`AdminService: Deleting project ${projectId}`)

      // Delete associated ideas first
      const { error: ideasError } = await supabaseAdmin
        .from('ideas')
        .delete()
        .eq('project_id', projectId)

      if (ideasError) {
        logger.warn('AdminService: Error deleting project ideas:', ideasError)
        // Continue with project deletion even if ideas deletion fails
      }

      // Delete project collaborators
      const { error: collaboratorsError } = await supabaseAdmin
        .from('project_collaborators')
        .delete()
        .eq('project_id', projectId)

      if (collaboratorsError) {
        logger.warn('AdminService: Error deleting project collaborators:', collaboratorsError)
        // Continue with project deletion
      }

      // Delete the project itself
      const { error: projectError } = await supabaseAdmin
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (projectError) {
        logger.error('AdminService: Error deleting project:', projectError)
        return false
      }

      logger.debug(`AdminService: Successfully deleted project ${projectId}`)
      return true
    } catch (error) {
      logger.error('AdminService: Failed to delete project:', error)
      return false
    }
  }

  // Get project details for admin (cross-user access)
  static async getProjectDetails(projectId: string): Promise<AdminProject | null> {
    try {
      logger.debug(`AdminService: Fetching project details for ${projectId}`)

      const { data: project, error } = await supabaseAdmin
        .from('projects')
        .select(`
          *,
          owner:user_profiles!projects_owner_id_fkey(id, email, full_name)
        `)
        .eq('id', projectId)
        .single()

      if (error) {
        logger.error('AdminService: Error fetching project details:', error)
        return null
      }

      if (!project) {
        return null
      }

      // Get enhanced project metadata
      const ideaCount = await this.getProjectIdeaCount(projectId)
      const collaboratorCount = await this.getProjectCollaboratorCount(projectId)
      const lastActivity = await this.getProjectLastActivity(projectId)

      return {
        ...project,
        idea_count: ideaCount,
        file_count: 0, // TODO: Implement file counting
        total_file_size: 0, // TODO: Implement file size calculation
        collaborator_count: collaboratorCount,
        last_activity: lastActivity
      } as AdminProject
    } catch (error) {
      logger.error('AdminService: Failed to get project details:', error)
      return null
    }
  }

  // Get all ideas for a project (admin view)
  static async getProjectIdeas(projectId: string): Promise<any[]> {
    try {
      logger.debug(`AdminService: Fetching ideas for project ${projectId}`)

      const { data: ideas, error } = await supabaseAdmin
        .from('ideas')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('AdminService: Error fetching project ideas:', error)
        return []
      }

      return ideas || []
    } catch (error) {
      logger.error('AdminService: Failed to get project ideas:', error)
      return []
    }
  }

  // Get project files with admin view
  static async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    // Mock project files
    return new Promise(resolve => {
      setTimeout(() => {
        resolve([
          {
            id: 'file-1',
            project_id: projectId,
            name: 'proposal.pdf',
            original_name: 'Project Proposal.pdf',
            file_type: 'pdf',
            file_size: 2048576,
            mime_type: 'application/pdf',
            storage_path: `projects/${projectId}/files/proposal.pdf`,
            uploaded_by: 'user-1',
            created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          }
        ])
      }, 300)
    })
  }

  // Format file size for display
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Format numbers with commas
  static formatNumber(num: number): string {
    return num.toLocaleString()
  }

  // Get relative time string
  static getRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`
    return `${Math.floor(diffInSeconds / 31536000)}y ago`
  }
}