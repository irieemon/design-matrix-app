/**
 * Enhanced Select Component
 *
 * S-tier SaaS dashboard select component with comprehensive state management,
 * validation integration, accessibility, and performance optimization.
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
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

// Enhanced variant system for selects
export type SelectVariant = ComponentVariant;

// Enhanced state system for selects
export type SelectState = ComponentState;

// Enhanced size system for selects
export type SelectSize = ComponentSize;

// Option type for select items
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  icon?: React.ReactNode;
}

// Option group for organizing options
export interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

// Select-specific props extending HTML select attributes
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Visual variant following S-tier design patterns */
  variant?: SelectVariant;
  /** Select state for comprehensive state management */
  state?: SelectState;
  /** Size variant for responsive design */
  size?: SelectSize;
  /** Enable enhanced animations */
  animated?: boolean;
  /** Animation speed configuration */
  animationSpeed?: 'fast' | 'normal' | 'slow';
  /** Label text for the select */
  label?: string;
  /** Error message for error state */
  errorMessage?: string;
  /** Success message for success state */
  successMessage?: string;
  /** Helper text to display below select */
  helperText?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-dismiss error state after duration (ms) */
  errorDismissAfter?: number;
  /** Callback when state changes */
  onStateChange?: (state: SelectState) => void;
  /** Validation function */
  onValidate?: (value: string) => { isValid: boolean; error?: string };
  /** Container className for wrapper */
  containerClassName?: string;
  /** Full width select */
  fullWidth?: boolean;
  /** Enable search functionality */
  searchable?: boolean;
  /** Enable multi-select */
  multiple?: boolean;
  /** Maximum number of selections for multi-select */
  maxSelections?: number;
  /** Custom select implementation (uses dropdown instead of native) */
  customSelect?: boolean;
  /** Options for the select */
  options?: SelectOption[] | SelectOptionGroup[];
  /** Clear button for clearable select */
  clearable?: boolean;
  /** Loading state for async options */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Search placeholder for searchable selects */
  searchPlaceholder?: string;
}

// Select component reference for imperative operations
export interface SelectRef {
  /** Get current select state */
  getState: () => SelectState;
  /** Set select state programmatically */
  setState: (state: SelectState) => void;
  /** Trigger success state with optional message */
  setSuccess: (message?: string) => void;
  /** Trigger error state with optional message */
  setError: (message?: string) => void;
  /** Clear error/success and return to idle */
  reset: () => void;
  /** Focus the select */
  focus: () => void;
  /** Get select value */
  getValue: () => string | string[];
  /** Set select value */
  setValue: (value: string | string[]) => void;
  /** Validate select value */
  validate: () => boolean;
  /** Open dropdown (custom select only) */
  open: () => void;
  /** Close dropdown (custom select only) */
  close: () => void;
  /** Clear selection */
  clear: () => void;
}

/**
 * Enhanced Select Component with S-tier SaaS dashboard patterns
 */
