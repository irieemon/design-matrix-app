/**
 * Enhanced Component State System Types
 *
 * Unified type definitions for component state management across the application.
 * Follows S-tier SaaS dashboard standards with systematic state patterns.
 */

export type ComponentVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'sapphire'   // AI/Interactive/Information features - ANIMATED LUX
  | 'success'
  | 'warning'    // Demo/Caution features - ANIMATED LUX
  | 'danger'
  | 'ghost'
  | 'matrix-safe';

export type ComponentState =
  | 'idle'
  | 'loading'
  | 'error'
  | 'disabled'
  | 'success'
  | 'pending';

export type ComponentSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl';

export type AnimationSpeed =
  | 'fast'
  | 'normal'
  | 'slow';

export interface ComponentStateConfig {
  /** Visual variant of the component */
  variant: ComponentVariant;
  /** Current interaction state */
  state: ComponentState;
  /** Size variant */
  size: ComponentSize;
  /** Enable state transition animations */
  animated: boolean;
  /** Animation speed preset */
  animationSpeed: AnimationSpeed;
  /** Custom loading text for loading states */
  loadingText?: string;
  /** Error message for error states */
  errorMessage?: string;
  /** Success message for success states */
  successMessage?: string;
}

export interface StateTransition {
  /** Previous state */
  from: ComponentState;
  /** New state */
  to: ComponentState;
  /** Transition duration in milliseconds */
  duration: number;
  /** Transition easing function */
  easing: string;
  /** Optional callback when transition completes */
  onComplete?: () => void;
}

export interface ComponentStateContextValue {
  /** Current component state configuration */
  config: ComponentStateConfig;
  /** Update component state with optional target element for animations */
  setState: (state: ComponentState, targetElement?: HTMLElement) => void;
  /** Update component variant */
  setVariant: (variant: ComponentVariant) => void;
  /** Update component size */
  setSize: (size: ComponentSize) => void;
  /** Update entire configuration */
  updateConfig: (config: Partial<ComponentStateConfig>) => void;
  /** Current state transition (if any) */
  transition: StateTransition | null;
  /** Whether component is currently transitioning */
  isTransitioning: boolean;
  /** Set active element for state transition animations */
  setActiveElement: (element: HTMLElement | null) => void;
  /** Apply hover animation to element */
  applyHoverAnimation: (element: HTMLElement, isEntering: boolean) => void;
  /** Create loading animation loop for element */
  createLoadingLoop: (element: HTMLElement) => () => void;
}

export interface UseComponentStateOptions {
  /** Initial component state configuration */
  initialConfig?: Partial<ComponentStateConfig>;
  /** Enable automatic error recovery */
  autoErrorRecovery?: boolean;
  /** Error recovery timeout in milliseconds */
  errorRecoveryTimeout?: number;
  /** Enable state persistence across re-renders */
  persistState?: boolean;
  /** Custom transition configurations */
  customTransitions?: Partial<Record<ComponentState, StateTransition>>;
}

export interface ComponentStateProviderProps {
  /** Child components */
  children: React.ReactNode;
  /** Global component state defaults */
  defaults?: Partial<ComponentStateConfig>;
  /** Global animation settings */
  globalAnimations?: boolean;
  /** Performance monitoring enabled */
  performanceMonitoring?: boolean;
}

/**
 * State validation utilities
 */
export const isValidState = (state: unknown): state is ComponentState => {
  return typeof state === 'string' &&
    ['idle', 'loading', 'error', 'disabled', 'success', 'pending'].includes(state);
};

export const isValidVariant = (variant: unknown): variant is ComponentVariant => {
  return typeof variant === 'string' &&
    ['primary', 'secondary', 'tertiary', 'sapphire', 'success', 'warning', 'danger', 'ghost', 'matrix-safe'].includes(variant);
};

export const isValidSize = (size: unknown): size is ComponentSize => {
  return typeof size === 'string' &&
    ['xs', 'sm', 'md', 'lg', 'xl'].includes(size);
};

/**
 * Default configurations following brand standards
 */
export const DEFAULT_COMPONENT_STATE: ComponentStateConfig = {
  variant: 'primary',
  state: 'idle',
  size: 'md',
  animated: true,
  animationSpeed: 'normal',
};

export const TRANSITION_PRESETS: Record<AnimationSpeed, { duration: number; easing: string }> = {
  fast: { duration: 150, easing: 'ease-out' },
  normal: { duration: 200, easing: 'ease-in-out' },
  slow: { duration: 300, easing: 'ease-in' },
};

/**
 * Component state CSS class mapping for Tailwind integration
 */
export const STATE_CLASSES: Record<ComponentState, string> = {
  idle: '',
  loading: 'animate-pulse cursor-not-allowed',
  error: 'border-red-500 text-red-600',
  disabled: 'opacity-50 cursor-not-allowed pointer-events-none',
  success: 'border-green-500 text-green-600',
  pending: 'opacity-75',
};

export const VARIANT_CLASSES: Record<ComponentVariant, string> = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  tertiary: 'btn--tertiary',
  sapphire: 'btn--sapphire',
  success: 'btn--success',
  warning: 'btn--warning',
  danger: 'btn--danger',
  ghost: 'btn--ghost',
  'matrix-safe': 'bg-transparent text-slate-900 hover:bg-transparent focus:bg-transparent active:bg-transparent',
};

export const SIZE_CLASSES: Record<ComponentSize, string> = {
  xs: 'btn--xs',
  sm: 'btn--sm',
  md: 'btn--md',
  lg: 'btn--lg',
  xl: 'btn--xl',
};