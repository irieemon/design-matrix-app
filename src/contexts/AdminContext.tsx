import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { AdminService } from '../lib/adminService'
import { useUser } from './UserContext'
import { logger } from '../utils/logger'
import { apiClient } from '../lib/apiClient'

interface AdminCapability {
  name: string
  description: string
  level: 'admin' | 'super_admin'
}

interface AdminContextType {
  // Admin status
  isAdmin: boolean
  isSuperAdmin: boolean
  isAdminMode: boolean

  // Admin capabilities
  adminCapabilities: AdminCapability[]

  // Mode management
  switchToAdminMode: () => Promise<void>
  switchToUserMode: () => void

  // Admin verification
  verifyAdminStatus: () => Promise<boolean>

  // Loading states
  isVerifyingAdmin: boolean
  adminInitialized: boolean
}

const AdminContext = createContext<AdminContextType | null>(null)

// Admin capabilities based on role level
const ADMIN_CAPABILITIES: AdminCapability[] = [
  {
    name: 'view_all_users',
    description: 'View all user accounts and profiles',
    level: 'admin'
  },
  {
    name: 'view_all_projects',
    description: 'View all projects across all users',
    level: 'admin'
  },
  {
    name: 'update_user_status',
    description: 'Activate/deactivate user accounts',
    level: 'admin'
  },
  {
    name: 'view_platform_stats',
    description: 'Access platform analytics and statistics',
    level: 'admin'
  },
  {
    name: 'update_user_roles',
    description: 'Change user roles and permissions',
    level: 'super_admin'
  },
  {
    name: 'delete_any_project',
    description: 'Delete projects owned by any user',
    level: 'super_admin'
  },
  {
    name: 'system_administration',
    description: 'Access system-level administration tools',
    level: 'super_admin'
  }
]

interface AdminProviderProps {
  children: ReactNode
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
  const { currentUser } = useUser()
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false)
  const [adminInitialized, setAdminInitialized] = useState(false)

  // Compute admin status based on user
  const isAdmin = currentUser ? AdminService.isAdmin(currentUser) : false
  const isSuperAdmin = currentUser ? AdminService.isSuperAdmin(currentUser) : false

  // Get capabilities based on user role
  const adminCapabilities = React.useMemo(() => {
    if (!currentUser || !isAdmin) return []

    if (isSuperAdmin) {
      return ADMIN_CAPABILITIES // Super admin gets all capabilities
    } else {
      return ADMIN_CAPABILITIES.filter(cap => cap.level === 'admin')
    }
  }, [currentUser, isAdmin, isSuperAdmin])

  // Server-side admin verification
  const verifyAdminStatus = async (): Promise<boolean> => {
    if (!currentUser) return false

    try {
      setIsVerifyingAdmin(true)
      logger.debug('AdminContext: Verifying admin status for user:', currentUser.id)

      // SECURITY ENHANCEMENT: Call new server-side admin verification endpoint
      // This uses httpOnly cookie authentication and performs database role check
      const response = await apiClient.post<{
        success: boolean
        isAdmin: boolean
        isSuperAdmin: boolean
        capabilities: string[]
      }>('/api/auth?action=admin-verify')

      logger.debug('AdminContext: Admin verification result:', {
        isAdmin: response.isAdmin,
        isSuperAdmin: response.isSuperAdmin,
        capabilities: response.capabilities.length
      })

      return response.isAdmin
    } catch (error) {
      logger.error('AdminContext: Failed to verify admin status:', error)
      return false
    } finally {
      setIsVerifyingAdmin(false)
    }
  }

  // Switch to admin mode with verification
  const switchToAdminMode = async (): Promise<void> => {
    if (!isAdmin) {
      logger.warn('AdminContext: Attempted to switch to admin mode without admin privileges')
      return
    }

    try {
      logger.debug('AdminContext: Switching to admin mode')

      // Verify admin status with server
      const isVerified = await verifyAdminStatus()
      if (!isVerified) {
        logger.error('AdminContext: Server-side admin verification failed')
        throw new Error('Admin verification failed')
      }

      setIsAdminMode(true)
      logger.debug('AdminContext: Successfully switched to admin mode')

      // SECURITY FIX: Removed sessionStorage persistence per PRIO-SEC-004 (CVSS 7.2)
      // Previous code stored admin mode in sessionStorage (vulnerable to XSS privilege escalation)
      // Admin mode is now only in memory and verified via backend on each session
      // This prevents client-side privilege escalation attacks
    } catch (error) {
      logger.error('AdminContext: Failed to switch to admin mode:', error)
      throw error
    }
  }

  // Switch back to user mode
  const switchToUserMode = (): void => {
    logger.debug('AdminContext: Switching to user mode')
    setIsAdminMode(false)
    // SECURITY FIX: No sessionStorage to remove (memory-only admin mode)
  }

  // Initialize admin context when user changes
  useEffect(() => {
    const initializeAdminContext = async () => {
      if (!currentUser) {
        setIsAdminMode(false)
        setAdminInitialized(true)
        return
      }

      try {
        // SECURITY FIX: Removed sessionStorage admin mode persistence per PRIO-SEC-004
        // Admin mode is no longer restored from sessionStorage (memory-only)
        // User must explicitly enable admin mode each session for security

        // Admin mode defaults to false - user must explicitly enable
        setIsAdminMode(false)
        logger.debug('AdminContext: Admin mode initialized to false (requires explicit activation)')
      } catch (error) {
        logger.error('AdminContext: Error initializing admin context:', error)
      } finally {
        setAdminInitialized(true)
      }
    }

    initializeAdminContext()
  }, [currentUser, isAdmin])

  // Clear admin mode when user logs out
  useEffect(() => {
    if (!currentUser) {
      setIsAdminMode(false)
      // SECURITY FIX: No sessionStorage to remove (memory-only admin mode)
    }
  }, [currentUser])

  const contextValue: AdminContextType = {
    isAdmin,
    isSuperAdmin,
    isAdminMode,
    adminCapabilities,
    switchToAdminMode,
    switchToUserMode,
    verifyAdminStatus,
    isVerifyingAdmin,
    adminInitialized
  }

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  )
}

// Hook to use admin context
export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext)
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}

// HOC to wrap components that need admin context
export const withAdmin = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> => {
  const WithAdminComponent = (props: P) => {
    return (
      <AdminProvider>
        <Component {...props} />
      </AdminProvider>
    )
  }

  WithAdminComponent.displayName = `withAdmin(${Component.displayName || Component.name})`
  return WithAdminComponent
}

export { AdminContext }