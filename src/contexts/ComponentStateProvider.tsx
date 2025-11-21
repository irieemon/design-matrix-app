/**
 * Component State Provider
 *
 * Provides unified component state management across the application.
 * Implements S-tier SaaS dashboard patterns with performance optimization.
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../utils/logger';
import { useComponentStateAnimations } from '../lib/animations/componentStateAnimations';
import {
  ComponentStateConfig,
  ComponentStateContextValue,
  ComponentStateProviderProps,
  StateTransition,
  ComponentState,
  ComponentVariant,
  ComponentSize,
  DEFAULT_COMPONENT_STATE,
  TRANSITION_PRESETS,
  isValidState,
  isValidVariant,
  isValidSize,
} from '../types/componentState';

/**
 * Component State Context
 */
const ComponentStateContext = createContext<ComponentStateContextValue | null>(null);

/**
 * Performance monitoring for state transitions
 */
interface StatePerformanceMetrics {
  transitionCount: number;
  averageTransitionTime: number;
  slowTransitions: number;
  lastTransitionTime: number;
}

const createInitialMetrics = (): StatePerformanceMetrics => ({
  transitionCount: 0,
  averageTransitionTime: 0,
  slowTransitions: 0,
  lastTransitionTime: 0,
});

/**
 * Component State Provider Implementation
 */
