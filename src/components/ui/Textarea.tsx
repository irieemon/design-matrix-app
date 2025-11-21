/**
 * Enhanced Textarea Component
 *
 * S-tier SaaS dashboard textarea component with comprehensive state management,
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

// Enhanced variant system for textareas
export type TextareaVariant = ComponentVariant;

// Enhanced state system for textareas
export type TextareaState = ComponentState;

// Enhanced size system for textareas
export type TextareaSize = ComponentSize;

// Textarea-specific props extending HTML textarea attributes
export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /** Visual variant following S-tier design patterns */
  variant?: TextareaVariant;
  /** Textarea state for comprehensive state management */
  state?: TextareaState;
  /** Size variant for responsive design */
  size?: TextareaSize;
  /** Enable enhanced animations */
  animated?: boolean;
  /** Animation speed configuration */
  animationSpeed?: 'fast' | 'normal' | 'slow';
  /** Label text for the textarea */
  label?: string;
  /** Error message for error state */
  errorMessage?: string;
  /** Success message for success state */
  successMessage?: string;
  /** Helper text to display below textarea */
  helperText?: string;
  /** Auto-dismiss error state after duration (ms) */
  errorDismissAfter?: number;
  /** Callback when state changes */
  onStateChange?: (state: TextareaState) => void;
  /** Validation function */
  onValidate?: (value: string) => { isValid: boolean; error?: string };
  /** Container className for wrapper */
  containerClassName?: string;
  /** Full width textarea */
  fullWidth?: boolean;
  /** Auto-resize based on content */
  autoResize?: boolean;
  /** Minimum number of rows */
  minRows?: number;
  /** Maximum number of rows */
  maxRows?: number;
  /** Character count display */
  showCharacterCount?: boolean;
  /** Maximum character limit */
  maxLength?: number;
}

// Textarea component reference for imperative operations
export interface TextareaRef {
  /** Get current textarea state */
  getState: () => TextareaState;
  /** Set textarea state programmatically */
  setState: (state: TextareaState) => void;
  /** Trigger success state with optional message */
  setSuccess: (message?: string) => void;
  /** Trigger error state with optional message */
  setError: (message?: string) => void;
  /** Clear error/success and return to idle */
  reset: () => void;
  /** Focus the textarea */
  focus: () => void;
  /** Get textarea value */
  getValue: () => string;
  /** Set textarea value */
  setValue: (value: string) => void;
  /** Validate textarea value */
  validate: () => boolean;
  /** Resize textarea to fit content */
  resize: () => void;
}

/**
 * Enhanced Textarea Component with S-tier SaaS dashboard patterns
 */
