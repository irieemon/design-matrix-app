/**
 * useComponentState Hook
 *
 * Unified component state management hook with advanced features:
 * - Automatic error recovery
 * - State persistence
 * - Performance optimization
 * - Accessibility integration
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { logger } from '../utils/logger';
import {
  ComponentStateConfig,
  ComponentState,
  ComponentVariant,
  ComponentSize,
  UseComponentStateOptions,
  DEFAULT_COMPONENT_STATE,
  isValidState,
  isValidVariant,
  isValidSize,
  STATE_CLASSES,
  VARIANT_CLASSES,
  SIZE_CLASSES,
} from '../types/componentState';

/**
 * Enhanced component state hook with automatic management features
 */
export interface UseComponentStateReturn {
  /** Current component configuration */
  config: ComponentStateConfig;
  /** Current component state */
  state: ComponentState;
  /** Current component variant */
  variant: ComponentVariant;
  /** Current component size */
  size: ComponentSize;
  /** Whether component is currently transitioning */
  isTransitioning: boolean;
  /** Whether component has error */
  hasError: boolean;
  /** Whether component is disabled */
  isDisabled: boolean;
  /** Whether component is loading */
  isLoading: boolean;
  /** Whether component is in success state */
  isSuccess: boolean;
  /** Computed CSS classes for current state */
  stateClasses: string;
  /** Computed CSS classes for current variant */
  variantClasses: string;
  /** Computed CSS classes for current size */
  sizeClasses: string;
  /** Combined CSS classes */
  className: string;
  /** Set component state */
  setState: (state: ComponentState) => void;
  /** Set component variant */
  setVariant: (variant: ComponentVariant) => void;
  /** Set component size */
  setSize: (size: ComponentSize) => void;
  /** Update entire configuration */
  updateConfig: (config: Partial<ComponentStateConfig>) => void;
  /** Reset to default state */
  reset: () => void;
  /** Trigger error state with optional message */
  setError: (message?: string) => void;
  /** Trigger success state with optional message */
  setSuccess: (message?: string) => void;
  /** Trigger loading state with optional text */
  setLoading: (text?: string) => void;
  /** Clear error and return to idle */
  clearError: () => void;
  /** Execute async action with automatic state management */
  executeAction: <T>(action: () => Promise<T>) => Promise<T>;
}

/**
 * Component state persistence utilities
 *
 * SECURITY WARNING: localStorage persistence is DISABLED by default per PRIO-SEC-006
 * Previous implementation had stored XSS vulnerability via unsanitized JSON deserialization
 * Component error messages could contain XSS payloads that would execute on reload
 *
 * If you need state persistence, implement with:
 * 1. Server-side storage with proper sanitization
 * 2. Input validation on all persisted fields
 * 3. Content Security Policy headers
 */
const useStatePersistence = (
  key: string,
  enabled: boolean
) => {
  // SECURITY FIX: Persistence disabled by default per PRIO-SEC-006 (CVSS 5.4)
  // Stored XSS vulnerability via localStorage deserialization
  if (enabled) {
    logger.warn(
      '⚠️ SECURITY WARNING: Component state persistence is disabled. ' +
      'Previous implementation had XSS vulnerability. Use server-side storage instead.',
      { key }
    );
  }

  // Disabled - no localStorage operations
  // Original code removed to prevent XSS attacks
};

/**
 * Validate component configuration
 */
const isValidComponentConfig = (config: any): config is Partial<ComponentStateConfig> => {
  if (!config || typeof config !== 'object') return false;

  if (config.state && !isValidState(config.state)) return false;
  if (config.variant && !isValidVariant(config.variant)) return false;
  if (config.size && !isValidSize(config.size)) return false;

  return true;
};

/**
 * Auto error recovery hook
 */
const useAutoErrorRecovery = (
  enabled: boolean,
  timeout: number,
  state: ComponentState,
  setState: (state: ComponentState) => void
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || state !== 'error') return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set auto recovery timeout
    timeoutRef.current = setTimeout(() => {
      setState('idle');
      logger.debug('Auto-recovered from error state', { timeout });
    }, timeout);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, timeout, state, setState]);
};

/**
 * Main useComponentState hook
 */
