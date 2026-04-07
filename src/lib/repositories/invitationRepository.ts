import { supabase } from '../supabase'
import { logger } from '../../utils/logger'
import type { CollaboratorRole } from './collaboratorRepository'

/**
 * Invitation Repository
 *
 * Data-access for `project_invitations`. HTTP endpoints (create, accept,
 * lookup) live in `api/invitations/*` (plan 02). Tokens are stored as
 * SHA-256 hashes — the raw token only ever lives in the URL fragment of
 * the invitation email.
 */

export interface CreateInvitationInput {
  projectId: string
  email: string
  role: CollaboratorRole
  tokenHash: string
  expiresAt: Date
  invitedBy: string
}

export interface PendingInvitationRow {
  id: string
  email: string
  role: string
  expires_at: string
}

/**
 * Insert a new invitation row. Caller (server-side endpoint) is responsible
 * for generating + hashing the token and computing the expiry timestamp.
 */
export async function createInvitation(
  input: CreateInvitationInput
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('project_invitations')
    .insert({
      project_id: input.projectId,
      email: input.email,
      role: input.role,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt.toISOString(),
      invited_by: input.invitedBy,
    })
    .select('id')
    .single()
  if (error) {
    logger.error('createInvitation failed', error)
    throw new Error(error.message)
  }
  return { id: (data as { id: string }).id }
}

/**
 * List pending (not yet accepted, not expired) invitations for a project.
 */
export async function listPendingForProject(
  projectId: string
): Promise<PendingInvitationRow[]> {
  try {
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('project_invitations')
      .select('id, email, role, expires_at')
      .eq('project_id', projectId)
      .is('accepted_at', null)
      .gt('expires_at', nowIso)
    if (error) {
      logger.error('listPendingForProject failed', error)
      return []
    }
    return (data ?? []) as PendingInvitationRow[]
  } catch (error) {
    logger.error('listPendingForProject exception', error)
    return []
  }
}

/**
 * Revoke (delete) a pending invitation. RLS restricts this to the
 * project owner.
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('project_invitations')
      .delete()
      .eq('id', invitationId)
    if (error) {
      logger.error('revokeInvitation failed', error)
    }
  } catch (error) {
    logger.error('revokeInvitation exception', error)
  }
}
