/**
 * Component State Animation Framework
 *
 * Integrates component state management with premium animations and
 * transition coordination for optimal performance and accessibility.
 */

import { usePremiumAnimations } from '../../hooks/usePremiumAnimations';
import { useTransitionCoordination } from '../../hooks/useTransitionCoordination';
import {
  ComponentState,
  ComponentVariant,
  AnimationSpeed,
  StateTransition
} from '../../types/componentState';
import { logger } from '../../utils/logger';

// Animation mapping for component states
export const STATE_ANIMATIONS: Record<ComponentState, {
  enter: string;
  exit: string;
  loop?: string;
}> = {
  idle: {
    enter: 'fadeInUp',
    exit: 'fadeInUp' // Will be reversed
  },
  loading: {
    enter: 'pulse',
    exit: 'fadeInUp',
    loop: 'shimmer'
  },
  error: {
    enter: 'shake',
    exit: 'fadeInUp'
  },
  success: {
    enter: 'checkmark',
    exit: 'fadeInUp'
  },
  disabled: {
    enter: 'fadeInUp', // Subtle entrance
    exit: 'fadeInUp'
  },
  pending: {
    enter: 'pulse',
    exit: 'fadeInUp'
  }
};

// Variant-specific animation modifications
export const VARIANT_ANIMATION_MODIFIERS: Record<ComponentVariant, {
  durationMultiplier: number;
  easingOverride?: string;
  extraEffects?: string[];
}> = {
  primary: {
    durationMultiplier: 1.0,
    extraEffects: ['liftUp']
  },
  secondary: {
    durationMultiplier: 0.9,
    easingOverride: 'ease-out'
  },
  tertiary: {
    durationMultiplier: 0.8
  },
  danger: {
    durationMultiplier: 1.1,
    extraEffects: ['shake']
  },
  success: {
    durationMultiplier: 1.2,
    extraEffects: ['checkmark', 'bounce']
  },
  ghost: {
    durationMultiplier: 0.7
  },
  'matrix-safe': {
    durationMultiplier: 0.8,
    easingOverride: 'ease-out'
  },
  sapphire: {
    durationMultiplier: 1.0,
    extraEffects: ['shimmer']
  },
  warning: {
    durationMultiplier: 1.0,
    extraEffects: ['pulse']
  }
};

// Animation performance configurations
export const ANIMATION_PERFORMANCE_CONFIG: Record<AnimationSpeed, {
  baseDuration: number;
  easing: string;
  performanceLevel: 'low' | 'medium' | 'high';
}> = {
  fast: {
    baseDuration: 150,
    easing: 'cubic-bezier(0.4, 0.0, 1, 1)',
    performanceLevel: 'high'
  },
  normal: {
    baseDuration: 200,
    easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    performanceLevel: 'medium'
  },
  slow: {
    baseDuration: 300,
    easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    performanceLevel: 'low'
  }
};

/**
 * Advanced component state animation controller
 */
export interface ComponentStateAnimationController {
  /** Execute state transition with optimized animations */
  executeStateTransition: (
    element: HTMLElement,
    fromState: ComponentState,
    toState: ComponentState,
    variant: ComponentVariant,
    speed: AnimationSpeed
  ) => Promise<void>;

  /** Apply variant-specific hover animations */
  applyHoverAnimation: (
    element: HTMLElement,
    variant: ComponentVariant,
    isEntering: boolean
  ) => void;

  /** Create loading state animation loop */
  createLoadingLoop: (
    element: HTMLElement,
    variant: ComponentVariant
  ) => () => void;

  /** Apply accessibility-compliant animations */
  applyAccessibleAnimation: (
    element: HTMLElement,
    animationType: string,
    options?: { respectReducedMotion?: boolean }
  ) => void;

  /** Performance-adaptive animation selection */
  getOptimalAnimation: (
    baseAnimation: string,
    currentPerformance: { fps: number; droppedFrames: number }
  ) => string;

  /** Cleanup all component animations */
  cleanup: () => void;
}

/**
 * Hook for enhanced component state animations
 */
