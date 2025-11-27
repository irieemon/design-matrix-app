import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { LoadingOverlay } from './LoadingSpinner'
import { useAccessibleId } from '../../hooks/useAccessibility'
import { getAccessibleModalProps } from '../../utils/accessibility'
import { Button } from '../ui/Button'

interface BaseModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
  closeOnBackdropClick?: boolean
  closeOnEscape?: boolean
  className?: string
  loading?: boolean
  loadingText?: string
  /** Custom portal target (defaults to document.body). Use this for fullscreen contexts. */
  portalTarget?: HTMLElement
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl mx-4'
}

/**
 * Base modal component with consistent styling and behavior
 */
export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className = '',
  loading = false,
  loadingText,
  portalTarget
}) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const titleId = useAccessibleId('modal-title')
  const contentId = useAccessibleId('modal-content')

  // Focus trap for accessibility - currently unused in this implementation
  // const focusTrapRef = useFocusTrap(isOpen)

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape, onClose])

  // Combine refs for focus trap and modal
  const combinedRef = React.useCallback((node: HTMLDivElement | null) => {
    // Store the node reference for focus management
    Object.assign(modalRef, { current: node })
    // Focus trap ref is managed internally
  }, [])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 modal-overlay-container"
      onClick={handleBackdropClick}
      style={{ zIndex: 9999, pointerEvents: 'none' }}
    >
      {/* Backdrop */}
      <div className="lux-modal-backdrop" style={{ pointerEvents: 'auto' }} />

      {/* Modal */}
      <div
        ref={combinedRef}
        className={`
          lux-modal
          ${sizeClasses[size]}
          w-full
          max-h-[90vh] overflow-hidden
          ${className}
        `}
        style={{ pointerEvents: 'auto' }}
        {...getAccessibleModalProps(title ? titleId : undefined, contentId, true)}
      >
        {/* Loading overlay */}
        <LoadingOverlay show={loading} text={loadingText} />

        {/* Header */}
        {(title || showCloseButton) && (
          <header className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--hairline-default)' }}>
            {title && (
              <h2 id={titleId} className="text-xl font-semibold" style={{ color: 'var(--graphite-900)' }}>
                {title}
              </h2>
            )}
            {showCloseButton && (
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                icon={<X className="w-5 h-5" aria-hidden="true" />}
                aria-label="Close modal"
                className="!p-1 rounded-full"
              />
            )}
          </header>
        )}

        {/* Content */}
        <div id={contentId} className="overflow-y-auto max-h-[calc(90vh-4rem)]" role="document">
          {children}
        </div>
      </div>
    </div>
  )

  // Render modal content to portal target (defaults to document.body)
  // CRITICAL: For fullscreen mode, portal target must be the fullscreen container
  return createPortal(modalContent, portalTarget || document.body)
}

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'sapphire'
  loading?: boolean
}

/**
 * Confirmation modal for destructive or important actions
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false
}) => {
  const messageId = useAccessibleId('confirm-message')
  const variantStyles = {
    danger: {
      buttonVariant: 'danger' as const,
      icon: 'text-red-600'
    },
    warning: {
      buttonVariant: 'secondary' as const,
      icon: 'text-yellow-600'
    },
    info: {
      buttonVariant: 'sapphire' as const,
      icon: 'text-blue-600'
    },
    sapphire: {
      buttonVariant: 'sapphire' as const,
      icon: 'text-sapphire-600'
    }
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      loading={loading}
      title={title}
    >
      <div className="p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center`} style={{ backgroundColor: 'var(--canvas-secondary)' }} role="img" aria-label={`${variant} icon`}>
              <X className={`w-6 h-6 ${variantStyles[variant].icon}`} aria-hidden="true" />
            </div>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--graphite-900)' }}>
              {title}
            </h3>
            <p id={messageId} className="text-sm mb-6" style={{ color: 'var(--graphite-500)' }}>
              {message}
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={onConfirm}
                disabled={loading}
                variant={variantStyles[variant].buttonVariant}
                size="sm"
                state={loading ? 'loading' : 'idle'}
                loadingText="Processing..."
                aria-describedby={messageId}
              >
                {confirmText}
              </Button>
              <Button
                onClick={onClose}
                disabled={loading}
                variant="secondary"
                size="sm"
                aria-label={cancelText}
              >
                {cancelText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

interface FormModalProps extends Omit<BaseModalProps, 'children'> {
  onSubmit: (e: React.FormEvent) => void
  submitText?: string
  cancelText?: string
  submitDisabled?: boolean
  submitVariant?: 'primary' | 'secondary' | 'danger' | 'sapphire'
  showFooter?: boolean
  children: React.ReactNode
}

/**
 * Modal specifically designed for forms with submit/cancel actions
 */
export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  children,
  submitText = 'Save',
  cancelText = 'Cancel',
  submitDisabled = false,
  submitVariant = 'primary',
  showFooter = true,
  loading = false,
  ...modalProps
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(e)
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      loading={loading}
      {...modalProps}
    >
      <form onSubmit={handleSubmit}>
        <div className="p-6">
          {children}
        </div>

        {showFooter && (
          <div className="px-6 py-4 border-t flex justify-end space-x-3" style={{ backgroundColor: 'var(--canvas-secondary)', borderColor: 'var(--hairline-default)' }}>
            <Button
              type="button"
              onClick={onClose}
              disabled={loading}
              variant="secondary"
              size="sm"
            >
              {cancelText}
            </Button>
            <Button
              type="submit"
              disabled={submitDisabled || loading}
              variant={submitVariant}
              size="sm"
              state={loading ? 'loading' : 'idle'}
              loadingText="Saving..."
            >
              {submitText}
            </Button>
          </div>
        )}
      </form>
    </BaseModal>
  )
}

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  position?: 'left' | 'right'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Slide-out drawer component (alternative to modal)
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-80',
    md: 'w-96',
    lg: 'w-1/2'
  }

  const positionClasses = {
    left: 'left-0',
    right: 'right-0'
  }

  const slideClasses = {
    left: isOpen ? 'translate-x-0' : '-translate-x-full',
    right: isOpen ? 'translate-x-0' : 'translate-x-full'
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="lux-modal-backdrop"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`
          absolute top-0 h-full shadow-xl
          ${sizeClasses[size]}
          ${positionClasses[position]}
          transform ease-in-out
          ${slideClasses[position]}
          ${className}
        `}
        style={{
          backgroundColor: 'var(--surface-primary)',
          transitionProperty: 'transform',
          transitionDuration: 'var(--duration-moderate)',
          transitionTimingFunction: 'var(--easing-glide)'
        }}
      >
        {title && (
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--hairline-default)' }}>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--graphite-900)' }}>{title}</h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              icon={<X className="w-5 h-5" aria-hidden="true" />}
              aria-label="Close drawer"
              className="!p-1 rounded-full"
            />
          </div>
        )}

        <div className="overflow-y-auto h-full">
          {children}
        </div>
      </div>
    </div>
  )
}