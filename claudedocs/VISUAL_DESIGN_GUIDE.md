# Visual Design Guide - Monochromatic System

## Color Palette Reference

### Grayscale Foundation

```
■ #FFFFFF  White         - Main surfaces, cards
■ #FAFAFA  Off-White     - Subtle backgrounds
■ #F5F5F5  Light Gray    - Hover states, differentiation
■ #E0E0E0  Border Gray   - Standard borders
■ #D0D0D0  Emphasis Gray - Hover borders
■ #9A9A9A  Placeholder   - Tertiary text
■ #6A6A6A  Secondary     - Body text secondary
■ #4A4A4A  Body Text     - Primary body text
■ #1A1A1A  Near Black    - Headings, emphasis
■ #000000  Pure Black    - Primary CTAs
```

### Functional Accents (Use Sparingly!)

```
🟢 #10B981  Success Green   - Success states, active indicators
🔵 #3B82F6  Info Blue       - Informational badges
🟡 #F59E0B  Warning Amber   - Warning states
🔴 #EF4444  Error Red       - Errors, destructive actions
```

## Typography Hierarchy

```
Display Large    42px / Bold (700)      - Hero sections
Display          36px / Bold (700)      - Major headings
H1               32px / Semibold (600)  - Page titles
H2               28px / Semibold (600)  - Section headings
H3               24px / Semibold (600)  - Subsections
H4               20px / Semibold (600)  - Card titles
H5               18px / Medium (500)    - Small headings
H6               16px / Medium (500)    - Inline headings

Body Large       18px / Regular (400)   - Emphasis body
Body             16px / Regular (400)   - Standard body
Body Small       14px / Regular (400)   - Secondary body

Label            14px / Medium (500)    - Form labels, buttons
Caption          12px / Regular (400)   - Helper text
Overline         11px / Semibold (600)  - Section labels (uppercase)
```

## Shadow System

### Visual Reference
```
shadow-xs:  ▁ Barely visible  - Divider effect
shadow-sm:  ▂ Subtle          - Resting cards
shadow-md:  ▃ Noticeable      - Hover state
shadow-lg:  ▄ Prominent       - Dropdowns, modals
shadow-xl:  ▅ Maximum         - Overlays
```

### Technical Values
```css
--shadow-xs:  0 1px 2px rgba(0,0,0,0.04)
--shadow-sm:  0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-md:  0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)
--shadow-lg:  0 10px 15px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04)
--shadow-xl:  0 20px 25px rgba(0,0,0,0.08), 0 8px 10px rgba(0,0,0,0.04)
```

## Spacing Scale

### 8px Grid System
```
xs:   4px   ▮
sm:   8px   ▮▮
md:   16px  ▮▮▮▮
lg:   24px  ▮▮▮▮▮▮
xl:   32px  ▮▮▮▮▮▮▮▮
2xl:  48px  ▮▮▮▮▮▮▮▮▮▮▮▮
```

### Usage Guidelines
- **4px**: Tight internal spacing (badge padding)
- **8px**: Related elements (icon + text)
- **16px**: Standard component gaps
- **24px**: Section separators
- **32px**: Major section gaps
- **48px**: Page-level spacing

## Border Radius Scale

```
sm:  6px   ⬜ Small elements (badges, small buttons)
md:  8px   ⬜ Standard (buttons, inputs)
lg:  12px  ⬜ Cards, panels
xl:  16px  ⬜ Modals, large containers
```

## Component State Patterns

### Button States
```
Resting:  [Black bg] [White text] [shadow-xs]
Hover:    [Gray-900 bg] [White text] [shadow-sm] [translate-y: -1px]
Active:   [Black bg] [White text] [no shadow] [scale: 0.98]
Focus:    [Black bg] [White text] [ring: 2px gray-900/10]
Disabled: [Gray-100 bg] [Gray-400 text] [no shadow]
```

