/**
 * Enhanced Input Component
 *
 * S-tier SaaS dashboard input component with comprehensive state management,
 * validation integration, accessibility, and performance optimization.
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useComponentState } from '../../hooks/useComponentState';
import { useComponentStateContext } from '../../contexts/ComponentStateProvider';
import {
  ComponentVariant,
  ComponentState,
  ComponentSize
} from '../../types/componentState';

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

// Enhanced variant system for inputs
export type InputVariant = ComponentVariant;

// Enhanced state system for inputs
export type InputState = ComponentState;

// Enhanced size system for inputs
export type InputSize = ComponentSize;

// Input-specific props extending HTML input attributes
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visual variant following S-tier design patterns */
  variant?: InputVariant;
  /** Input state for comprehensive state management */
  state?: InputState;
  /** Size variant for responsive design */
  size?: InputSize;
  /** Enable enhanced animations */
  animated?: boolean;
  /** Animation speed configuration */
  animationSpeed?: 'fast' | 'normal' | 'slow';
  /** Label text for the input */
  label?: string;
  /** Error message for error state */
  errorMessage?: string;
  /** Success message for success state */
  successMessage?: string;
  /** Helper text to display below input */
  helperText?: string;
  /** Icon element to display before input */
  icon?: React.ReactNode;
  /** Icon element to display after input */
  iconAfter?: React.ReactNode;
  /** Auto-dismiss error state after duration (ms) */
  errorDismissAfter?: number;
  /** Callback when state changes */
  onStateChange?: (state: InputState) => void;
  /** Validation function */
  onValidate?: (value: string) => { isValid: boolean; error?: string };
  /** Container className for wrapper */
  containerClassName?: string;
  /** Full width input */
  fullWidth?: boolean;
}

// Input component reference for imperative operations
export interface InputRef {
  /** Get current input state */
  getState: () => InputState;
  /** Set input state programmatically */
  setState: (state: InputState) => void;
  /** Trigger success state with optional message */
  setSuccess: (message?: string) => void;
  /** Trigger error state with optional message */
  setError: (message?: string) => void;
  /** Clear error/success and return to idle */
  reset: () => void;
  /** Focus the input */
  focus: () => void;
  /** Get input value */
  getValue: () => string;
  /** Set input value */
  setValue: (value: string) => void;
  /** Validate input value */
  validate: () => boolean;
}

/**
 * Enhanced Input Component with S-tier SaaS dashboard patterns
 */
