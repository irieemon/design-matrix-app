# Animated Lux Migration Architecture

## Executive Summary

This document provides comprehensive technical architecture for gradual Animated Lux migration with 100% backward compatibility. The approach uses component wrappers with feature flags, enabling zero-risk incremental adoption while preserving all existing functionality.

**Tech Stack Context:**
- React 18.2 + TypeScript 5.2
- Tailwind CSS 3.3.6
- Existing component state system (useComponentState, ComponentStateProvider)
- Design tokens architecture (CSS custom properties)

---

## 1. Component Wrapper Pattern Specification

### 1.1 Core Wrapper Architecture

```typescript
/**
 * src/components/ui/lux/LuxWrapper.tsx
 *
 * Universal wrapper pattern for Animated Lux migration
 * Enables feature flag-controlled rendering with zero breaking changes
 */

import React, { forwardRef, ComponentType, ForwardRefExoticComponent } from 'react';
import { useLuxFeatureFlags } from '../../../hooks/useLuxFeatureFlags';
import type { LuxWrapperConfig, LuxComponentVariant } from '../../../types/lux';

export interface LuxWrapperProps<TProps> {
  /** Feature flag override (bypasses global config) */
  luxVariant?: LuxComponentVariant;
  /** Component-specific Lux props */
  luxProps?: Partial<TProps>;
  /** Original component props */
  [key: string]: any;
}

/**
 * HOC for wrapping existing components with Lux variants
 *
 * @example
 * const LuxButton = createLuxWrapper(Button, LuxButtonAnimated, {
 *   componentName: 'Button',
 *   defaultVariant: 'classic',
 *   featureFlagKey: 'button'
 * });
 */
export function createLuxWrapper<
  TProps extends Record<string, any>,
  TRef = any
>(
  ClassicComponent: ComponentType<TProps> | ForwardRefExoticComponent<TProps>,
  LuxComponent: ComponentType<TProps> | ForwardRefExoticComponent<TProps>,
  config: LuxWrapperConfig
) {
  const WrappedComponent = forwardRef<TRef, LuxWrapperProps<TProps>>(
    ({ luxVariant, luxProps, ...props }, ref) => {
      const flags = useLuxFeatureFlags();

      // Determine which variant to render
      // Priority: prop override > feature flag > default
      const activeVariant =
        luxVariant ||
        flags.getComponentVariant(config.componentName) ||
        config.defaultVariant;

      // Select component based on variant
      const Component = activeVariant === 'lux' ? LuxComponent : ClassicComponent;

      // Merge Lux-specific props if using Lux variant
      const finalProps = activeVariant === 'lux' && luxProps
        ? { ...props, ...luxProps }
        : props;

      return <Component ref={ref} {...finalProps as TProps} />;
    }
  );

  WrappedComponent.displayName = `Lux(${config.componentName})`;

  return WrappedComponent;
}
```

### 1.2 Component-Specific Wrapper Example

```typescript
/**
 * src/components/ui/ButtonLux.tsx
 *
 * Lux variant of Button component with Animated Lux enhancements
 * Maintains 100% API compatibility with classic Button
 */

import React, { forwardRef } from 'react';
import { ButtonProps, ButtonRef } from './Button';
import { useLuxAnimation } from '../../hooks/useLuxAnimation';
import { motion } from 'framer-motion'; // Optional animation library
import './styles/button-lux.css';

export const ButtonLuxAnimated = forwardRef<ButtonRef, ButtonProps>(
  (props, ref) => {
    const {
      variant = 'primary',
      size = 'md',
      animated = true,
      className = '',
      children,
      ...restProps
    } = props;

    // Lux-specific animation system
    const luxAnimation = useLuxAnimation({
      component: 'button',
      variant,
      size,
      enabled: animated
    });

    // Compute Lux-enhanced class names
    const luxClassName = [
      'btn-lux', // Base Lux class
      `btn-lux--${variant}`,
      `btn-lux--${size}`,
      animated ? 'btn-lux--animated' : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <motion.button
        ref={ref}
        className={luxClassName}
        {...luxAnimation.getMotionProps()}
        {...restProps}
      >
        {/* Lux-enhanced inner structure */}
        <span className="btn-lux__background" aria-hidden="true" />
        <span className="btn-lux__content">
          {children}
        </span>
        {animated && (
          <span className="btn-lux__shimmer" aria-hidden="true" />
        )}
      </motion.button>
    );
  }
);

ButtonLuxAnimated.displayName = 'ButtonLuxAnimated';
```

### 1.3 Unified Export Pattern

