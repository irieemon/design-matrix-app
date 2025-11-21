/**
 * Enhanced Button Component
 *
 * S-tier SaaS dashboard button implementation with comprehensive state management,
 * animations, accessibility, and performance optimization.
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useComponentState } from '../../hooks/useComponentState';
import { useComponentStateContext } from '../../contexts/ComponentStateProvider';
import {
  ComponentVariant,
  ComponentState,
  ComponentSize
} from '../../types/componentState';
import LoadingSpinner from './LoadingSpinner';
import { logger } from '../../utils/logger';

// ✅ HOOKS FIX: Custom hook to safely access optional context
// This allows unconditional hook call while handling missing provider
function useOptionalComponentStateContext() {
  try {
    return useComponentStateContext();
  } catch {
    // Context provider not available, return null
    return null;
  }
}

// Enhanced variant system (6 variants)
export type ButtonVariant = ComponentVariant;

// Enhanced state system (6 states including new pending and success)
export type ButtonState = ComponentState;

// Enhanced size system (5 sizes)
export type ButtonSize = ComponentSize;

// Button-specific props extending HTML button attributes
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  /** Visual variant following S-tier design patterns */
  variant?: ButtonVariant;
  /** Button state for comprehensive state management */
  state?: ButtonState;
  /** Size variant for responsive design */
  size?: ButtonSize;
  /** Enable enhanced animations */
  animated?: boolean;
  /** Animation speed configuration */
  animationSpeed?: 'fast' | 'normal' | 'slow';
  /** Loading text override */
  loadingText?: string;
  /** Error message for error state */
  errorMessage?: string;
  /** Success message for success state */
  successMessage?: string;
  /** Auto-dismiss success state after duration (ms) */
  successDismissAfter?: number;
  /** Auto-dismiss error state after duration (ms) */
  errorDismissAfter?: number;
  /** Execute async action with automatic state management */
  onAsyncAction?: () => Promise<void>;
  /** Callback when state changes */
  onStateChange?: (state: ButtonState) => void;
  /** Icon element to display before text */
  icon?: React.ReactNode;
  /** Icon element to display after text */
  iconAfter?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Button children content */
  children?: React.ReactNode;
}

// Button component reference for imperative operations
export interface ButtonRef {
  /** Get current button state */
  getState: () => ButtonState;
  /** Set button state programmatically */
  setState: (state: ButtonState) => void;
  /** Trigger loading state */
  setLoading: () => void;
  /** Trigger success state with optional message */
  setSuccess: (message?: string) => void;
  /** Trigger error state with optional message */
  setError: (message?: string) => void;
  /** Clear error/success and return to idle */
  reset: () => void;
  /** Execute async action with state management */
  executeAction: (action: () => Promise<void>) => Promise<void>;
}

/**
 * Enhanced Button Component with S-tier SaaS dashboard patterns
 */