### Card States
```
Resting:  [White bg] [Gray-200 border] [shadow-sm]
Hover:    [White bg] [Gray-300 border] [shadow-md] [translate-y: -2px]
Active:   [White bg] [Gray-300 border] [shadow-sm] [translate-y: 0]
```

### Input States
```
Resting:  [White bg] [Gray-200 border]
Hover:    [White bg] [Gray-300 border]
Focus:    [White bg] [Gray-900 border] [ring: 3px gray-900/10]
Error:    [White bg] [Red-500 border] [ring: 3px red-500/10]
Disabled: [Gray-50 bg] [Gray-200 border] [Gray-400 text]
```

### Navigation States
```
Resting:  [Transparent bg] [Gray-600 text] [No border-left]
Hover:    [Gray-50 bg] [Gray-900 text] [Gray-200 border-left: 3px]
Active:   [Gray-100 bg] [Black text] [Black border-left: 3px] [font-weight: 500]
```

## Animation Timings

### Speed Scale
```
Instant:  100ms  ⚡ Micro-feedback
Fast:     150ms  ⚡⚡ Icon buttons, toggles
Base:     200ms  ⚡⚡⚡ Standard transitions
Smooth:   250ms  ⚡⚡⚡⚡ Cards, complex transitions
Slow:     300ms  ⚡⚡⚡⚡⚡ Large movements
```

### Easing Functions
```
Standard:    cubic-bezier(0.4, 0, 0.2, 1)  - Default for most
Decelerate:  cubic-bezier(0.0, 0, 0.2, 1)  - Entering elements
Accelerate:  cubic-bezier(0.4, 0, 1, 1)    - Exiting elements
Sharp:       cubic-bezier(0.4, 0, 0.6, 1)  - Quick emphasis
```

## Common Patterns

### Card with Hover
```tsx
<div className="
  bg-white
  border border-gray-200
  rounded-lg
  p-6
  shadow-sm
  hover:shadow-md
  hover:-translate-y-1
  hover:border-gray-300
  transition-all
  duration-250
">
  Content
</div>
```

### Primary Button
```tsx
<button className="
  px-4 py-2
  bg-black
  text-white
  rounded-lg
  font-medium
  shadow-sm
  hover:bg-gray-900
  hover:shadow-md
  hover:-translate-y-0.5
  active:translate-y-0
  active:scale-98
  transition-all
  duration-200
">
  Button Text
</button>
```

### Secondary Button
```tsx
<button className="
  px-4 py-2
  bg-transparent
  border border-gray-200
  text-gray-700
  rounded-lg
  font-medium
  hover:bg-gray-50
  hover:border-gray-300
  active:scale-98
  transition-all
  duration-200
">
  Secondary Action
</button>
```

### Text Input
```tsx
<input className="
  w-full
  px-4 py-2.5
  bg-white
  border border-gray-200
  rounded-lg
  text-gray-900
  placeholder-gray-400
  focus:border-gray-900
  focus:outline-none
  focus:ring-3
  focus:ring-gray-900/10
  hover:border-gray-300
  transition-all
  duration-150
" />
```

### Navigation Item (Active)
```tsx
<button className="
  w-full
  flex items-center
  gap-3
  px-3 py-2.5
  bg-gray-100
  text-black
  border-l-2
  border-black
  rounded-lg
  font-medium
  transition-all
  duration-200
">
  <Icon /> Label
</button>
```

### Modal Container
```tsx
<div className="
  bg-white
  rounded-xl
  shadow-xl
  border border-gray-200
  max-w-md
  w-full
">
  {/* Header with gray-50 bg */}
  <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
    <h3>Modal Title</h3>
  </div>

  {/* Content */}
  <div className="p-6">
    Content
  </div>

  {/* Footer with gray-50 bg */}
  <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
    <button>Actions</button>
  </div>
</div>
```

