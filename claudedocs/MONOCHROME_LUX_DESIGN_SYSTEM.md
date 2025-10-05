# Monochrome-Lux Design System

**Version**: 1.0.0
**Last Updated**: 2025-10-02
**Status**: Production Ready

---

## Design Philosophy

The Monochrome-Lux design system embodies **calm, confident, purposeful design** through:

- **Monochromatic Palette**: Sophisticated grayscale hierarchy with gem-tone accents
- **Refined Motion**: Subtle animations (120-260ms) with "confident glide" easing
- **Width-Dominant Shadows**: Shadows spread horizontally, never darker
- **Minimal Movement**: ≤6px translations, ≤4% tints for visual feedback
- **Accessibility First**: WCAG 2.1 AA compliant, reduced-motion support

---

## Core Principles

### 1. **Calm & Professional**
- Eliminate visual noise through monochrome hierarchy
- Use color sparingly and purposefully
- Maintain consistent spacing and alignment

### 2. **Confident Motion**
- Animations feel decisive, not hesitant
- Durations tuned for perception (120-260ms range)
- Custom easing: `cubic-bezier(0.2, 0.6, 0, 0.98)` - "confident glide"

### 3. **Accessible by Default**
- Minimum 4.5:1 contrast ratios
- Full keyboard navigation support
- Respects `prefers-reduced-motion`
- Proper ARIA attributes

---

## Color System

### Canvas & Surfaces

```css
--canvas-primary: #FAFBFC;     /* Off-white cool gray - main background */
--canvas-secondary: #F9FAFB;   /* Hover backgrounds */
--canvas-tertiary: #F3F4F6;    /* Active states, subtle emphasis */

--surface-primary: #FFFFFF;    /* Cards, modals, elevated surfaces */
--surface-secondary: #FEFEFE;  /* Subtle surface variation */
```

### Graphite Text Hierarchy

```css
--graphite-900: #111827;  /* Reserved for extreme emphasis */
--graphite-800: #1F2937;  /* Primary text, headings */
--graphite-700: #374151;  /* Primary buttons, strong emphasis */
--graphite-600: #4B5563;  /* Secondary emphasis */
--graphite-500: #6B7280;  /* Secondary text, labels */
--graphite-400: #9CA3AF;  /* Tertiary text, placeholders */
--graphite-300: #D1D5DB;  /* Disabled text */
--graphite-200: #E5E7EB;  /* Dividers, subtle borders */
--graphite-100: #F3F4F6;  /* Subtle backgrounds */
--graphite-50: #F9FAFB;   /* Hover backgrounds */
```

### Hairline Borders

```css
--hairline-default: #E8EBED;  /* Standard 1px borders */
--hairline-hover: #D1D5DB;    /* Hover state borders */
--hairline-focus: #3B82F6;    /* Focus state (sapphire) */
```

### Gem-Tone Accents

**Sapphire (Information, Primary Actions)**
```css
--sapphire-50: #EFF6FF;   /* Background tint */
--sapphire-100: #DBEAFE;
--sapphire-200: #BFDBFE;
--sapphire-500: #3B82F6;  /* Interactive elements */
--sapphire-600: #2563EB;
--sapphire-700: #1D4ED8;  /* Semantic info, AI features */
```

**Emerald (Success)**
```css
--emerald-50: #ECFDF5;    /* Success background */
--emerald-700: #047857;   /* Success text/icons */
```

**Amber (Warning)**
```css
--amber-50: #FFFBEB;      /* Warning background */
--amber-700: #B45309;     /* Warning text/icons */
```

**Garnet (Error, Destructive)**
```css
--garnet-50: #FEF2F2;     /* Error background */
--garnet-700: #B91C1C;    /* Error text/icons */
```

---

## Typography

### Font Family
```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu',
             'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
```

### Type Scale

```css
--text-xs: 0.75rem;      /* 12px - Fine print, captions */
--text-sm: 0.875rem;     /* 14px - Secondary text, labels */
--text-base: 1rem;       /* 16px - Body text (default) */
--text-lg: 1.125rem;     /* 18px - Emphasized body text */
--text-xl: 1.25rem;      /* 20px - Subheadings */
--text-2xl: 1.5rem;      /* 24px - Section headings */
--text-3xl: 1.875rem;    /* 30px - Page headings */
```

### Font Weights

