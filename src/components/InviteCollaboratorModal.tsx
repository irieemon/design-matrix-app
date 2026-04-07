import React, { useState } from 'react'
import { X, UserPlus, Mail, Check, AlertCircle, Users } from 'lucide-react'
import RolePicker, { type CollaboratorRole } from './RolePicker'
import { getCsrfToken } from '../utils/cookieUtils'

interface InviteCollaboratorModalProps {
  isOpen: boolean
  onClose: () => void
  /** Optional legacy callback. If provided, called after a successful invite
   *  so the parent can refresh its collaborator list / send email via EmailJS. */
  onInvite?: (email: string, role: CollaboratorRole, inviteUrl: string) => void | Promise<void>
  projectId: string
  projectName: string
}

const InviteCollaboratorModal: React.FC<InviteCollaboratorModalProps> = ({
  isOpen,
  onClose,
  onInvite,
  projectId,
  projectName,
}) => {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CollaboratorRole>('editor')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successEmail, setSuccessEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessEmail('')

    const trimmed = email.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      setError("Couldn't send invite. Check the email address and try again.")
      return
    }

    setIsLoading(true)
    try {
      const csrfToken = getCsrfToken()
      const response = await fetch('/api/invitations', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ projectId, email: trimmed, role }),
      })

      if (!response.ok) {
        setError("Couldn't send invite. Check the email address and try again.")
        return
      }

      const data = (await response.json()) as { inviteUrl: string }
      setSuccessEmail(trimmed)
      setEmail('')

      if (onInvite) {
        try {
          await onInvite(trimmed, role, data.inviteUrl)
        } catch {
          // Email send failure shouldn't undo the invite — surface non-fatal note.
        }
      }
    } catch {
      setError("Couldn't send invite. Check the email address and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setEmail('')
    setRole('editor')
    setError('')
    setSuccessEmail('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div className="rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto bg-surface-primary">
        {/* Header */}
        <div
          className="relative text-white p-6 rounded-t-2xl"
          style={{ background: 'linear-gradient(to right, var(--sapphire-500), var(--sapphire-600))' }}
        >
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
            >
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Invite collaborator</h2>
              <p className="text-sm text-sapphire-100">to "{projectName}"</p>
            </div>
          </div>
        </div>

        {/* Success state — inline, modal stays open for batch invites */}
        {successEmail && (
          <div className="p-4 mx-6 mt-4 border rounded-xl bg-success-50 border-success-200">
            <div className="flex items-center gap-3 text-success-800">
              <div className="w-7 h-7 text-white rounded-full flex items-center justify-center bg-success-500">
                <Check className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium">Invite sent to {successEmail}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-5">
            <label htmlFor="invite-email" className="block text-sm font-semibold mb-2 text-graphite-700">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-graphite-400" />
              <input
                type="email"
                id="invite-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full pl-10 pr-4 py-3 border rounded-xl border-hairline-default text-graphite-900 bg-surface-primary"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2 text-graphite-700">Role</label>
            <RolePicker value={role} onChange={setRole} disabled={isLoading} />
          </div>

          {error && (
            <div className="mb-4 p-3 border rounded-xl flex items-center gap-2 bg-error-50 border-error-200 text-error-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-3 px-4 border font-semibold rounded-xl disabled:opacity-50 border-hairline-default text-graphite-700 bg-transparent"
            >
              Done
            </button>
            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="flex-1 py-3 px-4 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(to right, var(--sapphire-500), var(--sapphire-600))' }}
            >
              {isLoading ? (
                <>
                  <div
                    className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(255, 255, 255, 0.3)', borderTopColor: 'white' }}
                  />
                  Sending…
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Send invite
                </>
              )}
            </button>
          </div>
        </form>

        <div className="px-6 pb-6 pt-0">
          <div className="border rounded-xl p-4 bg-sapphire-50 border-sapphire-200">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 flex-shrink-0 mt-0.5 text-sapphire-600" />
              <div className="text-sm text-sapphire-800">
                <p className="font-semibold mb-1">Batch invites:</p>
                <p className="text-sapphire-700">
                  Invite multiple teammates without closing this window. Each invite is single-use and expires in 7 days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InviteCollaboratorModal
