/**
 * BottomSheet — mobile-native bottom-sheet modal.
 *
 * On mobile (useBreakpoint().isMobile), slides up from the bottom of the
 * viewport, supports swipe-down-to-close, and caps height at 85vh.
 * On desktop, falls through to BaseModal for a centered dialog.
 */
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { BaseModal } from './Modal'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

const SWIPE_DISMISS_THRESHOLD_PX = 80

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const { isMobile } = useBreakpoint()
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartYRef = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)

  // Escape key support (mobile path; BaseModal handles it on desktop)
  useEffect(() => {
    if (!isOpen || !isMobile) return
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, isMobile, onClose])

  // Lock body scroll while open (mobile path)
  useEffect(() => {
    if (!isMobile) return
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, isMobile])

  // Desktop path: re-use existing centered modal
  if (!isMobile) {
    return (
      <BaseModal isOpen={isOpen} onClose={onClose} title={title}>
        <div className="p-6">{children}</div>
      </BaseModal>
    )
  }

  if (!isOpen) return null

  const handleTouchStart = (e: React.TouchEvent): void => {
    touchStartYRef.current = e.touches[0].clientY
    setDragOffset(0)
  }

  const handleTouchMove = (e: React.TouchEvent): void => {
    if (touchStartYRef.current === null) return
    const delta = e.touches[0].clientY - touchStartYRef.current
    if (delta > 0) setDragOffset(delta)
  }

  const handleTouchEnd = (): void => {
    if (dragOffset > SWIPE_DISMISS_THRESHOLD_PX) {
      onClose()
    }
    touchStartYRef.current = null
    setDragOffset(0)
  }

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) onClose()
  }

  const sheet = (
    <div
      onClick={handleBackdropClick}
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Bottom sheet'}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="fixed inset-x-0 bottom-0 rounded-t-2xl bg-white shadow-xl transition-transform duration-200"
        style={{
          maxHeight: '85vh',
          overflowY: 'auto',
          transform: `translateY(${dragOffset}px)`,
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="w-10 h-1.5 rounded-full bg-neutral-300" />
        </div>

        {(title || true) && (
          <header className="flex items-center justify-between px-4 pb-2">
            {title ? (
              <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close bottom sheet"
              className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </header>
        )}

        <div className="px-4 pb-6">{children}</div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}

export default BottomSheet