export const useComponentStateAnimations = (): ComponentStateAnimationController => {
  const premiumAnimations = usePremiumAnimations();
  const transitionCoordination = useTransitionCoordination({
    enablePerformanceMonitoring: true,
    autoCleanupWillChange: true,
    debounceMs: 16
  });

  const executeStateTransition = async (
    element: HTMLElement,
    fromState: ComponentState,
    toState: ComponentState,
    variant: ComponentVariant,
    speed: AnimationSpeed
  ): Promise<void> => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let isResolved = false;
      let timeoutId: NodeJS.Timeout | null = null;

      // Prevent multiple resolutions
      const safeResolve = () => {
        if (isResolved) return;
        isResolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        transitionCoordination.endTransition();
        resolve();
      };

      // Get base animation configuration
      const animationConfig = STATE_ANIMATIONS[toState];
      const variantModifier = VARIANT_ANIMATION_MODIFIERS[variant];
      const performanceConfig = ANIMATION_PERFORMANCE_CONFIG[speed];

      if (!animationConfig) {
        logger.warn('No animation configuration found for state:', toState);
        safeResolve();
        return;
      }

      // Calculate optimized duration
      const baseDuration = performanceConfig.baseDuration;
      const finalDuration = baseDuration * variantModifier.durationMultiplier;

      // Select easing function
      const easing = variantModifier.easingOverride || performanceConfig.easing;

      // Check performance and adjust if needed
      const currentPerformance = transitionCoordination.transitionState.performance;
      const shouldUseReducedAnimation = currentPerformance.fps < 45 ||
                                       !premiumAnimations.isAnimationEnabled;

      if (shouldUseReducedAnimation) {
        // Use simpler animation for performance with proper timing
        const reducedDuration = finalDuration * 0.5;
        const reducedAnimation = premiumAnimations.animateCustom(element, [
          { opacity: 0.8 },
          { opacity: 1 }
        ], {
          duration: reducedDuration,
          easing: 'ease-out'
        });

        if (reducedAnimation) {
          reducedAnimation.addEventListener('finish', () => {
            const endTime = performance.now();
            logger.debug('Reduced state transition completed', {
              fromState,
              toState,
              variant,
              actualDuration: endTime - startTime
            });
            safeResolve();
          });

          // Fallback for reduced animation - more generous timeout
          timeoutId = setTimeout(() => {
            if (!isResolved) {
              logger.debug('Reduced animation fallback timeout', {
                fromState,
                toState,
                duration: reducedDuration
              });
              safeResolve();
            }
          }, reducedDuration + 200);
        } else {
          // No animation available, immediate resolve
          safeResolve();
        }
        return;
      }

      // Start transition coordination
      transitionCoordination.startTransition();

      // Execute main animation
      const animation = premiumAnimations.animate(
        element,
        animationConfig.enter as any,
        {
          duration: finalDuration,
          easing
        }
      );

      if (!animation) {
        logger.debug('Animation creation failed, falling back to immediate transition', {
          fromState,
          toState
        });
        safeResolve();
        return;
      }

      // Apply variant-specific extra effects
      if (variantModifier.extraEffects) {
        variantModifier.extraEffects.forEach((effect, index) => {
          setTimeout(() => {
            premiumAnimations.animate(element, effect as any, {
              duration: finalDuration * 0.8,
              delay: index * 50
            });
          }, finalDuration * 0.3);
        });
      }

      // Handle animation completion
      animation.addEventListener('finish', () => {
        const endTime = performance.now();
        const actualDuration = endTime - startTime;

        logger.debug('State transition animation completed', {
          fromState,
          toState,
          variant,
          speed,
          plannedDuration: finalDuration,
          actualDuration,
          performanceDelta: actualDuration - finalDuration
        });

        safeResolve();
      });

      // Handle animation cancellation/errors
      animation.addEventListener('cancel', () => {
        logger.debug('State transition animation cancelled', {
          fromState,
          toState
        });
        safeResolve();
      });

      // Reasonable fallback timeout - account for browser rendering delays
      const timeoutBuffer = Math.max(finalDuration * 0.5, 300); // At least 300ms buffer
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          logger.warn('State transition animation timeout', {
            fromState,
            toState,
            duration: finalDuration,
            timeoutAfter: finalDuration + timeoutBuffer,
            possibleCause: 'Browser performance or animation conflict'
          });
          safeResolve();
        }
      }, finalDuration + timeoutBuffer);
    });
  };

  const applyHoverAnimation = (
    element: HTMLElement,
    variant: ComponentVariant,
    isEntering: boolean
  ) => {
    if (!premiumAnimations.isAnimationEnabled) return;

    const variantModifier = VARIANT_ANIMATION_MODIFIERS[variant];
    const duration = 200 * variantModifier.durationMultiplier;

    if (isEntering) {
      premiumAnimations.animate(element, 'liftUp', {
        duration,
        fillMode: 'forwards'
      });
    } else {
      premiumAnimations.animateCustom(element, [
        { transform: 'translateY(-2px) scale(1.02)' },
        { transform: 'translateY(0) scale(1)' }
      ], {
        duration: duration * 0.8,
        easing: 'ease-out',
        fillMode: 'forwards'
      });
    }
  };

  const createLoadingLoop = (
    element: HTMLElement,
    variant: ComponentVariant
  ): (() => void) => {
    if (!premiumAnimations.isAnimationEnabled) {
      return () => {};
    }

    let isActive = true;
    const variantModifier = VARIANT_ANIMATION_MODIFIERS[variant];

    const runLoop = () => {
      if (!isActive) return;

      const animation = premiumAnimations.animate(element, 'pulse', {
        duration: 1000 * variantModifier.durationMultiplier,
        iterations: 1
      });

      if (animation) {
        animation.addEventListener('finish', () => {
          if (isActive) {
            setTimeout(runLoop, 100);
          }
        });
      }
    };

    runLoop();

    return () => {
      isActive = false;
    };
  };

  const applyAccessibleAnimation = (
    element: HTMLElement,
    animationType: string,
    options: { respectReducedMotion?: boolean } = {}
  ) => {
    const { respectReducedMotion = true } = options;

    // Check accessibility preferences
    if (respectReducedMotion && !premiumAnimations.isAnimationEnabled) {
      // Apply reduced motion alternative
      element.style.transition = 'opacity 0.2s ease-out';
      element.style.opacity = '1';
      return;
    }

    // Apply full animation
    premiumAnimations.animate(element, animationType as any, {
      duration: 300,
      easing: 'ease-out'
    });
  };

  const getOptimalAnimation = (
    baseAnimation: string,
    currentPerformance: { fps: number; droppedFrames: number }
  ): string => {
    // Performance-based animation selection
    if (currentPerformance.fps < 30 || currentPerformance.droppedFrames > 10) {
      // Use minimal animations for poor performance
      return 'fadeInUp';
    } else if (currentPerformance.fps < 45) {
      // Use medium complexity animations
      return baseAnimation === 'bounce' ? 'scaleIn' : baseAnimation;
    }

    // Use full animation for good performance
    return baseAnimation;
  };

  const cleanup = () => {
    premiumAnimations.cleanup();
  };

  return {
    executeStateTransition,
    applyHoverAnimation,
    createLoadingLoop,
    applyAccessibleAnimation,
    getOptimalAnimation,
    cleanup
  };
};

/**
 * Utility function to create state transition
 */
export const createStateTransition = (
  fromState: ComponentState,
  toState: ComponentState,
  duration: number = 200,
  easing: string = 'ease-out'
): StateTransition => {
  return {
    from: fromState,
    to: toState,
    duration,
    easing,
    onComplete: undefined
  };
};

/**
 * Performance-optimized state animation presets
 */
export const OPTIMIZED_STATE_PRESETS = {
  // Fast, minimal animations for low-end devices
  minimal: {
    idle: 'fadeInUp',
    loading: 'pulse',
    error: 'shake',
    success: 'scaleIn',
    disabled: 'fadeInUp',
    pending: 'pulse'
  },

  // Balanced animations for mid-range devices
  balanced: {
    idle: 'fadeInUp',
    loading: 'shimmer',
    error: 'shake',
    success: 'checkmark',
    disabled: 'fadeInUp',
    pending: 'pulse'
  },

  // Rich animations for high-end devices
  premium: {
    idle: 'slideInRight',
    loading: 'shimmer',
    error: 'wiggle',
    success: 'checkmark',
    disabled: 'fadeInUp',
    pending: 'pulse'
  }
};

export default useComponentStateAnimations;