### Status Badge
```tsx
{/* Success */}
<span className="px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-md border border-green-100">
  Success
</span>

{/* Warning */}
<span className="px-3 py-1.5 bg-amber-50 text-amber-700 text-sm font-medium rounded-md border border-amber-100">
  Warning
</span>

{/* Error */}
<span className="px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-md border border-red-100">
  Error
</span>
```

## Layout Guidelines

### Page Structure
```
┌─────────────────────────────────────┐
│ bg-white p-8                        │  Page container
│  ┌───────────────────────────────┐ │
│  │ max-w-7xl mx-auto             │ │  Content wrapper
│  │  ┌─────────────────────────┐  │ │
│  │  │ Section (mb-8)          │  │ │  Sections
│  │  └─────────────────────────┘  │ │
│  │  ┌─────────────────────────┐  │ │
│  │  │ Section (mb-8)          │  │ │
│  │  └─────────────────────────┘  │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Card Layout
```
┌──────────────────────────┐
│ p-6 (24px padding)       │
│  ┌────────────────────┐  │
│  │ Content            │  │
│  │ gap-4 (16px)       │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ pt-4 border-t      │  │  Footer section
│  └────────────────────┘  │
└──────────────────────────┘
```

## Accessibility Checklist

✅ **Contrast Ratios**
- Body text (gray-600): 4.5:1 minimum ✓
- Headings (gray-900): 7:1+ ✓
- Borders (gray-200): 3:1 for UI elements ✓

✅ **Focus States**
- Visible focus ring on all interactive elements
- 3px ring with 10% opacity for subtle visibility
- Dark gray (gray-900) for high contrast

✅ **Interactive Size**
- Minimum touch target: 44x44px
- Icon buttons: 36x36px minimum
- Text buttons: 32px height minimum

✅ **Motion**
- Respect prefers-reduced-motion
- Animations are subtle and purposeful
- No parallax or excessive motion

## Design Principles

### 1. Simplicity
- Use the minimum color necessary
- One shadow level per component state
- Consistent spacing throughout

### 2. Clarity
- High contrast text on backgrounds
- Clear visual hierarchy
- Purposeful use of color

### 3. Consistency
- Use design tokens (CSS variables)
- Follow the 8px grid
- Maintain timing standards

### 4. Polish
- Smooth transitions everywhere
- Attention to micro-interactions
- Premium feel in details

### 5. Accessibility
- WCAG 2.1 AA compliance minimum
- Keyboard navigation support
- Screen reader friendly

## Common Mistakes to Avoid

❌ **Don't:**
- Use gradients (except in matrix cards)
- Use blue for active navigation states
- Use colored backgrounds for panels
- Create custom spacing values
- Use bouncy or playful animations
- Skip focus states

✅ **Do:**
- Use grayscale for structure
- Use shadows for depth
- Use functional color for status only
- Follow the spacing scale
- Use smooth, subtle animations
- Test all interactive states

## Quick Reference

### Most Common Values
```css
/* Backgrounds */
bg-white         /* Main surfaces */
bg-gray-50       /* Subtle differentiation */
bg-gray-100      /* Active states */

/* Text */
text-gray-900    /* Headings */
text-gray-700    /* Body text */
text-gray-600    /* Secondary text */
text-gray-400    /* Placeholder */

/* Borders */
border-gray-200  /* Standard */
border-gray-300  /* Hover */
border-black     /* Active emphasis */

/* Shadows */
shadow-sm        /* Cards */
shadow-md        /* Hover */
shadow-xl        /* Modals */

/* Spacing */
p-6             /* Card padding (24px) */
gap-4           /* Standard gap (16px) */
mb-8            /* Section margin (32px) */

/* Radius */
rounded-lg      /* Standard (12px) */
rounded-xl      /* Modals (16px) */

/* Transitions */
transition-all duration-200    /* Standard */
transition-all duration-250    /* Smooth */
```

---

**Remember:** This design system prioritizes sophistication, clarity, and professionalism. Every design decision should move away from the "AI app" aesthetic toward a premium, monochromatic tool feel.