export const Select = forwardRef<SelectRef, SelectProps>(({
  variant = 'primary',
  state: initialState = 'idle',
  size = 'md',
  animated = true,
  animationSpeed = 'normal',
  label,
  errorMessage,
  successMessage,
  helperText,
  placeholder = 'Select an option...',
  errorDismissAfter = 5000,
  onStateChange,
  onValidate,
  containerClassName = '',
  fullWidth = false,
  searchable = false,
  multiple = false,
  maxSelections,
  customSelect = false,
  options = [],
  clearable = false,
  loading = false,
  emptyMessage = 'No options available',
  searchPlaceholder = 'Search options...',
  className = '',
  disabled,
  onChange,
  onBlur,
  onFocus,
  value,
  defaultValue,
  ...props
}, ref) => {
  const selectRef = useRef<HTMLSelectElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Custom select state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

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
    const element = customSelect ? dropdownRef.current : selectRef.current;
    if (element && contextState) {
      contextState.setActiveElement(element);
    }
  }, [contextState, customSelect]);

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

  // Handle click outside for custom select
  useEffect(() => {
    if (!customSelect) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, customSelect]);

  // Flatten options for easier processing
  const flatOptions = React.useMemo(() => {
    const flattened: SelectOption[] = [];
    options.forEach(item => {
      if ('options' in item) {
        // It's a group
        flattened.push(...item.options);
      } else {
        // It's a single option
        flattened.push(item);
      }
    });
    return flattened;
  }, [options]);

  // Type guard to check if an item is a SelectOptionGroup
  // Currently unused but kept for future group support
   
  // @ts-expect-error - Preserved for future group support
  const _isSelectOptionGroup = (item: SelectOption | SelectOptionGroup): item is SelectOptionGroup => {
    return 'options' in item;
  };

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return flatOptions;

    const filtered = flatOptions.filter(option =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.value.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered;
  }, [flatOptions, searchQuery]);

  // Handle select validation
  const handleValidation = (value: string | string[]) => {
    if (onValidate) {
      const validationValue = Array.isArray(value) ? value.join(',') : value;
      const validation = onValidate(validationValue);
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

  // Handle native select change
  const handleNativeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {

    // Clear error state on change if not disabled
    if (componentState.hasError && !disabled) {
      componentState.setState('idle');
    }

    // Call original onChange handler
    if (onChange) {
      onChange(event);
    }
  };

  // Handle custom select option selection
  const handleOptionSelect = (option: SelectOption) => {
    if (option.disabled) return;

    let newValue: string | string[];

    if (multiple) {
      const currentValues = selectedValues;
      if (currentValues.includes(option.value)) {
        newValue = currentValues.filter(v => v !== option.value);
      } else {
        if (maxSelections && currentValues.length >= maxSelections) {
          return; // Max selections reached
        }
        newValue = [...currentValues, option.value];
      }
      setSelectedValues(newValue);
    } else {
      newValue = option.value;
      setSelectedValues([option.value]);
      setIsOpen(false);
    }

    // Create synthetic event for onChange
    if (onChange) {
      const syntheticEvent = {
        target: { value: newValue },
        currentTarget: { value: newValue }
      } as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }

    // Clear error state
    if (componentState.hasError && !disabled) {
      componentState.setState('idle');
    }
  };

  // Handle blur
  const handleBlur = (event: React.FocusEvent<HTMLSelectElement>) => {
    const value = multiple ? selectedValues : (event.target.value || selectedValues[0] || '');

    // Validate on blur
    if (value && !disabled) {
      handleValidation(value);
    }

    // Call original onBlur handler
    if (onBlur) {
      onBlur(event);
    }
  };

  // Handle focus
  const handleFocus = (event: React.FocusEvent<HTMLSelectElement>) => {
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
    setState: (newState: SelectState) => componentState.setState(newState),
    setSuccess: (message?: string) => componentState.setSuccess(message),
    setError: (message?: string) => componentState.setError(message),
    reset: () => componentState.reset(),
    focus: () => selectRef.current?.focus(),
    getValue: () => multiple ? selectedValues : (selectRef.current?.value || selectedValues[0] || ''),
    setValue: (value: string | string[]) => {
      if (multiple && Array.isArray(value)) {
        setSelectedValues(value);
      } else if (!multiple && typeof value === 'string') {
        setSelectedValues([value]);
        if (selectRef.current) {
          selectRef.current.value = value;
        }
      }
    },
    validate: () => {
      const value = multiple ? selectedValues : (selectRef.current?.value || selectedValues[0] || '');
      return handleValidation(value);
    },
    open: () => customSelect && setIsOpen(true),
    close: () => customSelect && setIsOpen(false),
    clear: () => {
      setSelectedValues([]);
      if (selectRef.current) {
        selectRef.current.value = '';
      }
    }
  }), [componentState, multiple, selectedValues, customSelect]);

  // Compute final className with state-aware classes
  const computedSelectClassName = [
    'select',
    componentState.className, // Includes variant, size, and state classes
    fullWidth ? 'select--full-width' : '',
    customSelect ? 'select--custom' : 'select--native',
    searchable ? 'select--searchable' : '',
    multiple ? 'select--multiple' : '',
    clearable ? 'select--clearable' : '',
    className
  ].filter(Boolean).join(' ');

  const computedContainerClassName = [
    'select-container',
    fullWidth ? 'select-container--full-width' : '',
    containerClassName
  ].filter(Boolean).join(' ');

  // Determine if select should be disabled
  const isDisabled = disabled ||
                     componentState.isDisabled ||
                     componentState.isLoading ||
                     loading;

  // Get current error or success message
  const currentErrorMessage = componentState.hasError ?
    (componentState.config.errorMessage || errorMessage) : null;
  const currentSuccessMessage = componentState.isSuccess ?
    (componentState.config.successMessage || successMessage) : null;

  // Get selected option labels for display
  const getSelectedLabels = () => {
    if (selectedValues.length === 0) return placeholder;

    const labels = selectedValues
      .map(value => flatOptions.find(opt => opt.value === value)?.label)
      .filter(Boolean);

    if (multiple) {
      return labels.length > 0 ? `${labels.length} selected` : placeholder;
    }

    return labels[0] || placeholder;
  };

  if (customSelect) {
    // Render custom select dropdown
    return (
      <div className={computedContainerClassName}>
        {label && (
          <label className="select-label">
            {label}
            {props.required && <span className="select-label__required">*</span>}
          </label>
        )}

        <div className="select-wrapper" ref={dropdownRef}>
          <div
            className={`${computedSelectClassName} ${isOpen ? 'select--open' : ''}`}
            onClick={() => !isDisabled && setIsOpen(!isOpen)}
            data-state={componentState.state}
            data-variant={componentState.variant}
            data-size={componentState.size}
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            tabIndex={isDisabled ? -1 : 0}
          >
            <span className="select-value">
              {getSelectedLabels()}
            </span>

            <div className="select-icons">
              {clearable && selectedValues.length > 0 && (
                <button
                  type="button"
                  className="select-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedValues([]);
                  }}
                  aria-label="Clear selection"
                >
                  ×
                </button>
              )}

              {(componentState.isLoading || loading) ? (
                <div className="loading-spinner loading-spinner--sm"></div>
              ) : (
                <ChevronDown className={`select-chevron ${isOpen ? 'select-chevron--rotated' : ''}`} />
              )}
            </div>
          </div>

          {isOpen && (
            <div className="select-dropdown">
              {searchable && (
                <div className="select-search">
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="select-search-input"
                  />
                </div>
              )}

              <div className="select-options">
                {filteredOptions.length === 0 ? (
                  <div className="select-empty">{emptyMessage}</div>
                ) : (
                  filteredOptions.map((option) => (
                    <div
                      key={option.value}
                      className={`select-option ${
                        selectedValues.includes(option.value) ? 'select-option--selected' : ''
                      } ${option.disabled ? 'select-option--disabled' : ''}`}
                      onClick={() => handleOptionSelect(option)}
                      role="option"
                      aria-selected={selectedValues.includes(option.value)}
                    >
                      {option.icon && <span className="select-option-icon">{option.icon}</span>}
                      <div className="select-option-content">
                        <span className="select-option-label">{option.label}</span>
                        {option.description && (
                          <span className="select-option-description">{option.description}</span>
                        )}
                      </div>
                      {multiple && selectedValues.includes(option.value) && (
                        <Check className="select-option-check" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {currentErrorMessage && (
          <div className="select-message select-message--error" role="alert">
            {currentErrorMessage}
          </div>
        )}

        {/* Success message */}
        {currentSuccessMessage && (
          <div className="select-message select-message--success">
            {currentSuccessMessage}
          </div>
        )}

        {/* Helper text */}
        {helperText && !currentErrorMessage && !currentSuccessMessage && (
          <div className="select-message select-message--helper">
            {helperText}
          </div>
        )}
      </div>
    );
  }

  // Render native select
  return (
    <div className={computedContainerClassName}>
      {label && (
        <label
          htmlFor={props.id}
          className="select-label"
        >
          {label}
          {props.required && <span className="select-label__required">*</span>}
        </label>
      )}

      <div className="select-wrapper">
        <select
          ref={selectRef}
          className={computedSelectClassName}
          disabled={isDisabled}
          onChange={handleNativeChange}
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
          value={value}
          defaultValue={defaultValue}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((item, index) => {
            if ('options' in item) {
              // Render option group
              return (
                <optgroup key={index} label={item.label}>
                  {item.options.map(option => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              );
            } else {
              // Render single option
              return (
                <option
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                >
                  {item.label}
                </option>
              );
            }
          })}
        </select>

        <ChevronDown className="select-chevron select-chevron--native" />

        {(componentState.isLoading || loading) && (
          <div className="select-loading">
            <div className="loading-spinner loading-spinner--sm"></div>
          </div>
        )}
      </div>

      {/* Error message */}
      {currentErrorMessage && (
        <div
          id={`${props.id}-error`}
          className="select-message select-message--error"
          role="alert"
        >
          {currentErrorMessage}
        </div>
      )}

      {/* Success message */}
      {currentSuccessMessage && (
        <div
          id={`${props.id}-success`}
          className="select-message select-message--success"
        >
          {currentSuccessMessage}
        </div>
      )}

      {/* Helper text */}
      {helperText && !currentErrorMessage && !currentSuccessMessage && (
        <div
          id={`${props.id}-helper`}
          className="select-message select-message--helper"
        >
          {helperText}
        </div>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;