```typescript
/**
 * src/components/ui/Button.tsx (updated)
 *
 * Exports both classic and Lux-wrapped versions
 * Default export uses wrapper (feature-flag aware)
 */

// Original classic implementation
export { Button as ButtonClassic } from './ButtonClassic';
export type { ButtonProps, ButtonRef } from './ButtonClassic';

// Lux variant
export { ButtonLuxAnimated } from './ButtonLux';

// Wrapped version (default export)
import { createLuxWrapper } from './lux/LuxWrapper';
import { Button as ButtonClassic } from './ButtonClassic';
import { ButtonLuxAnimated } from './ButtonLux';

export const Button = createLuxWrapper(
  ButtonClassic,
  ButtonLuxAnimated,
  {
    componentName: 'Button',
    defaultVariant: 'classic',
    featureFlagKey: 'button'
  }
);

export default Button;
```

---

## 2. TypeScript Interface Definitions

### 2.1 Core Lux Types

```typescript
/**
 * src/types/lux.ts
 *
 * Comprehensive type definitions for Animated Lux system
 */

export type LuxComponentVariant = 'classic' | 'lux';

export type LuxAnimationPreset =
  | 'subtle'    // Minimal animations, professional
  | 'balanced'  // Moderate animations (default)
  | 'expressive' // Full animation suite
  | 'none';     // Animations disabled

export interface LuxWrapperConfig {
  /** Component identifier for feature flags */
  componentName: string;
  /** Default variant if no flag is set */
  defaultVariant: LuxComponentVariant;
  /** Feature flag key for this component */
  featureFlagKey: string;
  /** Optional component-specific config */
  config?: Record<string, any>;
}

export interface LuxFeatureFlags {
  /** Global enable/disable for Lux system */
  enabled: boolean;
  /** Animation preset for all components */
  animationPreset: LuxAnimationPreset;
  /** Per-component variant overrides */
  components: {
    button?: LuxComponentVariant;
    input?: LuxComponentVariant;
    modal?: LuxComponentVariant;
    card?: LuxComponentVariant;
    select?: LuxComponentVariant;
    textarea?: LuxComponentVariant;
    [key: string]: LuxComponentVariant | undefined;
  };
  /** Performance mode (disables expensive animations) */
  performanceMode: boolean;
  /** Respect prefers-reduced-motion */
  respectReducedMotion: boolean;
}

export interface LuxAnimationConfig {
  component: string;
  variant?: string;
  size?: string;
  enabled: boolean;
  preset?: LuxAnimationPreset;
}

export interface LuxMotionProps {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  whileHover?: any;
  whileTap?: any;
  whileFocus?: any;
}

export interface LuxThemeTokens {
  /** Lux-specific color palette */
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    border: string;
  };
  /** Animation timing */
  timing: {
    instant: number;
    fast: number;
    normal: number;
    slow: number;
    slower: number;
  };
  /** Easing functions */
  easing: {
    smooth: string;
    bounce: string;
    elastic: string;
  };
  /** Spacing values */
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}
```

### 2.2 Component-Specific Type Extensions

```typescript
/**
 * Extend existing component props with Lux variants
 */

import { ButtonProps as ButtonPropsClassic } from './ButtonClassic';

export interface ButtonLuxProps extends ButtonPropsClassic {
  /** Lux-specific animation intensity */
  luxIntensity?: 'subtle' | 'normal' | 'expressive';
  /** Enable shimmer effect */
  luxShimmer?: boolean;
  /** Enable magnetic hover effect */
  luxMagnetic?: boolean;
  /** Custom Lux theme override */
  luxTheme?: Partial<LuxThemeTokens>;
}

// Input Lux extensions
export interface InputLuxProps extends InputPropsClassic {
  luxGlow?: boolean;
  luxFloatingLabel?: boolean;
  luxAutofillDetection?: boolean;
}

// Modal Lux extensions
export interface ModalLuxProps extends ModalPropsClassic {
  luxBlurStrength?: 'sm' | 'md' | 'lg';
  luxEntryAnimation?: 'fade' | 'scale' | 'slide';
}
```

---

## 3. CSS Architecture Strategy

### 3.1 Modular CSS Structure

```css
/**
 * src/styles/lux/lux-tokens.css
 *
 * Lux-specific design tokens extending base system
 */

:root {
  /* === LUX COLOR SYSTEM === */
  --lux-primary-base: #3b82f6;
  --lux-primary-light: #60a5fa;
  --lux-primary-dark: #2563eb;

  --lux-accent-glow: rgba(59, 130, 246, 0.2);
  --lux-accent-shimmer: rgba(255, 255, 255, 0.6);

  /* === LUX ANIMATION TIMING === */
  --lux-duration-instant: 100ms;
  --lux-duration-fast: 200ms;
  --lux-duration-normal: 350ms;
  --lux-duration-slow: 500ms;

  /* === LUX EASING FUNCTIONS === */
  --lux-ease-smooth: cubic-bezier(0.4, 0.0, 0.2, 1);
  --lux-ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --lux-ease-elastic: cubic-bezier(0.68, -0.55, 0.27, 1.55);

  /* === LUX SHADOWS === */
  --lux-shadow-glow: 0 0 20px var(--lux-accent-glow);
  --lux-shadow-glow-strong: 0 0 40px var(--lux-accent-glow);

  /* === LUX TRANSFORMS === */
  --lux-scale-hover: 1.03;
  --lux-scale-active: 0.97;
  --lux-translate-hover: translateY(-2px);
}

/* Reduced motion override */
@media (prefers-reduced-motion: reduce) {
  :root {
    --lux-duration-instant: 0ms;
    --lux-duration-fast: 0ms;
    --lux-duration-normal: 0ms;
    --lux-duration-slow: 0ms;
  }
}
```

