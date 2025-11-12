/**
 * ModalContext - Manages modal and dialog state
 *
 * Extracted from App.tsx to separate modal management concerns.
 * Handles all modal states including add, AI, editing, and drag operations.
 */

import { createContext, useContext, useState, useMemo, ReactNode } from 'react'
import { IdeaCard } from '../types'

interface ModalContextType {
  // Modal states
  showAddModal: boolean
  showAIModal: boolean
  showAdminPortal: boolean

  // Editing states
  editingIdea: IdeaCard | null
  activeId: string | null

  // Modal actions
  setShowAddModal: (show: boolean) => void
  setShowAIModal: (show: boolean) => void
  setShowAdminPortal: (show: boolean) => void
  setEditingIdea: (idea: IdeaCard | null) => void
  setActiveId: (id: string | null) => void

  // Convenience actions
  openAddModal: () => void
  closeAddModal: () => void
  openAIModal: () => void
  closeAIModal: () => void
  openAdminPortal: () => void
  closeAdminPortal: () => void
  clearEditingIdea: () => void
  clearActiveId: () => void
  closeAllModals: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

interface ModalProviderProps {
  children: ReactNode
}

export function ModalProvider({ children }: ModalProviderProps) {
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [showAdminPortal, setShowAdminPortal] = useState(false)

  // Editing states
  const [editingIdea, setEditingIdea] = useState<IdeaCard | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Convenience actions
  const openAddModal = () => setShowAddModal(true)
  const closeAddModal = () => setShowAddModal(false)
  const openAIModal = () => setShowAIModal(true)
  const closeAIModal = () => setShowAIModal(false)
  const openAdminPortal = () => setShowAdminPortal(true)
  const closeAdminPortal = () => setShowAdminPortal(false)
  const clearEditingIdea = () => setEditingIdea(null)
  const clearActiveId = () => setActiveId(null)

  const closeAllModals = () => {
    setShowAddModal(false)
    setShowAIModal(false)
    setShowAdminPortal(false)
    setEditingIdea(null)
    setActiveId(null)
  }

  // PERFORMANCE OPTIMIZATION: Memoize context value to prevent unnecessary re-renders
  // Only recreate when state actually changes, not on every parent render
  const value = useMemo(() => ({
    // States
    showAddModal,
    showAIModal,
    showAdminPortal,
    editingIdea,
    activeId,

    // Setters
    setShowAddModal,
    setShowAIModal,
    setShowAdminPortal,
    setEditingIdea,
    setActiveId,

    // Convenience actions
    openAddModal,
    closeAddModal,
    openAIModal,
    closeAIModal,
    openAdminPortal,
    closeAdminPortal,
    clearEditingIdea,
    clearActiveId,
    closeAllModals
  }), [
    showAddModal,
    showAIModal,
    showAdminPortal,
    editingIdea,
    activeId,
    openAddModal,
    closeAddModal,
    openAIModal,
    closeAIModal,
    openAdminPortal,
    closeAdminPortal,
    clearEditingIdea,
    clearActiveId,
    closeAllModals
  ])

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const context = useContext(ModalContext)
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}