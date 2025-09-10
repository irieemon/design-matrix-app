import { useState, useEffect } from 'react'
import { Search, Filter, UserCheck, UserX, Shield, Mail, Calendar, Activity, Eye } from 'lucide-react'
import { AdminUser, User } from '../../types'
import { AdminService } from '../../lib/adminService'
import { logger } from '../../utils/logger'

interface UserManagementProps {
  currentUser: User
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const { users: fetchedUsers } = await AdminService.getAllUsers(1, 50)
      setUsers(fetchedUsers)
    } catch (error) {
      logger.error('Error loading users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUserStatusToggle = async (userId: string, currentStatus: boolean) => {
    try {
      await AdminService.updateUserStatus(userId, !currentStatus)
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_active: !currentStatus } : user
      ))
    } catch (error) {
      logger.error('Error updating user status:', error)
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      await AdminService.updateUserRole(userId, newRole)
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))
    } catch (error) {
      logger.error('Error updating user role:', error)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.company?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && user.is_active) ||
                         (filterStatus === 'inactive' && !user.is_active)
    
    return matchesSearch && matchesFilter
  })

  const UserModal: React.FC<{ user: AdminUser }> = ({ user }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
                {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('') : user.email[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{user.full_name || 'Unnamed User'}</h2>
                <p className="text-slate-600">{user.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-slate-100 text-slate-800'
                  }`}>
                    {user.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowUserModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Account Information</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">{user.email}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    Last seen {user.last_login ? AdminService.getRelativeTime(user.last_login) : 'Never'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Usage Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Projects</span>
                  <span className="text-sm font-medium text-slate-900">{user.project_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Ideas</span>
                  <span className="text-sm font-medium text-slate-900">{user.idea_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Files</span>
                  <span className="text-sm font-medium text-slate-900">{user.file_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Storage Used</span>
                  <span className="text-sm font-medium text-slate-900">
                    {AdminService.formatFileSize(user.total_file_size)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => handleUserStatusToggle(user.id, user.is_active || false)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                user.is_active 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              <span>{user.is_active ? 'Deactivate' : 'Activate'}</span>
            </button>
            
            {AdminService.isSuperAdmin(currentUser) && (
              <button
                onClick={() => handleRoleChange(user.id, user.role === 'admin' ? 'user' : 'admin')}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-medium transition-colors"
              >
                <Shield className="w-4 h-4" />
                <span>{user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">User Management</h1>
          <p className="text-slate-600">Manage platform users, roles, and permissions</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center space-x-3">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Activity className="w-6 h-6 text-blue-600 animate-pulse" />
              </div>
              <p className="text-slate-600">Loading users...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 font-medium text-slate-700">User</th>
                    <th className="text-left p-4 font-medium text-slate-700">Status</th>
                    <th className="text-left p-4 font-medium text-slate-700">Role</th>
                    <th className="text-left p-4 font-medium text-slate-700">Projects</th>
                    <th className="text-left p-4 font-medium text-slate-700">Last Active</th>
                    <th className="text-left p-4 font-medium text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-sm font-bold">
                            {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('') : user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.full_name || 'Unnamed User'}</p>
                            <p className="text-sm text-slate-600">{user.email}</p>
                            {user.company && (
                              <p className="text-xs text-slate-500">{user.company}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {user.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <p className="font-medium text-slate-900">{user.project_count}</p>
                          <p className="text-slate-500">{user.idea_count} ideas</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-slate-600">
                          {user.last_login ? AdminService.getRelativeTime(user.last_login) : 'Never'}
                        </p>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setSelectedUser(user)
                            setShowUserModal(true)
                          }}
                          className="flex items-center space-x-1 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-sm">View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results summary */}
        <div className="mt-4 text-sm text-slate-600 text-center">
          Showing {filteredUsers.length} of {users.length} users
        </div>

        {/* User Detail Modal */}
        {showUserModal && selectedUser && (
          <UserModal user={selectedUser} />
        )}
      </div>
    </div>
  )
}

export default UserManagement