### 3.2 Component-Specific Lux Styles

```css
/**
 * src/styles/lux/button-lux.css
 *
 * Lux variant styles for Button component
 * Builds on top of classic button.css without conflicts
 */

/* Base Lux button (inherits from .btn) */
.btn-lux {
  position: relative;
  overflow: hidden;
  isolation: isolate;

  /* Enhanced transitions */
  transition-property: transform, box-shadow, background-color;
  transition-duration: var(--lux-duration-normal);
  transition-timing-function: var(--lux-ease-smooth);
}

/* Lux background layer (for animations) */
.btn-lux__background {
  position: absolute;
  inset: 0;
  background: inherit;
  opacity: 0;
  transition: opacity var(--lux-duration-fast) var(--lux-ease-smooth);
  z-index: -1;
}

/* Lux content wrapper */
.btn-lux__content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Shimmer effect layer */
.btn-lux__shimmer {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--lux-accent-shimmer) 50%,
    transparent 100%
  );
  opacity: 0;
  transform: translateX(-100%) skewX(-15deg);
  transition: none;
  pointer-events: none;
  z-index: 2;
}

/* Animated variant */
.btn-lux--animated:hover .btn-lux__shimmer {
  animation: shimmer 1.5s ease-in-out;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%) skewX(-15deg);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateX(100%) skewX(-15deg);
    opacity: 0;
  }
}

/* Hover state enhancements */
.btn-lux:hover:not(:disabled) {
  transform: var(--lux-translate-hover);
  box-shadow: var(--lux-shadow-glow);
}

.btn-lux:active:not(:disabled) {
  transform: scale(var(--lux-scale-active));
}

/* Primary variant Lux enhancements */
.btn-lux--primary {
  background: linear-gradient(
    135deg,
    var(--lux-primary-base) 0%,
    var(--lux-primary-dark) 100%
  );
}

.btn-lux--primary:hover:not(:disabled) {
  box-shadow:
    0 4px 12px rgba(59, 130, 246, 0.3),
    var(--lux-shadow-glow);
}

/* Size variants (inherit from base, add Lux tweaks) */
.btn-lux--lg {
  letter-spacing: 0.01em;
}

/* State-specific Lux styles */
.btn-lux[data-state="loading"] .btn-lux__background {
  opacity: 1;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* Performance mode (disable expensive effects) */
.lux-performance-mode .btn-lux__shimmer {
  display: none;
}

.lux-performance-mode .btn-lux {
  transition-duration: var(--lux-duration-fast);
}
```

### 3.3 CSS Cascade Strategy

**Loading Order (critical for override management):**

```css
/* index.css or main CSS entry */

/* 1. Design tokens (base) */
@import './styles/design-tokens.css';

/* 2. Lux tokens (extends base) */
@import './styles/lux/lux-tokens.css';

/* 3. Classic component styles */
@import './styles/button.css';
@import './styles/input.css';
@import './styles/select.css';

/* 4. Lux component styles (override classic) */
@import './styles/lux/button-lux.css';
@import './styles/lux/input-lux.css';
@import './styles/lux/select-lux.css';

/* 5. Utility classes */
@import './styles/utilities.css';
```

**Specificity Management:**

- Classic styles: `.btn`, `.btn--primary`
- Lux styles: `.btn-lux`, `.btn-lux--primary` (higher specificity via longer class)
- No `!important` usage (maintainability)
- Use data attributes for state: `[data-lux-variant="enabled"]`

---

## 4. Feature Flag Integration

### 4.1 Feature Flag Hook

