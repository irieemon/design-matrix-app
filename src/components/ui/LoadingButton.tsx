import React from 'react'
import LoadingSpinner from './LoadingSpinner'

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether the button is in loading state */
  loading?: boolean
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  /** Button size */
  size?: 'sm' | 'base' | 'lg'
  /** Children content */
  children: React.ReactNode
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  variant = 'primary',
  size = 'base',
  className = '',
  children,
  disabled,
  ...props
}) => {
  const buttonClasses = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    loading ? 'btn--loading' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      {...props}
      className={buttonClasses}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" variant={variant === 'primary' ? 'primary' : 'primary'} />
          <span className="btn__text sr-only">{children}</span>
        </>
      ) : (
        <span className="btn__text">{children}</span>
      )}
    </button>
  )
}

export default LoadingButton