# Design Tokens - Clean Light Theme

This document outlines the design tokens and utility classes for the clean light theme transformation.

## Color System

### Brand Colors
- `brand-primary`: #000000 - Pure black for primary text and elements
- `brand-secondary`: #6C6C6C - Muted gray for secondary text

### Neutral Scale (Primary for Light Theme)
```css
neutral-50:  #FAFBFC   /* Lightest background */
neutral-100: #F9FAFB   /* Card/surface backgrounds */
neutral-150: #F4F6F8   /* Subtle contrast backgrounds */
neutral-200: #E5E7EB   /* Light borders and dividers */
neutral-300: #D1D5DB   /* Medium borders */
neutral-400: #9CA3AF   /* Placeholder text */
neutral-500: #6B7280   /* Body text secondary */
neutral-600: #4B5563   /* Body text primary */
neutral-700: #374151   /* Headings */
neutral-800: #1F2937   /* Dark text */
neutral-900: #111827   /* Darkest text */
```

### Semantic Colors
Each semantic color has a 50 (light background) and main accent color:

**Success (Green)**
- `success-50`: #E9FCEB (Light backgrounds)
- `success-500`: #3CCF4E (Primary action color)

**Info (Blue)**
- `info-50`: #EEF3FD (Light backgrounds)
- `info-500`: #5B8DEF (Primary action color)

**Warning (Yellow)**
- `warning-50`: #FFFBEB (Light backgrounds)
- `warning-500`: #FFCC00 (Primary action color)

**Error (Red)**
- `error-50`: #FFECEC (Light backgrounds)
- `error-500`: #FF6B6B (Primary action color)

**Accent (Purple)**
- `accent-50`: #F2EFFF (Light backgrounds)
- `accent-500`: #A28CFF (Primary action color)

## Typography

### Font Sizes with Built-in Line Heights
```css
text-xs:   12px / 16px (line-height)
text-sm:   14px / 20px
text-base: 16px / 24px
text-lg:   18px / 28px
text-xl:   20px / 30px
text-2xl:  24px / 36px
text-3xl:  32px / 48px
```

### Font Weights
```css
font-normal:    400
font-medium:    500
font-semibold:  600
font-bold:      700
```

### Text Color Utilities
```css
.text-primary:    neutral-900  /* Main headings and important text */
.text-secondary:  neutral-600  /* Secondary text and descriptions */
.text-tertiary:   neutral-500  /* Tertiary information */
.text-muted:      neutral-400  /* Placeholder and disabled text */
```

## Shadows

Carefully designed shadow system for clean depth:

```css
shadow-card:         0px 2px 6px rgba(0, 0, 0, 0.05)     /* Subtle card elevation */
shadow-card-hover:   0px 4px 10px rgba(0, 0, 0, 0.08)    /* Card hover state */
shadow-modal:        0px 10px 25px rgba(0, 0, 0, 0.1)    /* Modal overlay */
shadow-sidebar:      2px 0px 8px rgba(0, 0, 0, 0.04)     /* Sidebar depth */
shadow-button:       0px 1px 3px rgba(0, 0, 0, 0.1)      /* Button depth */
shadow-button-hover: 0px 2px 6px rgba(0, 0, 0, 0.15)     /* Button hover */
shadow-dropdown:     0px 4px 12px rgba(0, 0, 0, 0.1)     /* Dropdown menus */
```

## Border Radius

```css
rounded-sm:   4px   /* Small elements (tags, badges) */
rounded:      6px   /* Default inputs, buttons */
rounded-md:   8px   /* Cards, panels */
rounded-lg:   12px  /* Large cards, modals */
rounded-xl:   16px  /* Hero sections */
rounded-full: 50%   /* Pills, avatars */
```

## Component Classes

### Sidebar
```css
.sidebar-clean        /* White background with subtle border */
.sidebar-item         /* Clean nav item styling */
.sidebar-item.active  /* Active state with background highlight */
```

### Cards
```css
.card-clean           /* Basic white card with border and shadow */
.card-clean-hover     /* Card with hover effects */
```

### Buttons
```css
.btn-primary      /* Black button with white text */
.btn-secondary    /* White button with border */
.btn-ghost        /* Transparent button for subtle actions */
```

### Inputs
```css
.input-clean      /* Clean input with focus states */
```

### Status Badges
```css
.badge-success    /* Green success badge */
.badge-info       /* Blue info badge */
.badge-warning    /* Yellow warning badge */
.badge-error      /* Red error badge */
.badge-accent     /* Purple accent badge */
```

### Layout Utilities
```css
.divider-horizontal   /* Horizontal divider line */
.divider-vertical     /* Vertical divider line */
.skeleton            /* Loading skeleton animation */
.progress-bar        /* Progress container */
.progress-fill       /* Progress fill bar */
```

## Usage Guidelines

### Sidebar Transformation
Replace dark slate sidebar backgrounds with:
```css
/* OLD: bg-slate-800 text-slate-100 */
/* NEW: */
bg-white border-r border-neutral-200 text-neutral-600
```

### Card Components
Replace gray card backgrounds with:
```css
/* OLD: bg-gray-100 */
/* NEW: */
bg-white border border-neutral-200 shadow-card
```

### Text Hierarchy
Use semantic text classes for consistent hierarchy:
```css
/* Headings */     .text-primary
/* Body text */    .text-secondary
/* Captions */     .text-tertiary
/* Placeholder */  .text-muted
```

### Interactive States
All interactive elements should use consistent transitions:
```css
transition-all duration-200
```

## Accessibility Notes

- All color combinations meet WCAG AA contrast ratios (4.5:1+)
- Focus states use `ring-2 ring-info-500 ring-offset-2`
- Selection uses `bg-info-100 text-info-800`
- Consistent spacing based on 8px grid system

## Examples

### Clean Sidebar Item
```tsx
<div className="sidebar-item">
  <Icon className="w-5 h-5 text-neutral-500" />
  <span className="ml-3 text-sm font-medium">Dashboard</span>
</div>
```

### Clean Card Component
```tsx
<div className="card-clean-hover p-6">
  <h3 className="text-lg font-semibold text-primary">Card Title</h3>
  <p className="text-secondary mt-2">Card description text</p>
</div>
```

### Status Badge
```tsx
<span className="badge-success">Active</span>
<span className="badge-warning">Pending</span>
```