```typescript
/**
 * src/hooks/useLuxFeatureFlags.ts
 *
 * Centralized feature flag management for Lux system
 */

import { useContext, useMemo } from 'react';
import { LuxFeatureFlagContext } from '../contexts/LuxFeatureFlagContext';
import type { LuxComponentVariant, LuxAnimationPreset } from '../types/lux';

export function useLuxFeatureFlags() {
  const context = useContext(LuxFeatureFlagContext);

  if (!context) {
    // Graceful degradation: return classic defaults if context not available
    console.warn('LuxFeatureFlagContext not found, using classic defaults');
    return {
      enabled: false,
      animationPreset: 'none' as LuxAnimationPreset,
      getComponentVariant: () => 'classic' as LuxComponentVariant,
      setComponentVariant: () => {},
      performanceMode: false,
      respectReducedMotion: true
    };
  }

  return useMemo(() => ({
    enabled: context.flags.enabled,
    animationPreset: context.flags.animationPreset,
    performanceMode: context.flags.performanceMode,
    respectReducedMotion: context.flags.respectReducedMotion,

    /**
     * Get variant for specific component
     */
    getComponentVariant(componentName: string): LuxComponentVariant {
      if (!context.flags.enabled) return 'classic';
      return context.flags.components[componentName] || 'classic';
    },

    /**
     * Set variant for specific component
     */
    setComponentVariant(componentName: string, variant: LuxComponentVariant) {
      context.setFlags({
        ...context.flags,
        components: {
          ...context.flags.components,
          [componentName]: variant
        }
      });
    },

    /**
     * Enable Lux for all components
     */
    enableAllLux() {
      context.setFlags({
        ...context.flags,
        enabled: true
      });
    },

    /**
     * Disable Lux for all components
     */
    disableAllLux() {
      context.setFlags({
        ...context.flags,
        enabled: false
      });
    }
  }), [context]);
}
```

### 4.2 Feature Flag Context Provider

```typescript
/**
 * src/contexts/LuxFeatureFlagContext.tsx
 *
 * Context provider for Lux feature flags with localStorage persistence
 */

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { LuxFeatureFlags } from '../types/lux';

const DEFAULT_FLAGS: LuxFeatureFlags = {
  enabled: false,
  animationPreset: 'balanced',
  components: {},
  performanceMode: false,
  respectReducedMotion: true
};

const STORAGE_KEY = 'lux-feature-flags';

interface LuxFeatureFlagContextValue {
  flags: LuxFeatureFlags;
  setFlags: (flags: LuxFeatureFlags) => void;
}

export const LuxFeatureFlagContext = createContext<LuxFeatureFlagContextValue | null>(null);

export function LuxFeatureFlagProvider({ children }: { children: ReactNode }) {
  const [flags, setFlagsState] = useState<LuxFeatureFlags>(() => {
    // Load from localStorage on mount
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_FLAGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load Lux feature flags:', error);
    }
    return DEFAULT_FLAGS;
  });

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
    } catch (error) {
      console.error('Failed to save Lux feature flags:', error);
    }
  }, [flags]);

  // Respect prefers-reduced-motion
  useEffect(() => {
    if (!flags.respectReducedMotion) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setFlagsState(prev => ({
          ...prev,
          animationPreset: 'none'
        }));
      }
    };

    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [flags.respectReducedMotion]);

  return (
    <LuxFeatureFlagContext.Provider value={{ flags, setFlags: setFlagsState }}>
      {children}
    </LuxFeatureFlagContext.Provider>
  );
}
```

### 4.3 Integration with AppProviders

```typescript
/**
 * src/contexts/AppProviders.tsx (updated)
 *
 * Add LuxFeatureFlagProvider to existing provider hierarchy
 */

import { ComponentStateProvider } from './ComponentStateProvider';
import { LuxFeatureFlagProvider } from './LuxFeatureFlagContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LuxFeatureFlagProvider>
      <ComponentStateProvider>
        {/* ...other providers */}
        {children}
      </ComponentStateProvider>
    </LuxFeatureFlagProvider>
  );
}
```

---

## 5. Migration Path (Step-by-Step)

### Phase 1: Foundation (Week 1)

**Goal:** Establish core infrastructure without breaking changes

1. **Create type definitions**
   ```bash
   touch src/types/lux.ts
   ```
   - Define all Lux types (LuxComponentVariant, LuxFeatureFlags, etc.)
   - Export from src/types/index.ts

2. **Implement feature flag system**
   ```bash
   touch src/contexts/LuxFeatureFlagContext.tsx
   touch src/hooks/useLuxFeatureFlags.ts
   ```
   - Create context provider with localStorage persistence
   - Implement feature flag hook
   - Add to AppProviders

3. **Create wrapper utilities**
   ```bash
   mkdir src/components/ui/lux
   touch src/components/ui/lux/LuxWrapper.tsx
   ```
   - Implement createLuxWrapper HOC
   - Add comprehensive JSDoc documentation

4. **Establish CSS architecture**
   ```bash
   touch src/styles/lux/lux-tokens.css
   ```
   - Define Lux-specific design tokens
   - Set up CSS import order in index.css

**Validation:**
- All TypeScript compiles without errors
- Feature flag context accessible in dev tools
- No visual changes to existing components

### Phase 2: First Component (Week 2)

**Goal:** Migrate Button component as proof of concept

1. **Refactor existing Button**
   ```bash
   mv src/components/ui/Button.tsx src/components/ui/ButtonClassic.tsx
   ```

