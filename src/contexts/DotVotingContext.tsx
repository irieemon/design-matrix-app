/**
 * DotVotingContext — Phase 05.4a Wave 2, Unit 3
 *
 * Provides a single useDotVoting instance per session page. DotVoteControls
 * and DotBudgetIndicator read state from this context without re-invoking
 * the hook individually (D-11).
 *
 * SessionPresenceStack does NOT consume this context — presence is a separate
 * concern (D-14).
 */

import React, { createContext, useContext } from 'react'
import { useDotVoting } from '../hooks/useDotVoting'
import type { UseDotVotingReturn } from '../hooks/useDotVoting'
import type { ScopedRealtimeManager } from '../lib/realtime/ScopedRealtimeManager'

// Exported so DotBudgetIndicator can read votesUsed via useContext without
// requiring a separate prop (session header wire-up path per ADR contract table).
export const DotVotingContext = createContext<UseDotVotingReturn | null>(null)

export interface DotVotingProviderProps {
  sessionId: string
  currentUserId: string
  manager: ScopedRealtimeManager | null
  children: React.ReactNode
}

export function DotVotingProvider({
  sessionId,
  currentUserId,
  manager,
  children,
}: DotVotingProviderProps): React.ReactElement {
  const value = useDotVoting(sessionId, currentUserId, manager)

  return (
    <DotVotingContext.Provider value={value}>
      {children}
    </DotVotingContext.Provider>
  )
}

/**
 * Consume the DotVoting context. Must be called inside a DotVotingProvider.
 * Throws if used outside the provider — fail-fast at development time.
 */
export function useDotVotingContext(): UseDotVotingReturn {
  const ctx = useContext(DotVotingContext)
  if (ctx === null) {
    throw new Error('useDotVotingContext must be used inside DotVotingProvider')
  }
  return ctx
}