export const Input = forwardRef<InputRef, InputProps>(({
  variant = 'primary',
  state: initialState = 'idle',
  size = 'md',
  animated = true,
  animationSpeed = 'normal',
  label,
  errorMessage,
  successMessage,
  helperText,
  icon,
  iconAfter,
  errorDismissAfter = 5000,
  onStateChange,
  onValidate,
  containerClassName = '',
  fullWidth = false,
  className = '',
  disabled,
  onChange,
  onBlur,
  onFocus,
  ...props
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize component state with enhanced configuration
  const componentState = useComponentState({
    initialConfig: {
      variant,
      state: initialState,
      size,
      animated,
      animationSpeed,
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
    if (inputRef.current && contextState) {
      contextState.setActiveElement(inputRef.current);
    }
  }, [contextState]);

  // Handle state changes and notifications
  useEffect(() => {
    if (onStateChange) {
      onStateChange(componentState.state);
    }

    // Auto-dismiss error state
    if (componentState.state === 'error' && errorDismissAfter > 0) {
      dismissTimeoutRef.current = setTimeout(() => {
        componentState.setState('idle');
      }, errorDismissAfter);
    }

    // Clear any existing timeouts when state changes
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [componentState.state, onStateChange, errorDismissAfter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  // Handle input validation
  const handleValidation = (value: string) => {
    if (onValidate) {
      const validation = onValidate(value);
      if (!validation.isValid && validation.error) {
        componentState.setError(validation.error);
        return false;
      } else if (validation.isValid && componentState.hasError) {
        componentState.setState('idle');
      }
      return validation.isValid;
    }
    return true;
  };

  // Handle input change with validation
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {

    // Clear error state on typing if not disabled
    if (componentState.hasError && !disabled) {
      componentState.setState('idle');
    }

    // Call original onChange handler
    if (onChange) {
      onChange(event);
    }
  };

  // Handle input blur with validation
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const value = event.target.value;

    // Validate on blur
    if (value && !disabled) {
      handleValidation(value);
    }

    // Call original onBlur handler
    if (onBlur) {
      onBlur(event);
    }
  };

  // Handle input focus
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    // Clear error state on focus
    if (componentState.hasError && !disabled) {
      componentState.setState('idle');
    }

    // Call original onFocus handler
    if (onFocus) {
      onFocus(event);
    }
  };

  // Imperative API
  useImperativeHandle(ref, () => ({
    getState: () => componentState.state,
    setState: (newState: InputState) => componentState.setState(newState),
    setSuccess: (message?: string) => componentState.setSuccess(message),
    setError: (message?: string) => componentState.setError(message),
    reset: () => componentState.reset(),
    focus: () => inputRef.current?.focus(),
    getValue: () => inputRef.current?.value || '',
    setValue: (value: string) => {
      if (inputRef.current) {
        inputRef.current.value = value;
      }
    },
    validate: () => {
      const value = inputRef.current?.value || '';
      return handleValidation(value);
    }
  }), [componentState]);

  // Compute final className with state-aware classes
  const computedInputClassName = [
    'input',
    componentState.className, // Includes variant, size, and state classes
    fullWidth ? 'input--full-width' : '',
    icon ? 'input--with-icon' : '',
    iconAfter ? 'input--with-icon-after' : '',
    className
  ].filter(Boolean).join(' ');

  const computedContainerClassName = [
    'input-container',
    fullWidth ? 'input-container--full-width' : '',
    containerClassName
  ].filter(Boolean).join(' ');

  // Determine if input should be disabled
  const isDisabled = disabled ||
                     componentState.isDisabled ||
                     componentState.isLoading;

  // Get current error or success message
  const currentErrorMessage = componentState.hasError ?
    (componentState.config.errorMessage || errorMessage) : null;
  const currentSuccessMessage = componentState.isSuccess ?
    (componentState.config.successMessage || successMessage) : null;

  return (
    <div className={computedContainerClassName}>
      {label && (
        <label
          htmlFor={props.id}
          className="input-label"
        >
          {label}
          {props.required && <span className="input-label__required">*</span>}
        </label>
      )}

      <div className="input-wrapper">
        {icon && (
          <div className="input-icon input-icon--before">
            {icon}
          </div>
        )}

        <input
          ref={inputRef}
          className={computedInputClassName}
          disabled={isDisabled}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          aria-label={props['aria-label'] || label}
          aria-invalid={componentState.hasError}
          aria-describedby={
            currentErrorMessage ? `${props.id}-error` :
            currentSuccessMessage ? `${props.id}-success` :
            helperText ? `${props.id}-helper` : undefined
          }
          data-state={componentState.state}
          data-variant={componentState.variant}
          data-size={componentState.size}
          {...props}
        />

        {iconAfter && (
          <div className="input-icon input-icon--after">
            {iconAfter}
          </div>
        )}

        {componentState.isLoading && (
          <div className="input-loading">
            <div className="loading-spinner loading-spinner--sm"></div>
          </div>
        )}
      </div>

      {/* Error message */}
      {currentErrorMessage && (
        <div
          id={`${props.id}-error`}
          className="input-message input-message--error"
          role="alert"
        >
          {currentErrorMessage}
        </div>
      )}

      {/* Success message */}
      {currentSuccessMessage && (
        <div
          id={`${props.id}-success`}
          className="input-message input-message--success"
        >
          {currentSuccessMessage}
        </div>
      )}

      {/* Helper text */}
      {helperText && !currentErrorMessage && !currentSuccessMessage && (
        <div
          id={`${props.id}-helper`}
          className="input-message input-message--helper"
        >
          {helperText}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;