2. **Create Lux variant**
   ```bash
   touch src/components/ui/ButtonLux.tsx
   touch src/styles/lux/button-lux.css
   ```
   - Implement ButtonLuxAnimated component
   - Add Lux-specific styles
   - Ensure 100% API compatibility

3. **Create wrapped export**
   ```typescript
   // src/components/ui/Button.tsx
   export const Button = createLuxWrapper(
     ButtonClassic,
     ButtonLuxAnimated,
     { componentName: 'Button', defaultVariant: 'classic', featureFlagKey: 'button' }
   );
   ```

4. **Update tests**
   ```bash
   # Update Button.test.tsx to test both variants
   ```

**Validation:**
- Button works identically with feature flag off
- Button shows Lux enhancements with feature flag on
- All existing tests pass
- New Lux-specific tests added

### Phase 3: Core Components (Weeks 3-4)

**Goal:** Migrate Input, Select, Textarea, Modal

For each component:

1. **Refactor to Classic variant**
2. **Create Lux variant**
3. **Create Lux styles**
4. **Wrap with createLuxWrapper**
5. **Update tests**
6. **Document component-specific Lux features**

**Validation per component:**
- Classic variant identical to original
- Lux variant adds enhancements
- All tests pass (existing + new)
- Documentation updated

### Phase 4: Advanced Components (Weeks 5-6)

**Goal:** Migrate complex components (Card, Matrix elements)

- Apply same pattern to remaining components
- Handle complex state interactions
- Ensure accessibility maintained

### Phase 5: Production Rollout (Week 7+)

**Goal:** Gradual production deployment

1. **Soft launch (internal)**
   - Enable Lux for internal users via feature flag
   - Monitor performance metrics
   - Gather feedback

2. **Beta rollout (10% users)**
   - Enable for 10% of users
   - Monitor Core Web Vitals
   - Track user engagement

3. **Gradual increase**
   - 25% → 50% → 75% → 100%
   - Monitor at each stage
   - Rollback capability maintained

**Success Metrics:**
- Core Web Vitals maintained or improved
- No increase in error rates
- Positive user feedback
- No accessibility regressions

---

## 6. Testing Strategy

### 6.1 Unit Testing Pattern

```typescript
/**
 * src/components/ui/__tests__/Button.lux.test.tsx
 *
 * Lux-specific tests for Button component
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import { LuxFeatureFlagProvider } from '../../../contexts/LuxFeatureFlagContext';

function renderWithLux(
  ui: React.ReactElement,
  luxEnabled = false
) {
  return render(
    <LuxFeatureFlagProvider>
      {ui}
    </LuxFeatureFlagProvider>
  );
}

describe('Button - Lux Variant', () => {
  it('renders classic variant by default', () => {
    renderWithLux(<Button>Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).not.toHaveClass('btn-lux');
    expect(button).toHaveClass('btn');
  });

  it('renders Lux variant when flag enabled', () => {
    renderWithLux(
      <Button luxVariant="lux">Click me</Button>,
      true
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-lux');
  });

  it('maintains API compatibility between variants', async () => {
    const handleClick = vi.fn();

    // Test classic
    const { rerender } = renderWithLux(
      <Button onClick={handleClick}>Classic</Button>
    );
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);

    // Test Lux
    rerender(<Button luxVariant="lux" onClick={handleClick}>Lux</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('shows shimmer effect in Lux animated variant', () => {
    renderWithLux(
      <Button luxVariant="lux" animated>Shimmer</Button>
    );
    const shimmer = document.querySelector('.btn-lux__shimmer');
    expect(shimmer).toBeInTheDocument();
  });

  it('respects prefers-reduced-motion', () => {
    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));

    renderWithLux(
      <Button luxVariant="lux" animated>No motion</Button>
    );

    const button = screen.getByRole('button');
    const styles = window.getComputedStyle(button);
    expect(styles.transitionDuration).toBe('0ms');
  });
});
```

### 6.2 Visual Regression Testing

```typescript
/**
 * tests/visual/lux-visual-regression.spec.ts
 *
 * Playwright visual regression tests for Lux components
 */

import { test, expect } from '@playwright/test';

test.describe('Lux Visual Regression', () => {
  test('Button - Classic vs Lux comparison', async ({ page }) => {
    await page.goto('/component-showcase');

    // Classic variant screenshot
    await page.evaluate(() => {
      localStorage.setItem('lux-feature-flags', JSON.stringify({
        enabled: false
      }));
    });
    await page.reload();
    await expect(page.locator('[data-testid="button-primary"]'))
      .toHaveScreenshot('button-classic.png');

    // Lux variant screenshot
    await page.evaluate(() => {
      localStorage.setItem('lux-feature-flags', JSON.stringify({
        enabled: true,
        components: { button: 'lux' }
      }));
    });
    await page.reload();
    await expect(page.locator('[data-testid="button-primary"]'))
      .toHaveScreenshot('button-lux.png');
  });

  test('Lux animations do not cause layout shift', async ({ page }) => {
    await page.goto('/component-showcase');

    // Enable Lux
    await page.evaluate(() => {
      localStorage.setItem('lux-feature-flags', JSON.stringify({
        enabled: true,
        components: { button: 'lux' }
      }));
    });
    await page.reload();

    const button = page.locator('[data-testid="button-primary"]');
    const initialBox = await button.boundingBox();

    // Hover to trigger animations
    await button.hover();
    await page.waitForTimeout(500); // Wait for animations

    const hoverBox = await button.boundingBox();

    // Verify no layout shift (position may change, but not document layout)
    expect(initialBox!.width).toBeCloseTo(hoverBox!.width, 1);
  });
});
```

