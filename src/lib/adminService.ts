import { PlatformStats, AdminUser, AdminProject, User, ProjectFile } from '../types'
import { logger } from '../utils/logger'

export class AdminService {
  // Check if user has admin privileges
  static isAdmin(user: User | null): boolean {
    if (!user?.role) return false
    return user.role === 'admin' || user.role === 'super_admin'
  }

  static isSuperAdmin(user: User | null): boolean {
    return user?.role === 'super_admin' || false
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

  // Get all users with admin metadata
  static async getAllUsers(page: number = 1, limit: number = 50): Promise<{users: AdminUser[], total: number}> {
    // Mock data - in real app would fetch from database with pagination
    return new Promise(resolve => {
      setTimeout(() => {
        const mockUsers: AdminUser[] = [
          {
            id: 'super-admin-1',
            email: 'admin@prioritas.com',
            full_name: 'Super Admin',
            company: 'Prioritas',
            role: 'super_admin',
            is_active: true,
            last_login: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            project_count: 12,
            idea_count: 156,
            file_count: 45,
            total_file_size: 123456789
          },
          {
            id: 'admin-1',
            email: 'manager@company.com',
            full_name: 'Admin Manager',
            company: 'Company Inc',
            role: 'admin',
            is_active: true,
            last_login: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            project_count: 8,
            idea_count: 89,
            file_count: 28,
            total_file_size: 87654321
          },
          {
            id: 'user-1',
            email: 'john.doe@example.com',
            full_name: 'John Doe',
            company: 'Tech Corp',
            role: 'user',
            is_active: true,
            last_login: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            project_count: 5,
            idea_count: 47,
            file_count: 12,
            total_file_size: 34567890
          },
          {
            id: 'user-2', 
            email: 'sarah.wilson@startup.io',
            full_name: 'Sarah Wilson',
            company: 'StartupCo',
            role: 'user',
            is_active: true,
            last_login: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            project_count: 8,
            idea_count: 92,
            file_count: 23,
            total_file_size: 78901234
          },
          {
            id: 'user-3',
            email: 'mike.inactive@oldcorp.com',
            full_name: 'Mike Inactive',
            company: 'OldCorp',
            role: 'user',
            is_active: false,
            last_login: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            project_count: 2,
            idea_count: 8,
            file_count: 3,
            total_file_size: 5432109
          }
        ]

        const startIndex = (page - 1) * limit
        const paginatedUsers = mockUsers.slice(startIndex, startIndex + limit)
        
        resolve({
          users: paginatedUsers,
          total: mockUsers.length
        })
      }, 300)
    })
  }

  // Get all projects with admin metadata
  static async getAllProjects(page: number = 1, limit: number = 20): Promise<{projects: AdminProject[], total: number}> {
    return new Promise(resolve => {
      setTimeout(() => {
        const mockProjects: AdminProject[] = [
          {
            id: 'proj-1',
            name: 'Microsoft Supply Chain Integration',
            description: 'Enterprise supply chain transformation project',
            project_type: 'business_plan',
            status: 'active',
            visibility: 'private',
            priority_level: 'high',
            owner_id: 'user-1',
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            idea_count: 23,
            file_count: 5,
            total_file_size: 12345678,
            collaborator_count: 3,
            last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'proj-2',
            name: 'Mobile App Redesign',
            description: 'Complete UX overhaul for mobile application',
            project_type: 'software',
            status: 'active',
            visibility: 'team',
            priority_level: 'medium',
            owner_id: 'user-2',
            created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            idea_count: 34,
            file_count: 18,
            total_file_size: 45678901,
            collaborator_count: 7,
            last_activity: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'proj-3',
            name: 'Dormant Project',
            description: 'This project has been inactive',
            project_type: 'other',
            status: 'paused',
            visibility: 'private',
            priority_level: 'low',
            owner_id: 'user-3',
            created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            idea_count: 5,
            file_count: 1,
            total_file_size: 123456,
            collaborator_count: 0,
            last_activity: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]

        const startIndex = (page - 1) * limit
        const paginatedProjects = mockProjects.slice(startIndex, startIndex + limit)
        
        resolve({
          projects: paginatedProjects,
          total: mockProjects.length
        })
      }, 400)
    })
  }

  // Update user status
  static async updateUserStatus(userId: string, isActive: boolean): Promise<boolean> {
    logger.debug(`Admin: ${isActive ? 'Activating' : 'Deactivating'} user ${userId}`)
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 500)
    })
  }

  // Update user role
  static async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<boolean> {
    logger.debug(`Admin: Setting user ${userId} role to ${role}`)
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 500)
    })
  }

  // Delete project (admin override)
  static async deleteProject(projectId: string): Promise<boolean> {
    logger.debug(`Admin: Deleting project ${projectId}`)
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 800)
    })
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