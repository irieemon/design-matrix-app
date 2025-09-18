import { useCallback } from 'react'
import type { FeatureDetail } from './useFeatureModalState'

interface UseFeatureFormHandlersParams {
  editedFeature: FeatureDetail | null
  mode: 'view' | 'edit' | 'create'
  feature: FeatureDetail | null
  onSave: (feature: FeatureDetail) => void
  onClose: () => void
  onDelete?: (featureId: string) => void
  setEditedFeature: React.Dispatch<React.SetStateAction<FeatureDetail | null>>
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>
  setShowDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>
}

interface UseFeatureFormHandlersReturn {
  // Form handlers
  handleSave: () => void
  handleCancel: () => void
  handleDelete: () => void
  confirmDelete: () => void

  // Validation
  isValidForSave: boolean
}

export const useFeatureFormHandlers = ({
  editedFeature,
  mode,
  feature,
  onSave,
  onClose,
  onDelete,
  setEditedFeature,
  setEditMode,
  setShowDeleteConfirm
}: UseFeatureFormHandlersParams): UseFeatureFormHandlersReturn => {

  // Validation logic
  const isValidForSave = Boolean(
    editedFeature &&
    editedFeature.title.trim() !== ''
  )

  const handleSave = useCallback(() => {
    if (editedFeature && isValidForSave) {
      onSave(editedFeature)
      setEditMode(false)
      onClose()
    }
  }, [editedFeature, isValidForSave, onSave, setEditMode, onClose])

  const handleCancel = useCallback(() => {
    if (mode === 'create') {
      onClose()
    } else {
      // Reset to original feature data
      setEditedFeature(feature ? { ...feature } : null)
      setEditMode(false)
    }
  }, [mode, onClose, setEditedFeature, feature, setEditMode])

  const handleDelete = useCallback(() => {
    setShowDeleteConfirm(true)
  }, [setShowDeleteConfirm])

  const confirmDelete = useCallback(() => {
    if (feature && onDelete) {
      onDelete(feature.id)
      onClose()
    }
    setShowDeleteConfirm(false)
  }, [feature, onDelete, onClose, setShowDeleteConfirm])

  return {
    // Form handlers
    handleSave,
    handleCancel,
    handleDelete,
    confirmDelete,

    // Validation
    isValidForSave
  }
}

export type { UseFeatureFormHandlersParams, UseFeatureFormHandlersReturn }