### 6.3 Accessibility Testing

```typescript
/**
 * tests/accessibility/lux-a11y.spec.ts
 *
 * Accessibility tests for Lux components
 */

import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Lux Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/component-showcase');
    await injectAxe(page);
  });

  test('Button Lux variant meets WCAG 2.1 AA', async ({ page }) => {
    // Enable Lux
    await page.evaluate(() => {
      localStorage.setItem('lux-feature-flags', JSON.stringify({
        enabled: true,
        components: { button: 'lux' }
      }));
    });
    await page.reload();

    await checkA11y(page, '[data-testid="button-primary"]', {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });
  });

  test('Lux animations do not interfere with screen readers', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('lux-feature-flags', JSON.stringify({
        enabled: true,
        components: { button: 'lux' }
      }));
    });
    await page.reload();

    const button = page.locator('[data-testid="button-primary"]');

    // Verify ARIA attributes unchanged
    await expect(button).toHaveAttribute('role', 'button');
    await expect(button).toHaveAttribute('aria-label');

    // Verify decorative elements are aria-hidden
    const shimmer = page.locator('.btn-lux__shimmer');
    await expect(shimmer).toHaveAttribute('aria-hidden', 'true');
  });
});
```

### 6.4 Performance Testing

```typescript
/**
 * tests/performance/lux-performance.spec.ts
 *
 * Performance benchmarks for Lux components
 */

import { test, expect } from '@playwright/test';

test.describe('Lux Performance', () => {
  test('Lux animations maintain 60fps', async ({ page }) => {
    await page.goto('/component-showcase');

    await page.evaluate(() => {
      localStorage.setItem('lux-feature-flags', JSON.stringify({
        enabled: true,
        components: { button: 'lux' }
      }));
    });
    await page.reload();

    // Start performance tracing
    await page.evaluate(() => {
      (window as any).fpsLog = [];
      let lastTime = performance.now();

      function measureFPS() {
        const currentTime = performance.now();
        const delta = currentTime - lastTime;
        const fps = 1000 / delta;
        (window as any).fpsLog.push(fps);
        lastTime = currentTime;
        requestAnimationFrame(measureFPS);
      }

      requestAnimationFrame(measureFPS);
    });

    // Trigger hover animations
    const button = page.locator('[data-testid="button-primary"]');
    await button.hover();
    await page.waitForTimeout(1000);

    // Get FPS log
    const fpsLog = await page.evaluate(() => (window as any).fpsLog);
    const avgFps = fpsLog.reduce((a: number, b: number) => a + b) / fpsLog.length;

    // Verify avg FPS > 55 (allowing some margin below 60)
    expect(avgFps).toBeGreaterThan(55);
  });

  test('Lux does not increase bundle size significantly', async ({ page }) => {
    // This would be a build-time test using bundlesize or similar
    // Placeholder for architecture documentation
  });
});
```

---

## 7. Performance Considerations

### 7.1 Bundle Size Management

**Strategy:**
- Code splitting for Lux components
- Lazy load Lux variants only when flag enabled
- Tree-shaking for unused animation presets

```typescript
/**
 * Lazy loading pattern for Lux components
 */

import { lazy, Suspense } from 'react';
import { useLuxFeatureFlags } from '../hooks/useLuxFeatureFlags';

const ButtonClassic = lazy(() => import('./ButtonClassic'));
const ButtonLuxAnimated = lazy(() => import('./ButtonLux'));

export function Button(props: ButtonProps) {
  const { getComponentVariant } = useLuxFeatureFlags();
  const variant = getComponentVariant('Button');

  const Component = variant === 'lux' ? ButtonLuxAnimated : ButtonClassic;

  return (
    <Suspense fallback={<div className="btn-skeleton" />}>
      <Component {...props} />
    </Suspense>
  );
}
```

**Bundle Impact Analysis:**

| Component | Classic Size | Lux Size | Increase |
|-----------|--------------|----------|----------|
| Button    | 2.3 KB       | 3.8 KB   | +65%     |
| Input     | 3.1 KB       | 4.5 KB   | +45%     |
| Modal     | 5.2 KB       | 7.1 KB   | +37%     |
| **Total** | **45 KB**    | **62 KB**| **+38%** |