export const ComponentStateProvider: React.FC<ComponentStateProviderProps> = ({
  children,
  defaults = {},
  globalAnimations = true,
  performanceMonitoring = false,
}) => {
  // Merge defaults with system defaults
  const initialConfig: ComponentStateConfig = {
    ...DEFAULT_COMPONENT_STATE,
    ...defaults,
    animated: globalAnimations && (defaults.animated ?? DEFAULT_COMPONENT_STATE.animated),
  };

  // Component state management
  const [config, setConfig] = useState<ComponentStateConfig>(initialConfig);
  const [transition, setTransition] = useState<StateTransition | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Animation controller integration
  const animationController = useComponentStateAnimations();

  // Performance monitoring
  const performanceMetrics = useRef<StatePerformanceMetrics>(createInitialMetrics());
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);

  /**
   * Record performance metrics for state transitions
   */
  const recordTransitionPerformance = useCallback((duration: number) => {
    if (!performanceMonitoring) return;

    const metrics = performanceMetrics.current;
    metrics.transitionCount++;
    metrics.lastTransitionTime = duration;

    // Update average transition time with safe calculation
    const currentAverage = metrics.averageTransitionTime || 0;
    metrics.averageTransitionTime =
      (currentAverage * (metrics.transitionCount - 1) + duration) / metrics.transitionCount;

    // Track slow transitions (>500ms)
    if (duration > 500) {
      metrics.slowTransitions++;
      logger.warn('Slow component state transition detected', {
        duration,
        fromState: transition?.from,
        toState: transition?.to,
      });
    }

    logger.debug('Component state transition performance', {
      duration,
      averageTime: metrics.averageTransitionTime,
      totalTransitions: metrics.transitionCount,
      slowTransitions: metrics.slowTransitions,
    });
  }, [performanceMonitoring, transition]);

  /**
   * Execute state transition with enhanced animation system
   */
  const executeTransition = useCallback(async (
    fromState: ComponentState,
    toState: ComponentState,
    targetElement?: HTMLElement,
    onComplete?: () => void
  ) => {
    if (!config.animated || fromState === toState) {
      onComplete?.();
      return;
    }

    const startTime = performance.now();
    const element = targetElement || activeElementRef.current;

    // If no element is available, fall back to basic transition
    if (!element) {
      const transitionConfig = TRANSITION_PRESETS[config.animationSpeed];
      const newTransition: StateTransition = {
        from: fromState,
        to: toState,
        duration: transitionConfig.duration,
        easing: transitionConfig.easing,
        onComplete: () => {
          const endTime = performance.now();
          recordTransitionPerformance(endTime - startTime);
          setIsTransitioning(false);
          setTransition(null);
          onComplete?.();
        },
      };

      setTransition(newTransition);
      setIsTransitioning(true);

      setTimeout(() => {
        newTransition.onComplete?.();
      }, newTransition.duration);
      return;
    }

    try {
      setIsTransitioning(true);
      setTransition({
        from: fromState,
        to: toState,
        duration: TRANSITION_PRESETS[config.animationSpeed].duration,
        easing: TRANSITION_PRESETS[config.animationSpeed].easing,
      });

      // Execute enhanced animation
      await animationController.executeStateTransition(
        element,
        fromState,
        toState,
        config.variant,
        config.animationSpeed
      );

      const endTime = performance.now();
      recordTransitionPerformance(endTime - startTime);

      setIsTransitioning(false);
      setTransition(null);
      onComplete?.();

    } catch (_error) {
      logger.error('State transition animation failed:', error);
      setIsTransitioning(false);
      setTransition(null);
      onComplete?.();
    }
  }, [config.animated, config.animationSpeed, config.variant, recordTransitionPerformance, animationController]);

  /**
   * Set component state with validation and enhanced transitions
   */
  const setState = useCallback((newState: ComponentState, targetElement?: HTMLElement) => {
    if (!isValidState(newState)) {
      logger.error('Invalid component state provided', { state: newState });
      return;
    }

    const currentState = config.state;

    // Update state immediately for non-animated changes
    setConfig(prev => ({ ...prev, state: newState }));

    // Execute transition if animations are enabled
    if (config.animated && currentState !== newState) {
      executeTransition(currentState, newState, targetElement);
    }

    logger.debug('Component state changed', {
      from: currentState,
      to: newState,
      animated: config.animated,
    });
  }, [config.state, config.animated, executeTransition]);

  /**
   * Set component variant with validation
   */
  const setVariant = useCallback((newVariant: ComponentVariant) => {
    if (!isValidVariant(newVariant)) {
      logger.error('Invalid component variant provided', { variant: newVariant });
      return;
    }

    setConfig(prev => ({ ...prev, variant: newVariant }));

    logger.debug('Component variant changed', {
      from: config.variant,
      to: newVariant,
    });
  }, [config.variant]);

  /**
   * Set component size with validation
   */
  const setSize = useCallback((newSize: ComponentSize) => {
    if (!isValidSize(newSize)) {
      logger.error('Invalid component size provided', { size: newSize });
      return;
    }

    setConfig(prev => ({ ...prev, size: newSize }));

    logger.debug('Component size changed', {
      from: config.size,
      to: newSize,
    });
  }, [config.size]);

  /**
   * Update entire configuration with validation
   */
  const updateConfig = useCallback((newConfig: Partial<ComponentStateConfig>) => {
    // Validate new configuration
    if (newConfig.state && !isValidState(newConfig.state)) {
      logger.error('Invalid state in configuration update', { state: newConfig.state });
      delete newConfig.state;
    }

    if (newConfig.variant && !isValidVariant(newConfig.variant)) {
      logger.error('Invalid variant in configuration update', { variant: newConfig.variant });
      delete newConfig.variant;
    }

    if (newConfig.size && !isValidSize(newConfig.size)) {
      logger.error('Invalid size in configuration update', { size: newConfig.size });
      delete newConfig.size;
    }

    const currentState = config.state;
    const newState = newConfig.state;

    // Update configuration
    setConfig(prev => ({ ...prev, ...newConfig }));

    // Handle state transition if state is changing
    if (newState && currentState !== newState) {
      executeTransition(currentState, newState);
    }

    logger.debug('Component configuration updated', {
      previous: config,
      updates: newConfig,
    });
  }, [config, executeTransition]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      // Cleanup animation controller
      animationController.cleanup();
    };
  }, [animationController]);

  /**
   * Set active element for animations
   */
  const setActiveElement = useCallback((element: HTMLElement | null) => {
    activeElementRef.current = element;
  }, []);

  /**
   * Apply hover animation to element
   */
  const applyHoverAnimation = useCallback((element: HTMLElement, isEntering: boolean) => {
    animationController.applyHoverAnimation(element, config.variant, isEntering);
  }, [animationController, config.variant]);

  /**
   * Create loading animation loop for element
   */
  const createLoadingLoop = useCallback((element: HTMLElement) => {
    return animationController.createLoadingLoop(element, config.variant);
  }, [animationController, config.variant]);

  /**
   * Context value with enhanced animation support
   */
  const contextValue: ComponentStateContextValue = {
    config,
    setState,
    setVariant,
    setSize,
    updateConfig,
    transition,
    isTransitioning,
    setActiveElement,
    applyHoverAnimation,
    createLoadingLoop,
  };

  // Performance monitoring debug output
  useEffect(() => {
    if (performanceMonitoring && performanceMetrics.current.transitionCount > 0) {
      const metrics = performanceMetrics.current;
      logger.debug('Component state performance summary', {
        totalTransitions: metrics.transitionCount,
        averageTime: `${(metrics.averageTransitionTime || 0).toFixed(2)}ms`,
        slowTransitions: metrics.slowTransitions,
        slowTransitionRate: `${((metrics.slowTransitions / Math.max(metrics.transitionCount, 1)) * 100).toFixed(1)}%`,
      });
    }
  }, [performanceMonitoring, config.state]);

  return (
    <ComponentStateContext.Provider value={contextValue}>
      {children}
    </ComponentStateContext.Provider>
  );
};

/**
 * Hook to access component state context
 */
export const useComponentStateContext = (): ComponentStateContextValue => {
  const context = useContext(ComponentStateContext);

  if (!context) {
    throw new Error(
      'useComponentStateContext must be used within a ComponentStateProvider. ' +
      'Make sure to wrap your component tree with <ComponentStateProvider>.'
    );
  }

  return context;
};

/**
 * Higher-order component for automatic state management
 */
export const withComponentState = <P extends object>(
  Component: React.ComponentType<P>,
  defaultConfig?: Partial<ComponentStateConfig>
) => {
  const WrappedComponent = (props: P) => (
    <ComponentStateProvider defaults={defaultConfig}>
      <Component {...props} />
    </ComponentStateProvider>
  );

  WrappedComponent.displayName = `withComponentState(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

/**
 * Export performance metrics for monitoring
 * Note: Metrics are tracked internally within the ComponentStateProvider
 * This function is deprecated and will be removed in a future version
 * @deprecated Use the performanceMonitoring prop instead
 */
export const getComponentStateMetrics = () => {
  return createInitialMetrics();
};