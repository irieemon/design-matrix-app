import { PlatformStats, User, ProjectFile } from '../types'
import { logger } from '../utils/logger'
import { checkIsAdmin } from './supabase'

// ✅ SECURITY FIX: supabaseAdmin removed from frontend
// Admin operations MUST use backend API endpoints for security
// All methods that bypass RLS have been removed

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
    } catch (_error) {
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
  static formatFileSize(bytes: number | null | undefined): string {
    if (!bytes || bytes === 0) return '0 Bytes'
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