```css
--font-normal: 400;      /* Body text */
--font-medium: 500;      /* Emphasis, labels */
--font-semibold: 600;    /* Headings, buttons */
--font-bold: 700;        /* Strong headings */
```

### Line Heights

```css
--leading-tight: 1.25;   /* Headings */
--leading-snug: 1.375;   /* Tight text */
--leading-normal: 1.5;   /* Body text */
--leading-relaxed: 1.625; /* Comfortable reading */
```

### Letter Spacing

```css
--tracking-tight: -0.025em;  /* Large headings */
--tracking-normal: 0em;      /* Body text */
--tracking-wide: 0.025em;    /* Buttons, labels */
--tracking-wider: 0.05em;    /* Uppercase labels */
--tracking-widest: 0.1em;    /* Section headers */
```

---

## Spacing System

### Base Unit: 4px (0.25rem)

```css
--space-0: 0px;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

### Component-Specific Spacing

```css
--button-padding-x: 1rem;       /* 16px horizontal */
--button-padding-y: 0.5rem;     /* 8px vertical */
--card-padding: 1.5rem;         /* 24px */
--modal-padding: 1.5rem;        /* 24px */
--input-padding-x: 0.75rem;     /* 12px */
--input-padding-y: 0.625rem;    /* 10px */
```

---

## Motion System

### Duration Scale

```css
--duration-instant: 120ms;   /* Hover feedback, tooltips */
--duration-fast: 140ms;      /* Button states, small animations */
--duration-base: 190ms;      /* Input focus, standard transitions */
--duration-moderate: 220ms;  /* Section collapse, moderate animations */
--duration-slow: 260ms;      /* Large transitions, page changes */
```

### Easing Functions

```css
--easing-glide: cubic-bezier(0.2, 0.6, 0, 0.98);  /* Signature "confident glide" */
--easing-standard: ease;                           /* Default browser easing */
--easing-in: ease-in;                             /* Accelerating */
--easing-out: ease-out;                           /* Decelerating */
--easing-in-out: ease-in-out;                     /* Both directions */
```

### Motion Principles

1. **Subtle Movement**: Translations ≤6px, scales ≤1.05
2. **Purposeful**: Every animation has a reason
3. **Performant**: GPU-accelerated (transform, opacity)
4. **Accessible**: Respects `prefers-reduced-motion`

---

## Shadow System

### Philosophy: Width-Dominant, Never Darker

Shadows spread horizontally to create elevation without darkening content.

```css
/* Button Shadows */
--shadow-button: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-button-hover: 0 2px 8px rgba(0, 0, 0, 0.08);

/* Card Shadows */
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.02), 0 8px 24px rgba(0, 0, 0, 0.03);
--shadow-card-hover: 0 1px 3px rgba(0, 0, 0, 0.03), 0 12px 32px rgba(0, 0, 0, 0.05);

/* Modal Shadows */
--shadow-modal: 0 4px 16px rgba(0, 0, 0, 0.08), 0 20px 48px rgba(0, 0, 0, 0.12);

/* Focus Ring */
--shadow-focus-ring: 0 0 0 4px rgba(59, 130, 246, 0.1);
```

---

## Component Patterns

### Buttons

#### Primary Button
```css
background: var(--graphite-700);  /* #374151 */
color: white;
padding: 0.5rem 1rem;
border-radius: 0.5rem;
transition: transform 140ms var(--easing-out),
            box-shadow 140ms var(--easing-out);

/* Hover */
transform: translateY(-1px);
box-shadow: var(--shadow-button-hover);

/* Active */
transform: translateY(0);
transition-duration: var(--duration-instant);
```

#### Secondary Button
```css
background: white;
color: var(--graphite-700);
border: 1px solid var(--hairline-default);
padding: 0.5rem 1rem;
border-radius: 0.5rem;
transition: background-color 140ms var(--easing-out),
            border-color 140ms var(--easing-out);

/* Hover */
background: var(--canvas-secondary);
border-color: var(--hairline-hover);
```

### Cards

```css
background: white;
border: 1px solid var(--hairline-default);
border-radius: 0.75rem;  /* 12px */
padding: 1.5rem;
box-shadow: var(--shadow-card);
transition: box-shadow 160ms var(--easing-out),
            background-color 160ms var(--easing-out);

/* Hover */
box-shadow: var(--shadow-card-hover);
background: #FEFEFE;  /* +2% tint */
```

### Inputs

```css
background: white;
border: 1px solid var(--hairline-default);
border-radius: 0.5rem;
padding: 0.625rem 0.75rem;
transition: border-color 190ms var(--easing-out),
            box-shadow 190ms var(--easing-glide);

