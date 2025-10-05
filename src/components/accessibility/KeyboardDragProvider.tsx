/**
 * Keyboard Drag Provider for Accessible Drag and Drop
 *
 * Provides keyboard-accessible drag and drop functionality
 * as an alternative to mouse-based drag operations.
 * Complies with WCAG 2.1 AA guidelines for keyboard accessibility.
 */

import React, { createContext, useContext, useCallback, useState, useRef } from 'react'
import { useAriaLiveRegion } from '../../hooks/useAccessibility'
import { keyboardUtils } from '../../utils/accessibility'

interface Position {
  x: number
  y: number
}

interface DraggableItem {
  id: string
  position: Position
  label: string
}

interface KeyboardDragContextType {
  selectedItem: string | null
  isKeyboardMode: boolean
  selectItem: (id: string, item: DraggableItem) => void
  moveItem: (direction: 'up' | 'down' | 'left' | 'right', distance?: number) => void
  dropItem: () => void
  cancelDrag: () => void
  getItemPosition: (id: string) => Position | null
}

const KeyboardDragContext = createContext<KeyboardDragContextType | null>(null)

export const useKeyboardDrag = () => {
  const context = useContext(KeyboardDragContext)
  if (!context) {
    throw new Error('useKeyboardDrag must be used within a KeyboardDragProvider')
  }
  return context
}

interface KeyboardDragProviderProps {
  children: React.ReactNode
  onDragEnd?: (itemId: string, newPosition: Position) => void
  gridSize?: number
  containerBounds?: {
    left: number
    top: number
    right: number
    bottom: number
  }
}

export const KeyboardDragProvider: React.FC<KeyboardDragProviderProps> = ({
  children,
  onDragEnd,
  gridSize = 10,
  containerBounds = { left: 0, top: 0, right: 600, bottom: 600 }
}) => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [isKeyboardMode, setIsKeyboardMode] = useState(false)
  const [items, setItems] = useState<Map<string, DraggableItem>>(new Map())
  const [dragStartPosition, setDragStartPosition] = useState<Position | null>(null)
  const { announce } = useAriaLiveRegion()

  const selectItem = useCallback((id: string, item: DraggableItem) => {
    setSelectedItem(id)
    setIsKeyboardMode(true)
    setItems(prev => new Map(prev.set(id, item)))
    setDragStartPosition(item.position)

    announce(`Selected ${item.label} for keyboard dragging. Use arrow keys to move, Enter to drop, Escape to cancel.`)
  }, [announce])

  const moveItem = useCallback((direction: 'up' | 'down' | 'left' | 'right', distance = gridSize) => {
    if (!selectedItem) return

    const item = items.get(selectedItem)
    if (!item) return

    let newPosition = { ...item.position }

    switch (direction) {
      case 'up':
        newPosition.y = Math.max(containerBounds.top, newPosition.y - distance)
        break
      case 'down':
        newPosition.y = Math.min(containerBounds.bottom, newPosition.y + distance)
        break
      case 'left':
        newPosition.x = Math.max(containerBounds.left, newPosition.x - distance)
        break
      case 'right':
        newPosition.x = Math.min(containerBounds.right, newPosition.x + distance)
        break
    }

    // Update item position
    const updatedItem = { ...item, position: newPosition }
    setItems(prev => new Map(prev.set(selectedItem, updatedItem)))

    // Announce the movement
    announce(`Moved ${item.label} ${direction}. Position: ${Math.round(newPosition.x)}, ${Math.round(newPosition.y)}`)
  }, [selectedItem, items, gridSize, containerBounds, announce])

  const dropItem = useCallback(() => {
    if (!selectedItem) return

    const item = items.get(selectedItem)
    if (!item) return

    // Call the onDragEnd callback with the final position
    if (onDragEnd) {
      onDragEnd(selectedItem, item.position)
    }

    announce(`Dropped ${item.label} at position ${Math.round(item.position.x)}, ${Math.round(item.position.y)}`)

    // Reset drag state
    setSelectedItem(null)
    setIsKeyboardMode(false)
    setDragStartPosition(null)
  }, [selectedItem, items, onDragEnd, announce])

  const cancelDrag = useCallback(() => {
    if (!selectedItem) return

    const item = items.get(selectedItem)
    if (!item || !dragStartPosition) return

    // Restore original position
    const restoredItem = { ...item, position: dragStartPosition }
    setItems(prev => new Map(prev.set(selectedItem, restoredItem)))

    announce(`Cancelled dragging ${item.label}. Restored to original position.`)

    // Reset drag state
    setSelectedItem(null)
    setIsKeyboardMode(false)
    setDragStartPosition(null)
  }, [selectedItem, items, dragStartPosition, announce])

  const getItemPosition = useCallback((id: string): Position | null => {
    const item = items.get(id)
    return item ? item.position : null
  }, [items])

  const contextValue: KeyboardDragContextType = {
    selectedItem,
    isKeyboardMode,
    selectItem,
    moveItem,
    dropItem,
    cancelDrag,
    getItemPosition
  }

  return (
    <KeyboardDragContext.Provider value={contextValue}>
      {children}
    </KeyboardDragContext.Provider>
  )
}

