import React, { useState } from 'react'
import { X, UserPlus, Mail, Shield, Users, Check, AlertCircle } from 'lucide-react'

interface InviteCollaboratorModalProps {
  isOpen: boolean
  onClose: () => void
  onInvite: (email: string, role: string) => Promise<boolean>
  projectName: string
}

const roles = [
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Can view the project and ideas',
    icon: '👁️',
    permissions: ['View project', 'View ideas', 'View roadmap']
  },
  {
    value: 'editor',
    label: 'Editor', 
    description: 'Can edit ideas and contribute to the project',
    icon: '✏️',
    permissions: ['View project', 'Create & edit ideas', 'Move ideas', 'View roadmap', 'Comment']
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Can manage project settings and collaborators',
    icon: '⚙️',
    permissions: ['All editor permissions', 'Invite collaborators', 'Manage project settings', 'Delete ideas']
  }
]

const InviteCollaboratorModal: React.FC<InviteCollaboratorModalProps> = ({
  isOpen,
  onClose,
  onInvite,
  projectName
}) => {
  const [email, setEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState('editor')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      setIsLoading(false)
      return
    }

    try {
      const result = await onInvite(email, selectedRole)
      
      if (result) {
        setSuccess(true)
        setEmail('')
        setSelectedRole('editor')
        
        // Auto close after success
        setTimeout(() => {
          setSuccess(false)
          onClose()
        }, 2000)
      } else {
        setError('Failed to send invitation. User may already be a collaborator.')
      }
    } catch (err) {
      setError('An error occurred while sending the invitation')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setEmail('')
    setSelectedRole('editor')
    setError('')
    setSuccess(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-2xl">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Invite Collaborator</h2>
              <p className="text-blue-100 text-sm">to "{projectName}"</p>
            </div>
          </div>
        </div>

        {/* Success State */}
        {success && (
          <div className="p-6 bg-green-50 border-b border-green-200">
            <div className="flex items-center gap-3 text-green-800">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Invitation sent successfully!</p>
                <p className="text-sm text-green-600">An email invitation has been sent to the collaborator.</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Email Input */}
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
                disabled={isLoading || success}
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <Shield className="inline w-4 h-4 mr-1" />
              Access Level
            </label>
            <div className="grid gap-3">
              {roles.map((role) => (
                <div
                  key={role.value}
                  className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${
                    selectedRole === role.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => !isLoading && !success && setSelectedRole(role.value)}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{role.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{role.label}</h3>
                        {selectedRole === role.value && (
                          <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{role.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((permission, index) => (
                          <span
                            key={index}
                            className="inline-flex text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    checked={selectedRole === role.value}
                    onChange={() => setSelectedRole(role.value)}
                    className="absolute top-4 right-4 w-4 h-4"
                    disabled={isLoading || success}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || success || !email.trim()}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : success ? (
                <>
                  <Check className="w-4 h-4" />
                  Sent!
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Send Invitation
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 pb-6 pt-0">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Email Invitations:</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• A real email invitation will be sent to the collaborator</li>
                  <li>• They'll receive project details and access instructions</li>
                  <li>• You can change roles or remove access anytime</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InviteCollaboratorModal