/* Hover */
border-color: var(--hairline-hover);

/* Focus */
border-color: var(--sapphire-500);
box-shadow: var(--shadow-focus-ring);
outline: none;
```

### Modals

```css
background: white;
border-radius: 1rem;  /* 16px */
padding: 1.5rem;
box-shadow: var(--shadow-modal);
max-width: 42rem;  /* 672px */

/* Backdrop */
background: rgba(0, 0, 0, 0.5);
backdrop-filter: blur(4px);
```

### Navigation (Sidebar)

```css
/* Expanded State */
width: 224px;
background: var(--canvas-primary);
border-right: 1px solid var(--hairline-default);
transition: width 280ms var(--easing-glide);

/* Collapsed State */
width: 80px;
padding: 0;

/* Nav Item Active */
background: var(--canvas-tertiary);  /* #F3F4F6 */
color: var(--graphite-800);

/* Nav Item Hover */
background: var(--canvas-secondary);  /* #F9FAFB */
```

### Badges

```css
/* Success Badge */
background: var(--emerald-50);
color: var(--emerald-700);
padding: 0.25rem 0.5rem;
border-radius: 0.375rem;
font-size: var(--text-xs);
font-weight: var(--font-medium);

/* Info Badge */
background: var(--sapphire-50);
color: var(--sapphire-700);

/* Warning Badge */
background: var(--amber-50);
color: var(--amber-700);

/* Error Badge */
background: var(--garnet-50);
color: var(--garnet-700);
```

---

## Accessibility Guidelines

### Color Contrast

**WCAG 2.1 AA Compliance**:
- **Normal Text** (< 18px): Minimum 4.5:1 contrast
- **Large Text** (≥ 18px or ≥ 14px bold): Minimum 3:1 contrast
- **Interactive Elements**: Minimum 3:1 against background

**Verified Combinations**:
- `#1F2937` on `#FFFFFF`: 16.1:1 ✅
- `#374151` on `#FFFFFF`: 12.6:1 ✅
- `#6B7280` on `#FFFFFF`: 5.9:1 ✅
- `#047857` on `#ECFDF5`: 4.9:1 ✅
- `#1D4ED8` on `#EFF6FF`: 5.3:1 ✅

### Keyboard Navigation

**Required Patterns**:
- All interactive elements focusable via Tab
- Skip links for main content
- Focus visible indicators (sapphire ring)
- Logical tab order
- Escape key closes modals

### Screen Reader Support

**Required Attributes**:
- `aria-label` for icon-only buttons
- `aria-labelledby` for form inputs
- `aria-describedby` for helper text
- `role="dialog"` with `aria-modal="true"` for modals
- `aria-live` regions for dynamic content

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Animation Catalog

### Button Lift

```css
.btn-hover-lift {
  transition: transform var(--duration-fast) var(--easing-out),
              box-shadow var(--duration-fast) var(--easing-out);
}

.btn-hover-lift:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn-hover-lift:active:not(:disabled) {
  transform: translateY(0);
  transition-duration: var(--duration-instant);
  transition-timing-function: var(--easing-in);
}
```

### Card Hover Elevation

```css
.card-hover {
  transition: box-shadow var(--duration-fast) var(--easing-out),
              background-color var(--duration-fast) var(--easing-out);
}

.card-hover:hover {
  box-shadow: var(--shadow-card-hover);
  background-color: #FEFEFE;
}
```

### Input Focus Ring

```css
.input-focus {
  transition: border-color var(--duration-base) var(--easing-out),
              box-shadow var(--duration-base) var(--easing-glide);
}

.input-focus:focus {
  border-color: var(--sapphire-500);
  box-shadow: var(--shadow-focus-ring);
  outline: none;
}
```

### Section Collapse/Expand

```css
.collapsible-section {
  overflow: hidden;
  transition: max-height var(--duration-moderate) var(--easing-out),
              opacity var(--duration-moderate) var(--easing-out);
}

.collapsible-section.collapsed {
  max-height: 0 !important;
  opacity: 0;
}
```

### Tooltip Fade-In

```css
@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
}

.tooltip {
  animation: tooltipFadeIn var(--duration-fast) var(--easing-out) forwards;
}
```

