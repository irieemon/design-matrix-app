import { useState } from 'react'
import { Settings, Save, LogOut, UserCircle, Calendar, Shield } from 'lucide-react'

interface UserSettingsProps {
  currentUser: string
  onLogout: () => void
  onUserUpdate?: (newName: string) => void
}

const UserSettings: React.FC<UserSettingsProps> = ({ currentUser, onLogout, onUserUpdate }) => {
  const [displayName, setDisplayName] = useState(currentUser)
  const [email, setEmail] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const handleSaveProfile = async () => {
    setSaveStatus('saving')
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Update user name in localStorage
      localStorage.setItem('prioritasUser', displayName)
      
      // Call parent update function if provided
      if (onUserUpdate) {
        onUserUpdate(displayName)
      }
      
      setIsEditing(false)
      setSaveStatus('saved')
      
      // Reset save status after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('prioritasUser')
    onLogout()
  }

  const userStats = {
    joinDate: localStorage.getItem('prioritasUserJoinDate') || new Date().toISOString(),
    lastLogin: new Date().toISOString()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">User Settings</h1>
        <p className="text-slate-600">Manage your profile and account preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Profile Information</h3>
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">Edit Profile</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setDisplayName(currentUser)
                    setIsEditing(false)
                    setSaveStatus('idle')
                  }}
                  className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saveStatus === 'saving' || displayName.trim() === ''}
                  className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Picture and Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{displayName}</h4>
                <p className="text-sm text-slate-500">Prioritas User</p>
              </div>
            </div>

            {/* Display Name Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Display Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your display name"
                />
              ) : (
                <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                  {displayName}
                </div>
              )}
            </div>

            {/* Email Field (placeholder for future functionality) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isEditing}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="email@example.com (optional)"
              />
            </div>
          </div>

          {/* Account Stats */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Account Information</h4>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                <Calendar className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Member Since</p>
                  <p className="text-xs text-slate-500">
                    {new Date(userStats.joinDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                <UserCircle className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Account Type</p>
                  <p className="text-xs text-slate-500">Standard User</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                <Shield className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Last Activity</p>
                  <p className="text-xs text-slate-500">
                    {new Date(userStats.lastLogin).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Status Messages */}
        {saveStatus === 'saved' && (
          <div className="mt-4 flex items-center space-x-2 text-emerald-600 bg-emerald-50 px-4 py-3 rounded-lg">
            <UserCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Profile updated successfully!</span>
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="mt-4 flex items-center space-x-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg">
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Error updating profile. Please try again.</span>
          </div>
        )}
      </div>

      {/* Preferences Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Preferences</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-slate-900">Email Notifications</h4>
              <p className="text-xs text-slate-500">Receive updates about your ideas and collaborations</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-slate-900">Auto-save Ideas</h4>
              <p className="text-xs text-slate-500">Automatically save changes as you type</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-slate-900">Show Grid Lines</h4>
              <p className="text-xs text-slate-500">Display grid lines on the priority matrix</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200/60 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-red-900 mb-2">Account Actions</h3>
        <p className="text-sm text-red-700 mb-4">Manage your account session</p>
        
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export default UserSettings