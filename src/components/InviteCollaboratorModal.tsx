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
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface-primary)' }}>
        {/* Header */}
        <div className="relative text-white p-6 rounded-t-2xl" style={{ background: 'linear-gradient(to right, var(--sapphire-500), var(--sapphire-600))' }}>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Invite Collaborator</h2>
              <p className="text-sm" style={{ color: 'var(--sapphire-100)' }}>to "{projectName}"</p>
            </div>
          </div>
        </div>

        {/* Success State */}
        {success && (
          <div className="p-6 border-b" style={{ backgroundColor: 'var(--success-50)', borderColor: 'var(--success-200)' }}>
            <div className="flex items-center gap-3" style={{ color: 'var(--success-800)' }}>
              <div className="w-8 h-8 text-white rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--success-500)' }}>
                <Check className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Invitation sent successfully!</p>
                <p className="text-sm" style={{ color: 'var(--success-600)' }}>An email invitation has been sent to the collaborator.</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Email Input */}
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-semibold mb-2" style={{ color: 'var(--graphite-700)' }}>
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--graphite-400)' }} />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full pl-10 pr-4 py-3 border rounded-xl transition-all"
                style={{
                  borderColor: 'var(--hairline-default)',
                  color: 'var(--graphite-900)',
                  backgroundColor: 'var(--surface-primary)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--sapphire-500)';
                  e.target.style.boxShadow = '0 0 0 3px var(--sapphire-100)';
                  e.target.style.outline = 'none';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--hairline-default)';
                  e.target.style.boxShadow = 'none';
                }}
                required
                disabled={isLoading || success}
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--graphite-700)' }}>
              <Shield className="inline w-4 h-4 mr-1" />
              Access Level
            </label>
            <div className="grid gap-3">
              {roles.map((role) => (
                <div
                  key={role.value}
                  className="relative border-2 rounded-xl p-4 cursor-pointer transition-all"
                  style={{
                    borderColor: selectedRole === role.value ? 'var(--sapphire-500)' : 'var(--hairline-default)',
                    backgroundColor: selectedRole === role.value ? 'var(--sapphire-50)' : 'transparent'
                  }}
                  onClick={() => !isLoading && !success && setSelectedRole(role.value)}
                  onMouseEnter={(e) => {
                    if (selectedRole !== role.value) {
                      e.currentTarget.style.borderColor = 'var(--graphite-300)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedRole !== role.value) {
                      e.currentTarget.style.borderColor = 'var(--hairline-default)';
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{role.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold" style={{ color: 'var(--graphite-900)' }}>{role.label}</h3>
                        {selectedRole === role.value && (
                          <div className="w-5 h-5 text-white rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--sapphire-500)' }}>
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm mb-2" style={{ color: 'var(--graphite-600)' }}>{role.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((permission, index) => (
                          <span
                            key={index}
                            className="inline-flex text-xs px-2 py-1 rounded-full"
                            style={{
                              backgroundColor: 'var(--canvas-secondary)',
                              color: 'var(--graphite-700)'
                            }}
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
            <div className="mb-4 p-3 border rounded-xl flex items-center gap-2" style={{ backgroundColor: 'var(--error-50)', borderColor: 'var(--error-200)', color: 'var(--error-700)' }}>
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
              className="flex-1 py-3 px-4 border font-semibold rounded-xl transition-colors disabled:opacity-50"
              style={{
                borderColor: 'var(--hairline-default)',
                color: 'var(--graphite-700)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = 'var(--canvas-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || success || !email.trim()}
              className="flex-1 py-3 px-4 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(to right, var(--sapphire-500), var(--sapphire-600))' }}
              onMouseEnter={(e) => {
                if (!isLoading && !success && email.trim()) {
                  e.currentTarget.style.background = 'linear-gradient(to right, var(--sapphire-600), var(--sapphire-700))';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(to right, var(--sapphire-500), var(--sapphire-600))';
              }}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255, 255, 255, 0.3)', borderTopColor: 'white' }}></div>
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
          <div className="border rounded-xl p-4" style={{ backgroundColor: 'var(--sapphire-50)', borderColor: 'var(--sapphire-200)' }}>
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--sapphire-600)' }} />
              <div className="text-sm" style={{ color: 'var(--sapphire-800)' }}>
                <p className="font-semibold mb-1">Email Invitations:</p>
                <ul className="space-y-1" style={{ color: 'var(--sapphire-700)' }}>
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