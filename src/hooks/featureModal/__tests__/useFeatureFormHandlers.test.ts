import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeatureFormHandlers } from '../useFeatureFormHandlers'
import type { FeatureDetail } from '../useFeatureModalState'

describe('useFeatureFormHandlers', () => {
  const mockFeature: FeatureDetail = {
    id: 'test-feature-1',
    title: 'Test Feature',
    description: 'Test description',
    startMonth: 0,
    duration: 3,
    team: 'PLATFORM',
    priority: 'high',
    status: 'planned',
    userStories: ['Story 1'],
    deliverables: ['Deliverable 1'],
    relatedIdeas: [],
    risks: [],
    successCriteria: []
  }

  let mockOnSave: ReturnType<typeof vi.fn>
  let mockOnClose: ReturnType<typeof vi.fn>
  let mockOnDelete: ReturnType<typeof vi.fn>
  let mockSetEditedFeature: ReturnType<typeof vi.fn>
  let mockSetEditMode: ReturnType<typeof vi.fn>
  let mockSetShowDeleteConfirm: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnSave = vi.fn()
    mockOnClose = vi.fn()
    mockOnDelete = vi.fn()
    mockSetEditedFeature = vi.fn()
    mockSetEditMode = vi.fn()
    mockSetShowDeleteConfirm = vi.fn()
  })

  describe('Validation - isValidForSave', () => {
    test('returns true when feature has valid title', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      expect(result.current.isValidForSave).toBe(true)
    })

    test('returns false when feature is null', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: null,
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      expect(result.current.isValidForSave).toBe(false)
    })

    test('returns false when title is empty string', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: { ...mockFeature, title: '' },
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      expect(result.current.isValidForSave).toBe(false)
    })

    test('returns false when title is only whitespace', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: { ...mockFeature, title: '   ' },
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      expect(result.current.isValidForSave).toBe(false)
    })

    test('returns true when title has leading/trailing whitespace but content', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: { ...mockFeature, title: '  Valid Title  ' },
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      expect(result.current.isValidForSave).toBe(true)
    })
  })

  describe('handleSave', () => {
    test('calls onSave and closes modal when feature is valid', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.handleSave()
      })

      expect(mockOnSave).toHaveBeenCalledWith(mockFeature)
      expect(mockSetEditMode).toHaveBeenCalledWith(false)
      expect(mockOnClose).toHaveBeenCalled()
    })

    test('does not call onSave when feature is invalid', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: { ...mockFeature, title: '' },
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.handleSave()
      })

      expect(mockOnSave).not.toHaveBeenCalled()
      expect(mockSetEditMode).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    test('does not call onSave when editedFeature is null', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: null,
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.handleSave()
      })

      expect(mockOnSave).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('handleCancel', () => {
    test('closes modal in create mode', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'create',
          feature: null,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.handleCancel()
      })

      expect(mockOnClose).toHaveBeenCalled()
      expect(mockSetEditedFeature).not.toHaveBeenCalled()
      expect(mockSetEditMode).not.toHaveBeenCalled()
    })

    test('resets to original feature in edit mode', () => {
      const editedFeature = { ...mockFeature, title: 'Modified Title' }

      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature,
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.handleCancel()
      })

      expect(mockSetEditedFeature).toHaveBeenCalledWith(mockFeature)
      expect(mockSetEditMode).toHaveBeenCalledWith(false)
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    test('resets to null when no original feature in edit mode', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'edit',
          feature: null,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.handleCancel()
      })

      expect(mockSetEditedFeature).toHaveBeenCalledWith(null)
      expect(mockSetEditMode).toHaveBeenCalledWith(false)
    })

    test('resets to original feature in view mode', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'view',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.handleCancel()
      })

      expect(mockSetEditedFeature).toHaveBeenCalledWith(mockFeature)
      expect(mockSetEditMode).toHaveBeenCalledWith(false)
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('handleDelete', () => {
    test('shows delete confirmation dialog', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.handleDelete()
      })

      expect(mockSetShowDeleteConfirm).toHaveBeenCalledWith(true)
      expect(mockOnDelete).not.toHaveBeenCalled()
    })
  })

  describe('confirmDelete', () => {
    test('calls onDelete and closes modal when feature exists', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.confirmDelete()
      })

      expect(mockOnDelete).toHaveBeenCalledWith(mockFeature.id)
      expect(mockOnClose).toHaveBeenCalled()
      expect(mockSetShowDeleteConfirm).toHaveBeenCalledWith(false)
    })

    test('does not call onDelete when feature is null', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'edit',
          feature: null,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.confirmDelete()
      })

      expect(mockOnDelete).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
      expect(mockSetShowDeleteConfirm).toHaveBeenCalledWith(false)
    })

    test('does not call onDelete when onDelete callback is undefined', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: undefined,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.confirmDelete()
      })

      expect(mockOnClose).not.toHaveBeenCalled()
      expect(mockSetShowDeleteConfirm).toHaveBeenCalledWith(false)
    })

    test('always closes delete confirmation dialog', () => {
      const { result } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'edit',
          feature: null,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      act(() => {
        result.current.confirmDelete()
      })

      expect(mockSetShowDeleteConfirm).toHaveBeenCalledWith(false)
    })
  })

  describe('Callback stability', () => {
    test('handleSave callback is stable when dependencies do not change', () => {
      const { result, rerender } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      const firstCallback = result.current.handleSave

      rerender()

      expect(result.current.handleSave).toBe(firstCallback)
    })

    test('handleCancel callback is stable when dependencies do not change', () => {
      const { result, rerender } = renderHook(() =>
        useFeatureFormHandlers({
          editedFeature: mockFeature,
          mode: 'edit',
          feature: mockFeature,
          onSave: mockOnSave,
          onClose: mockOnClose,
          onDelete: mockOnDelete,
          setEditedFeature: mockSetEditedFeature,
          setEditMode: mockSetEditMode,
          setShowDeleteConfirm: mockSetShowDeleteConfirm
        })
      )

      const firstCallback = result.current.handleCancel

      rerender()

      expect(result.current.handleCancel).toBe(firstCallback)
    })
  })
})