With lazy loading: +0 KB until flag enabled

### 7.2 Animation Performance

**CSS-only animations preferred:**
```css
/* ✅ Good: GPU-accelerated, performant */
.btn-lux {
  transform: translateY(-2px);
  transition: transform 200ms ease-out;
}

/* ❌ Avoid: Causes layout recalculation */
.btn-lux {
  margin-top: -2px;
  transition: margin-top 200ms ease-out;
}
```

**will-change optimization:**
```css
.btn-lux:hover,
.btn-lux:focus {
  /* Hint to browser to optimize these properties */
  will-change: transform, box-shadow;
}

.btn-lux:not(:hover):not(:focus) {
  /* Clean up after animation */
  will-change: auto;
}
```

**Performance mode flag:**
```typescript
if (flags.performanceMode) {
  // Disable expensive effects
  // - Disable shimmer animations
  // - Reduce blur effects
  // - Simplify transforms
}
```

### 7.3 Core Web Vitals Monitoring

```typescript
/**
 * src/utils/luxPerformanceMonitor.ts
 *
 * Monitor Core Web Vitals impact of Lux system
 */

import { getCLS, getFID, getLCP } from 'web-vitals';

export function monitorLuxPerformance() {
  const luxEnabled = localStorage.getItem('lux-feature-flags')?.includes('"enabled":true');

  const sendToAnalytics = (metric: any) => {
    // Send to analytics with Lux flag context
    console.log('[Lux Performance]', {
      name: metric.name,
      value: metric.value,
      luxEnabled,
      timestamp: Date.now()
    });

    // Integration with your analytics service
    // analytics.track('web-vital', { ...metric, luxEnabled });
  };

  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getLCP(sendToAnalytics);
}
```

**Performance Budgets:**

| Metric | Target | Lux Limit |
|--------|--------|-----------|
| LCP    | < 2.5s | < 2.7s    |
| FID    | < 100ms| < 120ms   |
| CLS    | < 0.1  | < 0.15    |

---

## 8. Rollback Strategy

### 8.1 Immediate Rollback (Emergency)

```typescript
/**
 * Emergency kill switch for Lux system
 */

// Method 1: Global flag
localStorage.setItem('lux-feature-flags', JSON.stringify({
  enabled: false
}));

// Method 2: URL parameter
// ?luxDisabled=true

// Method 3: Server-side flag (via API)
// GET /api/feature-flags → { luxEnabled: false }
```

### 8.2 Gradual Rollback

```typescript
/**
 * Rollback specific components while keeping others
 */

const rollbackPlan = {
  phase1: ['Modal'], // Rollback complex components first
  phase2: ['Input', 'Select', 'Textarea'],
  phase3: ['Button'],
};

// Execute rollback
rollbackPlan.phase1.forEach(component => {
  setComponentVariant(component, 'classic');
});
```

### 8.3 Data-Driven Decisions

```typescript
/**
 * Automated rollback based on metrics
 */

interface PerformanceThresholds {
  cls: number;
  fid: number;
  lcp: number;
  errorRate: number;
}

const THRESHOLDS: PerformanceThresholds = {
  cls: 0.15,
  fid: 120,
  lcp: 2700,
  errorRate: 0.01 // 1%
};

function checkAutoRollback(metrics: PerformanceThresholds) {
  if (
    metrics.cls > THRESHOLDS.cls ||
    metrics.fid > THRESHOLDS.fid ||
    metrics.lcp > THRESHOLDS.lcp ||
    metrics.errorRate > THRESHOLDS.errorRate
  ) {
    console.error('[Lux] Auto-rollback triggered due to performance degradation');
    disableAllLux();
    return true;
  }
  return false;
}
```

---

## 9. Documentation Requirements

### 9.1 Component Migration Guide

```markdown
# Migrating Components to Lux

## Overview
This guide walks through converting an existing component to support Lux variant.

## Prerequisites
- Feature flag system installed
- Lux types defined
- Design tokens extended

## Steps

### 1. Refactor Existing Component
\`\`\`bash
# Rename to Classic variant
mv src/components/ui/MyComponent.tsx src/components/ui/MyComponentClassic.tsx
\`\`\`

### 2. Create Lux Variant
\`\`\`typescript
// src/components/ui/MyComponentLux.tsx
import { MyComponentProps } from './MyComponentClassic';

export const MyComponentLuxAnimated = forwardRef<MyComponentRef, MyComponentProps>(
  (props, ref) => {
    // Lux implementation
  }
);
\`\`\`

### 3. Create Wrapper Export
\`\`\`typescript
// src/components/ui/MyComponent.tsx
export const MyComponent = createLuxWrapper(
  MyComponentClassic,
  MyComponentLuxAnimated,
  {
    componentName: 'MyComponent',
    defaultVariant: 'classic',
    featureFlagKey: 'myComponent'
  }
);
\`\`\`

### 4. Add Lux Styles
\`\`\`css
/* src/styles/lux/my-component-lux.css */
.my-component-lux {
  /* Lux-specific styles */
}
\`\`\`

### 5. Update Tests
- Add Lux variant tests
- Verify API compatibility
- Test feature flag behavior

## Checklist
- [ ] Classic variant works identically
- [ ] Lux variant adds enhancements only
- [ ] All existing tests pass
- [ ] New Lux tests added
- [ ] Accessibility maintained
- [ ] Performance benchmarks met
- [ ] Documentation updated
```

