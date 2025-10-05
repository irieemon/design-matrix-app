import React from 'react'

interface LoadingSpinnerProps {
  /** Size variant for the spinner */
  size?: 'sm' | 'base' | 'lg'
  /** Color variant for the spinner */
  variant?: 'primary' | 'success' | 'error'
  /** Optional CSS class name */
  className?: string
  /** Accessible label for screen readers */
  'aria-label'?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'base',
  variant = 'primary',
  className = '',
  'aria-label': ariaLabel = 'Loading'
}) => {
  const sizeClass = size === 'sm' ? 'spinner--sm' : size === 'lg' ? 'spinner--lg' : ''
  const variantClass = variant === 'success' ? 'spinner--success' : variant === 'error' ? 'spinner--error' : 'spinner--primary'

  return (
    <div
      className={`spinner ${sizeClass} ${variantClass} ${className}`}
      role="status"
      aria-label={ariaLabel}
    />
  )
}

export default LoadingSpinner