/**
 * Hook for making an element keyboard draggable
 */
export const useKeyboardDraggable = (
  id: string,
  label: string,
  position: Position,
  options: {
    disabled?: boolean
    onDragStart?: () => void
    onDragEnd?: () => void
  } = {}
) => {
  const { disabled = false, onDragStart, onDragEnd } = options
  const { selectItem, selectedItem, isKeyboardMode, moveItem, dropItem, cancelDrag } = useKeyboardDrag()
  const elementRef = useRef<HTMLElement>(null)

  const isSelected = selectedItem === id
  const isDragging = isSelected && isKeyboardMode

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return

    // Select item for dragging on Space or Enter
    if (keyboardUtils.isActionKey(e) && !isSelected) {
      e.preventDefault()
      selectItem(id, { id, position, label })
      onDragStart?.()
      return
    }

    // Handle drag operations when selected
    if (isSelected) {
      const direction = keyboardUtils.getArrowDirection(e)
      if (direction) {
        e.preventDefault()

        // Large movement with Shift key
        const distance = e.shiftKey ? 50 : 10
        moveItem(direction, distance)
        return
      }

      // Drop on Enter
      if (e.key === 'Enter') {
        e.preventDefault()
        dropItem()
        onDragEnd?.()
        return
      }

      // Cancel on Escape
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelDrag()
        onDragEnd?.()
        return
      }
    }
  }, [
    disabled,
    isSelected,
    id,
    position,
    label,
    selectItem,
    moveItem,
    dropItem,
    cancelDrag,
    onDragStart,
    onDragEnd
  ])

  const handleClick = useCallback(() => {
    if (disabled || isSelected) return

    selectItem(id, { id, position, label })
    onDragStart?.()
  }, [disabled, isSelected, id, position, label, selectItem, onDragStart])

  // Focus management
  const handleFocus = useCallback(() => {
    if (elementRef.current && isSelected) {
      elementRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [isSelected])

  return {
    ref: elementRef,
    isDragging,
    isSelected,
    handleKeyDown,
    handleClick,
    handleFocus,
    ariaProps: {
      'aria-grabbed': isDragging,
      'aria-describedby': `${id}-drag-instructions`,
      role: 'button',
      tabIndex: disabled ? -1 : 0
    }
  }
}

/**
 * Component for providing drag instructions to screen readers
 */
export const DragInstructions: React.FC<{ itemId: string }> = ({ itemId }) => {
  return (
    <div id={`${itemId}-drag-instructions`} className="sr-only">
      Press Space or Enter to select for dragging. Use arrow keys to move, Shift+arrow for larger movements.
      Press Enter to drop, Escape to cancel.
    </div>
  )
}