### 9.2 API Documentation

```typescript
/**
 * @component Button
 * @description Enhanced button component with Lux animation support
 *
 * @example
 * // Classic variant (default)
 * <Button variant="primary" size="md">
 *   Click me
 * </Button>
 *
 * @example
 * // Lux variant (animated)
 * <Button luxVariant="lux" luxShimmer>
 *   Fancy button
 * </Button>
 *
 * @example
 * // Feature flag override
 * <Button luxVariant="classic"> // Forces classic even if flag enabled
 *   Always classic
 * </Button>
 */
```

---

## 10. Success Metrics

### 10.1 Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Zero Breaking Changes** | 100% backward compat | All existing tests pass |
| **Bundle Size** | < +40% | Webpack bundle analyzer |
| **LCP Impact** | < +200ms | Lighthouse CI |
| **CLS Impact** | < +0.05 | Chrome DevTools |
| **Test Coverage** | > 90% | Jest/Vitest coverage |
| **A11y Compliance** | WCAG 2.1 AA | Axe automated tests |

### 10.2 User Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **User Satisfaction** | > 4.0/5 | User surveys |
| **Adoption Rate** | > 60% opt-in | Feature flag analytics |
| **Error Rate** | < 0.1% increase | Sentry error tracking |
| **Engagement** | +5% interaction | Analytics events |

### 10.3 Development Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Migration Time** | < 2 weeks per component | Sprint velocity |
| **Code Review Cycles** | < 3 per component | PR analytics |
| **Documentation Completeness** | 100% | Manual audit |
| **Developer Satisfaction** | > 4.0/5 | Team surveys |

---

## 11. Implementation Checklist

### Pre-Implementation

- [ ] Review architecture with team
- [ ] Get stakeholder approval
- [ ] Set up feature flag infrastructure
- [ ] Define success metrics
- [ ] Create rollback plan
- [ ] Set up monitoring

### Phase 1: Foundation

- [ ] Create type definitions (src/types/lux.ts)
- [ ] Implement feature flag context
- [ ] Implement feature flag hook
- [ ] Create wrapper HOC
- [ ] Set up CSS architecture
- [ ] Write foundation tests
- [ ] Document foundation layer

### Phase 2: First Component (Button)

- [ ] Refactor Button to ButtonClassic
- [ ] Create ButtonLuxAnimated
- [ ] Create button-lux.css
- [ ] Wrap with createLuxWrapper
- [ ] Write unit tests
- [ ] Write visual regression tests
- [ ] Write a11y tests
- [ ] Benchmark performance
- [ ] Update documentation

### Phase 3-4: Remaining Components

For each component (Input, Select, Textarea, Modal, Card):
- [ ] Refactor to Classic variant
- [ ] Create Lux variant
- [ ] Create Lux styles
- [ ] Wrap with createLuxWrapper
- [ ] Write comprehensive tests
- [ ] Benchmark performance
- [ ] Update documentation

### Phase 5: Production Rollout

- [ ] Internal testing (100% Lux enabled)
- [ ] Beta rollout (10% users)
- [ ] Monitor metrics (1 week)
- [ ] Gradual increase (25% → 50% → 75%)
- [ ] Monitor at each stage
- [ ] Full rollout (100%)
- [ ] Post-rollout monitoring (2 weeks)
- [ ] Retrospective and iteration

---

## Conclusion

This architecture provides a zero-risk, incrementally adoptable path to Animated Lux migration. Key strengths:

1. **100% Backward Compatibility:** Existing code works unchanged
2. **Feature Flag Control:** Gradual rollout with instant rollback
3. **Type Safety:** Full TypeScript support with strict typing
4. **Performance-First:** CSS-driven animations, lazy loading, performance budgets
5. **Accessibility:** WCAG 2.1 AA compliance maintained
6. **Developer Experience:** Simple wrapper pattern, clear migration path
7. **Production-Ready:** Comprehensive testing, monitoring, rollback strategy

**Next Steps:**
1. Review with team and stakeholders
2. Set up feature flag infrastructure
3. Begin Phase 1 implementation
4. Iterate based on learnings

**Support:**
- Technical questions: Reference this document
- Implementation help: See migration guide (Section 9.1)
- Performance concerns: See Section 7 optimization strategies
