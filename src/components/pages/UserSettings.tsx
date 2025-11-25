import React, { useState, useEffect } from 'react'
import { Settings, Save, LogOut, UserCircle, Calendar, Shield, CreditCard, TrendingUp, ExternalLink, HelpCircle, FileText } from 'lucide-react'
import { User } from '../../types'
import { useCurrentUser, useUserDisplay } from '../../contexts/UserContext'
import { subscriptionService } from '../../lib/services/subscriptionService'
import { supabase } from '../../lib/supabase'
import type { Subscription } from '../../types/subscription'
import { useNavigation } from '../../contexts/NavigationContext'
import FAQAdmin from '../admin/FAQAdmin'

interface UserSettingsProps {
  currentUser: User | null
  onLogout: () => void
  onUserUpdate?: (updatedUser: Partial<User>) => void
}

const UserSettings: React.FC<UserSettingsProps> = ({ currentUser: propCurrentUser, onLogout, onUserUpdate }) => {
  // Use centralized user context as primary source
  const contextUser = useCurrentUser()
  const { displayName: contextDisplayName, email: contextEmail } = useUserDisplay()
  const { handlePageChange } = useNavigation()

  // Use context user data as primary, fallback to props for backwards compatibility
  const currentUser = contextUser || propCurrentUser

  // ✅ HOOKS FIX: Move all hooks BEFORE early return (Rules of Hooks requirement)
  const [displayName, setDisplayName] = useState(currentUser?.full_name || currentUser?.email || contextDisplayName || '')
  const [email, setEmail] = useState(currentUser?.email || contextEmail || '')
  const [isEditing, setIsEditing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(true)
  const [managingSubscription, setManagingSubscription] = useState(false)

  // Load subscription data
  useEffect(() => {
    if (currentUser?.id) {
      subscriptionService.getSubscription(currentUser.id)
        .then(sub => {
          setSubscription(sub)
          setLoadingSubscription(false)
        })
        .catch(_err => {
          console.error('Failed to load subscription:', _err)
          setLoadingSubscription(false)
        })
    }
  }, [currentUser?.id])

  // Early return if no user data available (AFTER all hooks)
  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">Loading User Data...</h3>
          <p className="text-yellow-700 mb-4">Please wait while we load your profile information.</p>
          <div className="mt-4">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  const handleSaveProfile = async () => {
    setSaveStatus('saving')

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Call parent update function to update the centralized user context
      if (onUserUpdate) {
        onUserUpdate({ full_name: displayName })
      }

      setIsEditing(false)
      setSaveStatus('saved')

      // Reset save status after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (_error) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleLogout = () => {
    // localStorage cleanup is handled in the centralized useAuth hook
    onLogout()
  }

  const handleManageSubscription = async () => {
    setManagingSubscription(true)
    try {
      // Get Supabase session for authentication
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        alert('Authentication required. Please sign in again.')
        setManagingSubscription(false)
        return
      }

      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to create portal session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (_error) {
      console.error('Error creating portal session:', error)
      alert('Failed to open subscription management. Please try again.')
      setManagingSubscription(false)
    }
  }

  const getTierDisplay = (tier: string) => {
    switch (tier) {
      case 'free':
        return { name: 'Free', color: 'text-slate-600', bgColor: 'bg-slate-100' }
      case 'team':
        return { name: 'Team', color: 'text-blue-600', bgColor: 'bg-blue-100' }
      case 'enterprise':
        return { name: 'Enterprise', color: 'text-purple-600', bgColor: 'bg-purple-100' }
      default:
        return { name: 'Unknown', color: 'text-slate-600', bgColor: 'bg-slate-100' }
    }
  }

  const userStats = {
    joinDate: currentUser?.created_at || new Date().toISOString(),
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
                    setDisplayName(currentUser?.full_name || currentUser?.email || '')
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

      {/* Subscription Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Subscription & Billing</h3>
          <button
            onClick={() => handlePageChange('pricing')}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium"
          >
            <TrendingUp className="w-4 h-4" />
            <span>View All Plans</span>
          </button>
        </div>

        {loadingSubscription ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : subscription ? (
          <div className="space-y-4">
            {/* Current Plan */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <CreditCard className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Current Plan</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierDisplay(subscription.tier).bgColor} ${getTierDisplay(subscription.tier).color}`}
                    >
                      {getTierDisplay(subscription.tier).name}
                    </span>
                    {subscription.tier === 'free' && (
                      <span className="text-xs text-slate-500">• Free forever</span>
                    )}
                    {subscription.tier === 'team' && (
                      <span className="text-xs text-slate-500">• $29/month</span>
                    )}
                  </div>
                </div>
              </div>

              {subscription.tier !== 'free' && (
                <button
                  onClick={handleManageSubscription}
                  disabled={managingSubscription}
                  className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
                >
                  {managingSubscription ? (
                    <>
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Opening...</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3 h-3" />
                      <span>Manage</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Plan Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-medium text-slate-500 mb-1">Projects</p>
                <p className="text-lg font-semibold text-slate-900">
                  {subscription.tier === 'free' ? '1' : subscription.tier === 'team' ? '10' : 'Unlimited'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-medium text-slate-500 mb-1">AI Ideas/Month</p>
                <p className="text-lg font-semibold text-slate-900">
                  {subscription.tier === 'free' ? '5' : 'Unlimited'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-medium text-slate-500 mb-1">Team Members</p>
                <p className="text-lg font-semibold text-slate-900">
                  {subscription.tier === 'free' ? '3' : subscription.tier === 'team' ? '15' : 'Unlimited'}
                </p>
              </div>
            </div>

            {/* Upgrade CTA for Free Users */}
            {subscription.tier === 'free' && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">Upgrade to unlock more</h4>
                    <p className="text-xs text-blue-700 mb-3">
                      Get 10 projects, unlimited AI generations, and premium features starting at $29/month
                    </p>
                    <button
                      onClick={() => handlePageChange('pricing')}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>View Pricing</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Billing Period Info for Paid Users */}
            {subscription.tier !== 'free' && subscription.current_period_end && (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                <span className="text-slate-600">
                  {subscription.cancel_at_period_end ? 'Cancels on' : 'Renews on'}
                </span>
                <span className="font-medium text-slate-900">
                  {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-600">Unable to load subscription information</p>
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

      {/* FAQ & Support Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">FAQ & Support</h3>
            <p className="text-sm text-slate-600 mt-1">Manage help content and browse support resources</p>
          </div>
          <button
            onClick={() => handlePageChange('faq')}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            <span>View FAQ Page</span>
          </button>
        </div>

        {/* FAQ Admin Panel */}
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-2 mb-4">
            <HelpCircle className="w-5 h-5 text-slate-600" />
            <h4 className="text-sm font-semibold text-slate-900">Content Management</h4>
          </div>
          <FAQAdmin />
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