export const Button = forwardRef<ButtonRef, ButtonProps>(({
  variant = 'primary',
  state: initialState = 'idle',
  size = 'md',
  animated = true,
  animationSpeed = 'normal',
  loadingText,
  errorMessage,
  successMessage,
  successDismissAfter = 3000,
  errorDismissAfter = 5000,
  onAsyncAction,
  onStateChange,
  icon,
  iconAfter,
  fullWidth = false,
  className = '',
  disabled,
  onClick,
  children,
  ...props
}, ref) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize component state with enhanced configuration
  const componentState = useComponentState({
    initialConfig: {
      variant,
      state: initialState,
      size,
      animated,
      animationSpeed,
      loadingText,
      errorMessage,
      successMessage
    },
    autoErrorRecovery: true,
    errorRecoveryTimeout: errorDismissAfter
  });

  // ✅ HOOKS FIX: Always call hook unconditionally (Rules of Hooks requirement)
  // Optional context - will be null if provider not available
  const contextState = useOptionalComponentStateContext();

  // Register element for animations
  useEffect(() => {
    if (buttonRef.current && contextState) {
      contextState.setActiveElement(buttonRef.current);
    }
  }, [contextState]);

  // Handle state changes and notifications
  useEffect(() => {
    if (onStateChange) {
      onStateChange(componentState.state);
    }

    // Auto-dismiss success state
    if (componentState.state === 'success' && successDismissAfter > 0) {
      dismissTimeoutRef.current = setTimeout(() => {
        componentState.setState('idle');
      }, successDismissAfter);
    }

    // Clear any existing timeouts when state changes
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [componentState.state, onStateChange, successDismissAfter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  // Handle button click with enhanced state management
  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (componentState.isDisabled || componentState.isLoading) {
      event.preventDefault();
      return;
    }

    try {
      // Execute async action if provided
      if (onAsyncAction) {
        await componentState.executeAction(onAsyncAction);
      }

      // Call original onClick handler
      if (onClick && !componentState.isDisabled) {
        onClick(event);
      }
    } catch (_error) {
      logger.error('Button action failed:', error);
      componentState.setError(error instanceof Error ? error.message : 'Action failed');
    }
  };

  // Handle hover animations
  const handleMouseEnter = () => {
    if (buttonRef.current && contextState && !componentState.isDisabled) {
      contextState.applyHoverAnimation(buttonRef.current, true);
    }
  };

  const handleMouseLeave = () => {
    if (buttonRef.current && contextState && !componentState.isDisabled) {
      contextState.applyHoverAnimation(buttonRef.current, false);
    }
  };

  // Imperative API
  useImperativeHandle(ref, () => ({
    getState: () => componentState.state,
    setState: (newState: ButtonState) => {
      if (contextState) {
        contextState.setState(newState, buttonRef.current || undefined);
      } else {
        componentState.setState(newState);
      }
    },
    setLoading: () => {
      if (contextState) {
        contextState.setState('loading', buttonRef.current || undefined);
      } else {
        componentState.setState('loading');
      }
    },
    setSuccess: (message?: string) => componentState.setSuccess(message),
    setError: (message?: string) => componentState.setError(message),
    reset: () => componentState.reset(),
    executeAction: async (action: () => Promise<void>) => {
      return componentState.executeAction(action);
    }
  }), [componentState, contextState]);

  // Compute final className with state-aware classes
  const computedClassName = [
    'btn',
    componentState.className, // Includes variant, size, and state classes
    fullWidth ? 'btn--full-width' : '',
    className
  ].filter(Boolean).join(' ');

  // Determine if button should be disabled
  const isDisabled = disabled ||
                     componentState.isDisabled ||
                     componentState.isLoading;

  // Render appropriate content based on state
  const renderContent = () => {
    if (componentState.isLoading) {
      return (
        <div className="btn__content btn__content--loading">
          <LoadingSpinner
            size={size === 'xs' || size === 'sm' ? 'sm' : size === 'lg' || size === 'xl' ? 'lg' : 'base'}
            variant="primary"
          />
          {loadingText && (
            <span className="btn__loading-text">{loadingText}</span>
          )}
        </div>
      );
    }

    if (componentState.hasError && errorMessage) {
      return (
        <div className="btn__content btn__content--error">
          <span className="btn__error-message">{errorMessage}</span>
        </div>
      );
    }

    if (componentState.isSuccess && successMessage) {
      return (
        <div className="btn__content btn__content--success">
          <span className="btn__success-message">{successMessage}</span>
        </div>
      );
    }

    // Default content
    return (
      <div className="btn__content">
        {icon && <span className="btn__icon btn__icon--before">{icon}</span>}
        <span className="btn__text">{children}</span>
        {iconAfter && <span className="btn__icon btn__icon--after">{iconAfter}</span>}
      </div>
    );
  };

  return (
    <button
      ref={buttonRef}
      className={computedClassName}
      disabled={isDisabled}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={props['aria-label'] || (typeof children === 'string' ? children : undefined)}
      aria-disabled={isDisabled}
      aria-busy={componentState.isLoading}
      data-state={componentState.state}
      data-variant={componentState.variant}
      data-size={componentState.size}
      {...props}
    >
      {renderContent()}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;