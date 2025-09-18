import React from 'react'
import { Loader, Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'spinner' | 'dots' | 'pulse'
  color?: 'primary' | 'secondary' | 'white' | 'gray'
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
}

const colorClasses = {
  primary: 'text-blue-600',
  secondary: 'text-gray-600',
  white: 'text-white',
  gray: 'text-gray-400'
}

/**
 * Reusable loading spinner component with multiple variants and sizes
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'spinner',
  color = 'primary',
  className = ''
}) => {
  const baseClasses = `animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`

  if (variant === 'spinner') {
    return <Loader2 className={baseClasses} />
  }

  if (variant === 'dots') {
    return (
      <div className={`flex space-x-1 ${className}`}>
        <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-pulse`}></div>
        <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-pulse delay-75`}></div>
        <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-pulse delay-150`}></div>
      </div>
    )
  }

  if (variant === 'pulse') {
    return (
      <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-pulse ${className}`}></div>
    )
  }

  return <Loader className={baseClasses} />
}

interface LoadingOverlayProps {
  show: boolean
  text?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'spinner' | 'dots' | 'pulse'
  className?: string
}

/**
 * Full-screen or container loading overlay
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  show,
  text = 'Loading...',
  size = 'lg',
  variant = 'spinner',
  className = ''
}) => {
  if (!show) return null

  return (
    <div className={`absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 ${className}`}>
      <div className="flex flex-col items-center space-y-3">
        <LoadingSpinner size={size} variant={variant} color="primary" />
        {text && (
          <p className="text-sm text-gray-600 font-medium">{text}</p>
        )}
      </div>
    </div>
  )
}

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean
  loadingText?: string
  spinnerSize?: 'sm' | 'md'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  children: React.ReactNode
}

/**
 * Button component with integrated loading state
 */
export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading,
  loadingText,
  spinnerSize = 'sm',
  variant = 'primary',
  children,
  disabled,
  className = '',
  ...props
}) => {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white border-transparent',
    outline: 'bg-transparent border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost: 'bg-transparent border-transparent text-gray-700 hover:bg-gray-100'
  }

  const baseClasses = `
    inline-flex items-center justify-center
    px-4 py-2 border rounded-md
    text-sm font-medium
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    ${variantClasses[variant]}
    ${className}
  `

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={baseClasses}
    >
      {loading && (
        <LoadingSpinner
          size={spinnerSize}
          color={variant === 'outline' || variant === 'ghost' ? 'gray' : 'white'}
          className="mr-2"
        />
      )}
      {loading ? loadingText || 'Loading...' : children}
    </button>
  )
}

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  animation?: 'pulse' | 'wave' | 'none'
}

/**
 * Skeleton loading placeholder component
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-gray-200'
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded'
  }
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse', // Could be enhanced with a wave animation
    none: ''
  }

  return (
    <div
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${className}
      `}
    />
  )
}

/**
 * Collection of skeleton loading components for common layouts
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-4 border rounded-lg ${className}`}>
    <Skeleton className="h-6 w-3/4 mb-3" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-2/3" />
  </div>
)

export const SkeletonList: React.FC<{ items?: number; className?: string }> = ({
  items = 3,
  className = ''
}) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center space-x-3">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
)