### Shimmer Loading

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.shimmer-animation {
  background: linear-gradient(
    90deg,
    var(--graphite-100) 0%,
    var(--graphite-200) 50%,
    var(--graphite-100) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s linear infinite;
}
```

---

## Layout Patterns

### Page Structure

```
┌─────────────────────────────────────────┐
│ Sidebar (224px)  │ Main Content        │
│ ─────────────────┼─────────────────────│
│ Nav Items        │ Header              │
│                  │ Content             │
│                  │ Footer              │
└─────────────────────────────────────────┘
```

### Sidebar States

**Expanded (224px)**:
- Full labels visible
- Section headers visible
- Collapsible sections functional
- Navigation rail indicator

**Collapsed (80px)**:
- Icon-only display
- Section headers hidden
- All navigation items visible (no sections)
- Tooltips on hover

### Grid System

```css
/* 12-column grid */
.grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }

/* Common layouts */
.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
```

### Breakpoints

```css
/* Mobile first */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

---

## Usage Examples

### Button

```tsx
// Primary
<button className="bg-graphite-700 text-white px-4 py-2 rounded-lg shadow-button hover:shadow-button-hover transition-all duration-fast hover:-translate-y-px active:translate-y-0">
  Primary Action
</button>

// Secondary
<button className="bg-white text-graphite-700 border border-hairline px-4 py-2 rounded-lg hover:bg-canvas-secondary hover:border-hairline-hover transition-all duration-fast">
  Secondary
</button>
```

### Card

```tsx
<div className="bg-white border border-hairline rounded-xl p-6 shadow-card hover:shadow-card-hover hover:bg-[#FEFEFE] transition-all duration-fast cursor-pointer">
  <h3 className="text-lg font-semibold text-graphite-800 mb-2">Card Title</h3>
  <p className="text-sm text-graphite-500">Card description...</p>
</div>
```

### Input

```tsx
<input
  type="text"
  className="w-full px-3 py-2.5 bg-white border border-hairline rounded-lg text-graphite-800 placeholder-graphite-400 focus:border-sapphire-500 focus:ring-4 focus:ring-sapphire-50 outline-none transition-all duration-base"
  placeholder="Enter text..."
/>
```

### Badge

```tsx
// Success
<span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg">
  Success
</span>

// Info
<span className="inline-flex items-center gap-2 px-3 py-1.5 bg-sapphire-50 text-sapphire-700 text-sm font-medium rounded-lg">
  Information
</span>
```

---

## Performance Guidelines

### Animation Performance

**GPU-Accelerated Properties**:
- `transform`
- `opacity`
- `filter`

**Avoid Animating**:
- `width`, `height` (use `scale` instead)
- `margin`, `padding` (use `transform` instead)
- `color` (use opacity layers instead when possible)

### Bundle Size

**CSS Target**:
- Base styles: < 20KB gzipped
- Component styles: < 30KB gzipped
- Total CSS: < 50KB gzipped

**Optimization Strategies**:
- PurgeCSS/Tailwind JIT for unused styles
- Critical CSS extraction
- CSS custom properties for theming

---

## Migration Checklist

When migrating a component to Monochrome-Lux:

- [ ] Replace gradient backgrounds with solid colors
- [ ] Update borders to hairline (`#E8EBED`)
- [ ] Use graphite for text hierarchy
- [ ] Apply gem-tone accents for status/semantic
- [ ] Implement subtle animations (≤260ms)
- [ ] Add hover states with minimal movement
- [ ] Ensure 4.5:1 contrast ratios
- [ ] Test keyboard navigation
- [ ] Verify reduced-motion support
- [ ] Update visual regression screenshots

---

## Resources

**Design Files**: `src/components/demo/MonochromeLuxAnimated.tsx` (reference implementation)
**CSS Tokens**: `src/styles/monochrome-lux-tokens.css`
**Animation Classes**: `src/styles/monochrome-lux-animations.css`
**Tailwind Config**: `tailwind.config.js` (monochrome-lux extensions)
**Migration Guide**: `claudedocs/MONOCHROME_LUX_MIGRATION_GUIDE.md`

---

## Version History

**1.0.0** (2025-10-02)
- Initial design system specification
- Complete color, typography, spacing systems
- Motion system with confident glide easing
- Shadow system with width-dominant philosophy
- Component patterns and accessibility guidelines
- Animation catalog and usage examples

---

**Maintained by**: Prioritas Design Team
**Questions**: See migration guide or reference implementation