export const Textarea = forwardRef<TextareaRef, TextareaProps>(({
  variant = 'primary',
  state: initialState = 'idle',
  size = 'md',
  animated = true,
  animationSpeed = 'normal',
  label,
  errorMessage,
  successMessage,
  helperText,
  errorDismissAfter = 5000,
  onStateChange,
  onValidate,
  containerClassName = '',
  fullWidth = false,
  autoResize = false,
  minRows = 3,
  maxRows = 10,
  showCharacterCount = false,
  maxLength,
  className = '',
  disabled,
  onChange,
  onBlur,
  onFocus,
  value,
  defaultValue,
  ...props
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    if (textareaRef.current && contextState) {
      contextState.setActiveElement(textareaRef.current);
    }
  }, [contextState]);

  // Auto-resize functionality
  const handleResize = () => {
    if (!autoResize || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const style = window.getComputedStyle(textarea);
    const borderHeight = parseInt(style.borderTopWidth) + parseInt(style.borderBottomWidth);
    const paddingHeight = parseInt(style.paddingTop) + parseInt(style.paddingBottom);

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate new height
    const minHeight = (minRows || 3) * 24 + paddingHeight + borderHeight; // 24px per line
    const maxHeight = (maxRows || 10) * 24 + paddingHeight + borderHeight;
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

    textarea.style.height = `${newHeight}px`;
  };

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

  // Handle auto-resize on mount and value changes
  useEffect(() => {
    if (autoResize) {
      handleResize();
    }
  }, [value, defaultValue, autoResize]);

  // Handle textarea validation
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

  // Handle textarea change with validation and auto-resize
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {

    // Auto-resize if enabled
    if (autoResize) {
      setTimeout(handleResize, 0); // Defer to next tick
    }

    // Clear error state on typing if not disabled
    if (componentState.hasError && !disabled) {
      componentState.setState('idle');
    }

    // Call original onChange handler
    if (onChange) {
      onChange(event);
    }
  };

  // Handle textarea blur with validation
  const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
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

  // Handle textarea focus
  const handleFocus = (event: React.FocusEvent<HTMLTextAreaElement>) => {
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
    setState: (newState: TextareaState) => componentState.setState(newState),
    setSuccess: (message?: string) => componentState.setSuccess(message),
    setError: (message?: string) => componentState.setError(message),
    reset: () => componentState.reset(),
    focus: () => textareaRef.current?.focus(),
    getValue: () => textareaRef.current?.value || '',
    setValue: (value: string) => {
      if (textareaRef.current) {
        textareaRef.current.value = value;
        if (autoResize) {
          setTimeout(handleResize, 0);
        }
      }
    },
    validate: () => {
      const value = textareaRef.current?.value || '';
      return handleValidation(value);
    },
    resize: handleResize
  }), [componentState, autoResize]);

  // Compute final className with state-aware classes
  const computedTextareaClassName = [
    'textarea',
    componentState.className, // Includes variant, size, and state classes
    fullWidth ? 'textarea--full-width' : '',
    autoResize ? 'textarea--auto-resize' : '',
    className
  ].filter(Boolean).join(' ');

  const computedContainerClassName = [
    'textarea-container',
    fullWidth ? 'textarea-container--full-width' : '',
    containerClassName
  ].filter(Boolean).join(' ');

  // Determine if textarea should be disabled
  const isDisabled = disabled ||
                     componentState.isDisabled ||
                     componentState.isLoading;

  // Get current error or success message
  const currentErrorMessage = componentState.hasError ?
    (componentState.config.errorMessage || errorMessage) : null;
  const currentSuccessMessage = componentState.isSuccess ?
    (componentState.config.successMessage || successMessage) : null;

  // Character count calculation
  const currentValue = value || textareaRef.current?.value || '';
  const characterCount = typeof currentValue === 'string' ? currentValue.length : 0;
  const isOverLimit = maxLength && characterCount > maxLength;

  return (
    <div className={computedContainerClassName}>
      {label && (
        <label
          htmlFor={props.id}
          className="textarea-label"
        >
          {label}
          {props.required && <span className="textarea-label__required">*</span>}
        </label>
      )}

      <div className="textarea-wrapper">
        <textarea
          ref={textareaRef}
          className={computedTextareaClassName}
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
          rows={!autoResize ? (minRows || 3) : undefined}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          {...props}
        />

        {componentState.isLoading && (
          <div className="textarea-loading">
            <div className="loading-spinner loading-spinner--sm"></div>
          </div>
        )}
      </div>

      {/* Character count */}
      {(showCharacterCount || maxLength) && (
        <div className={`textarea-character-count ${isOverLimit ? 'textarea-character-count--error' : ''}`}>
          {characterCount}
          {maxLength && ` / ${maxLength}`}
        </div>
      )}

      {/* Error message */}
      {currentErrorMessage && (
        <div
          id={`${props.id}-error`}
          className="textarea-message textarea-message--error"
          role="alert"
        >
          {currentErrorMessage}
        </div>
      )}

      {/* Success message */}
      {currentSuccessMessage && (
        <div
          id={`${props.id}-success`}
          className="textarea-message textarea-message--success"
        >
          {currentSuccessMessage}
        </div>
      )}

      {/* Helper text */}
      {helperText && !currentErrorMessage && !currentSuccessMessage && (
        <div
          id={`${props.id}-helper`}
          className="textarea-message textarea-message--helper"
        >
          {helperText}
        </div>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;