export const useComponentState = (options: UseComponentStateOptions = {}): UseComponentStateReturn => {
  const {
    initialConfig = {},
    autoErrorRecovery = false,
    errorRecoveryTimeout = 5000,
    persistState = false,
    customTransitions = {},
  } = options;

  // Initialize configuration with defaults
  const [config, setConfig] = useState<ComponentStateConfig>(() => ({
    ...DEFAULT_COMPONENT_STATE,
    ...initialConfig,
  }));

  const [isTransitioning, setIsTransitioning] = useState(false);

  // Persistence key based on component location
  const persistenceKey = useMemo(() => {
    const stack = new Error().stack || '';
    const match = stack.match(/at\s+(\w+)/);
    return match ? match[1] : 'unknown';
  }, []);

  // State persistence
  useStatePersistence(persistenceKey, persistState);

  // Auto error recovery
  useAutoErrorRecovery(autoErrorRecovery, errorRecoveryTimeout, config.state, (state) => {
    setConfig(prev => ({ ...prev, state }));
  });

  // Computed state properties
  const state = config.state;
  const variant = config.variant;
  const size = config.size;
  const hasError = state === 'error';
  const isDisabled = state === 'disabled';
  const isLoading = state === 'loading';
  const isSuccess = state === 'success';

  // Computed CSS classes
  const stateClasses = STATE_CLASSES[state] || '';
  const variantClasses = VARIANT_CLASSES[variant] || '';
  const sizeClasses = SIZE_CLASSES[size] || '';
  const className = [stateClasses, variantClasses, sizeClasses].filter(Boolean).join(' ');

  /**
   * State transition with validation and logging
   */
  const executeTransition = useCallback((newState: ComponentState, message?: string) => {
    if (!isValidState(newState)) {
      logger.error('Invalid state transition attempted', { from: state, to: newState });
      return;
    }

    if (state === newState) return;

    // Handle custom transitions
    const customTransition = customTransitions[newState];
    if (customTransition) {
      setIsTransitioning(true);
      setTimeout(() => {
        setConfig(prev => ({ ...prev, state: newState }));
        setIsTransitioning(false);
        customTransition.onComplete?.();
      }, customTransition.duration);
    } else {
      setConfig(prev => ({
        ...prev,
        state: newState,
        ...(message && {
          [`${newState}Message`]: message
        })
      }));
    }

    logger.debug('Component state transition', {
      from: state,
      to: newState,
      message,
      hasCustomTransition: !!customTransition,
    });
  }, [state, customTransitions]);

  /**
   * Set component state with validation
   */
  const setState = useCallback((newState: ComponentState) => {
    executeTransition(newState);
  }, [executeTransition]);

  /**
   * Set component variant with validation
   */
  const setVariant = useCallback((newVariant: ComponentVariant) => {
    if (!isValidVariant(newVariant)) {
      logger.error('Invalid variant provided', { variant: newVariant });
      return;
    }

    setConfig(prev => ({ ...prev, variant: newVariant }));
    logger.debug('Component variant changed', { from: variant, to: newVariant });
  }, [variant]);

  /**
   * Set component size with validation
   */
  const setSize = useCallback((newSize: ComponentSize) => {
    if (!isValidSize(newSize)) {
      logger.error('Invalid size provided', { size: newSize });
      return;
    }

    setConfig(prev => ({ ...prev, size: newSize }));
    logger.debug('Component size changed', { from: size, to: newSize });
  }, [size]);

  /**
   * Update entire configuration
   */
  const updateConfig = useCallback((newConfig: Partial<ComponentStateConfig>) => {
    if (!isValidComponentConfig(newConfig)) {
      logger.error('Invalid configuration provided', { config: newConfig });
      return;
    }

    const previousConfig = config;
    setConfig(prev => ({ ...prev, ...newConfig }));

    logger.debug('Component configuration updated', {
      previous: previousConfig,
      updates: newConfig,
    });
  }, [config]);

  /**
   * Reset to default state
   */
  const reset = useCallback(() => {
    setConfig({ ...DEFAULT_COMPONENT_STATE, ...initialConfig });
    setIsTransitioning(false);
    logger.debug('Component state reset to defaults');
  }, [initialConfig]);

  /**
   * Set error state with message
   */
  const setError = useCallback((message?: string) => {
    executeTransition('error', message);
  }, [executeTransition]);

  /**
   * Set success state with message
   */
  const setSuccess = useCallback((message?: string) => {
    executeTransition('success', message);
  }, [executeTransition]);

  /**
   * Set loading state with text
   */
  const setLoading = useCallback((text?: string) => {
    executeTransition('loading', text);
  }, [executeTransition]);

  /**
   * Clear error and return to idle
   */
  const clearError = useCallback(() => {
    if (state === 'error') {
      executeTransition('idle');
    }
  }, [state, executeTransition]);

  /**
   * Execute async action with automatic state management
   */
  const executeAction = useCallback(async <T>(action: () => Promise<T>): Promise<T> => {
    try {
      setLoading();
      const result = await action();
      setSuccess();

      // Auto-return to idle after success
      setTimeout(() => {
        if (config.state === 'success') {
          setState('idle');
        }
      }, 2000);

      return result;
    } catch (_error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      throw error;
    }
  }, [config.state, setLoading, setSuccess, setError, setState]);

  return {
    config,
    state,
    variant,
    size,
    isTransitioning,
    hasError,
    isDisabled,
    isLoading,
    isSuccess,
    stateClasses,
    variantClasses,
    sizeClasses,
    className,
    setState,
    setVariant,
    setSize,
    updateConfig,
    reset,
    setError,
    setSuccess,
    setLoading,
    clearError,
    executeAction,
  };
};

/**
 * Simplified hook for basic state management
 */
export const useSimpleState = (initialState: ComponentState = 'idle') => {
  const { state, setState, isLoading, hasError, isSuccess, clearError } = useComponentState({
    initialConfig: { state: initialState },
  });

  return {
    state,
    setState,
    isLoading,
    hasError,
    isSuccess,
    clearError,
  };
};

/**
 * Hook for form component state management
 */
export const useFormComponentState = (options: UseComponentStateOptions = {}) => {
  const componentState = useComponentState({
    ...options,
    autoErrorRecovery: true,
    errorRecoveryTimeout: 5000,
  });

  // Form-specific helpers
  const setValidationError = useCallback((message: string) => {
    componentState.setError(message);
  }, [componentState]);

  const setValidationSuccess = useCallback(() => {
    componentState.setSuccess();
  }, [componentState]);

  const validateAndExecute = useCallback(async <T>(
    validator: () => boolean | string,
    action: () => Promise<T>
  ): Promise<T | null> => {
    const validation = validator();

    if (validation === true) {
      return componentState.executeAction(action);
    } else {
      const errorMessage = typeof validation === 'string' ? validation : 'Validation failed';
      setValidationError(errorMessage);
      return null;
    }
  }, [componentState, setValidationError]);

  return {
    ...componentState,
    setValidationError,
    setValidationSuccess,
    validateAndExecute,
  };
};