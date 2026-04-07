import { supabase } from '../supabase'
import { logger } from '../../utils/logger'

/**
 * Collaborator Repository
 *
 * Handles `project_collaborators` reads and removals. Inserts happen via
 * `accept_invitation()` SECURITY DEFINER function (see migration); only
 * project owners may remove collaborators (RLS-enforced).
 */

export type CollaboratorRole = 'viewer' | 'editor'
export type ProjectRole = 'owner' | CollaboratorRole

export interface CollaboratorRow {
  user_id: string
  role: CollaboratorRole
}

/**
 * List all collaborators for a project. Owner is implicit via
 * `projects.user_id` and is NOT included in this list.
 */
export async function listForProject(projectId: string): Promise<CollaboratorRow[]> {
  try {
    const { data, error } = await supabase
      .from('project_collaborators')
      .select('user_id, role')
      .eq('project_id', projectId)
    if (error) {
      logger.error('listForProject failed', error)
      return []
    }
    return (data ?? []) as CollaboratorRow[]
  } catch (error) {
    logger.error('listForProject exception', error)
    return []
  }
}

/**
 * Remove a collaborator from a project. RLS allows only the project owner
 * to perform this operation.
 */
export async function removeCollaborator(projectId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('project_collaborators')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
    if (error) {
      logger.error('removeCollaborator failed', error)
    }
  } catch (error) {
    logger.error('removeCollaborator exception', error)
  }
}

/**
 * Resolve the effective role of a user for a project. Checks ownership
 * first (owner is implicit via `projects.user_id`), then falls back to
 * `project_collaborators`. Returns `null` for users with no access.
 */
export async function getRoleForUser(
  projectId: string,
  userId: string
): Promise<ProjectRole | null> {
  try {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .maybeSingle()
    if (projectError) {
      logger.error('getRoleForUser project lookup failed', projectError)
      return null
    }
    if (project && (project as { user_id: string }).user_id === userId) {
      return 'owner'
    }

    const { data: collab, error: collabError } = await supabase
      .from('project_collaborators')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle()
    if (collabError) {
      logger.error('getRoleForUser collaborator lookup failed', collabError)
      return null
    }
    if (!collab) return null
    return (collab as { role: CollaboratorRole }).role
  } catch (error) {
    logger.error('getRoleForUser exception', error)
    return null
  }
}
