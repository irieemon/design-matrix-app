# Monochromatic Design System Specification
## Premium UI Revamp - Moving Away from AI App Aesthetic

**Created:** 2025-10-02
**Status:** Design Specification
**Scope:** All UI components EXCEPT idea matrix and idea cards

---

## Executive Summary

Transform the application from traditional AI-generated gradient blues/purples to a sophisticated, monochromatic design system inspired by premium task management tools. Focus on clean whites, sophisticated grays, subtle shadows, and functional color accents only for status/feedback.

### Design Philosophy
- **Monochromatic Foundation**: Grayscale as the base with minimal color
- **Functional Color**: Color used purposefully for status/feedback only
- **Premium Feel**: Micro-animations, subtle shadows, polished interactions
- **Sophistication**: Professional tool aesthetic, not "AI app"
- **Breathing Room**: Generous whitespace and clear hierarchy

---

## 🎨 Color System Redesign

### Current Problems
❌ Too many gradient blues/purples throughout the UI
❌ Sidebar uses `from-white to-slate-100` gradients
❌ Active states use `from-blue-50 to-indigo-50` gradients
❌ Project header uses `from-slate-50 to-blue-50` gradient
❌ Buttons use gradient backgrounds
❌ Overall "AI app" aesthetic with too much color

### New Monochromatic Palette

#### Base Grayscale (Primary UI)
```css
/* Backgrounds */
--bg-primary: #FFFFFF        /* Pure white - main surfaces */
--bg-secondary: #FAFAFA      /* Off-white - subtle contrast */
--bg-tertiary: #F5F5F5       /* Light gray - cards, panels */
--bg-elevated: #FFFFFF       /* White with shadow for elevation */

/* Borders & Dividers */
--border-subtle: #EEEEEE     /* Very light borders */
--border-default: #E0E0E0    /* Standard borders */
--border-emphasis: #D0D0D0   /* Emphasized borders */

/* Text Hierarchy */
--text-primary: #1A1A1A      /* Near-black - headings, primary text */
--text-secondary: #4A4A4A    /* Dark gray - body text */
--text-tertiary: #6A6A6A     /* Medium gray - secondary text */
--text-quaternary: #9A9A9A   /* Light gray - tertiary text, placeholders */
--text-disabled: #BFBFBF     /* Disabled text */

/* Interactive States (Grayscale) */
--hover-bg: #FAFAFA          /* Subtle hover backgrounds */
--hover-border: #CCCCCC      /* Hover border emphasis */
--active-bg: #F0F0F0         /* Active/pressed states */
--focus-ring: #666666        /* Focus outline - dark gray */
```

#### Functional Accents (Minimal Usage)
```css
/* Status Colors - Used ONLY for feedback/status */
--status-success: #10B981    /* Success green */
--status-warning: #F59E0B    /* Warning amber */
--status-error: #EF4444      /* Error red */
--status-info: #3B82F6       /* Info blue (minimal use) */

/* Status Backgrounds (Very Subtle) */
--status-success-bg: #F0FDF4
--status-warning-bg: #FFFBEB
--status-error-bg: #FEF2F2
--status-info-bg: #EFF6FF

/* Accent for CTAs (Minimal Use) */
--accent-primary: #000000    /* Black for primary CTAs */
--accent-hover: #1A1A1A      /* Slightly lighter on hover */
```

### Color Usage Rules

**DO:**
- Use grayscale for 95% of the UI
- Use functional colors ONLY for status indicators, badges, alerts
- Use black for primary CTAs
- Use shadows for depth instead of gradients
- Use subtle background changes for hover states

**DON'T:**
- Use gradients (except matrix cards which are excluded)
- Use blue/purple for active navigation states
- Use colored backgrounds for panels/cards
- Use accent colors decoratively

---

## 📝 Typography System

### Current State
✅ Already using Inter font
✅ Good base typography scale
⚠️ Needs refinement for hierarchy

### Enhanced Typography Scale

```css
/* Display - Hero sections */
--text-display-lg: 42px/52px, weight: 700
--text-display: 36px/44px, weight: 700

/* Headings */
--text-h1: 32px/40px, weight: 600
--text-h2: 28px/36px, weight: 600
--text-h3: 24px/32px, weight: 600
--text-h4: 20px/28px, weight: 600
--text-h5: 18px/26px, weight: 500
--text-h6: 16px/24px, weight: 500

/* Body */
--text-body-lg: 18px/28px, weight: 400
--text-body: 16px/24px, weight: 400
--text-body-sm: 14px/20px, weight: 400

/* UI Elements */
--text-label: 14px/20px, weight: 500
--text-caption: 12px/16px, weight: 400
--text-overline: 11px/16px, weight: 600, uppercase, letter-spacing: 0.05em
```

### Typography Usage

**Headings:**
- Use near-black (#1A1A1A) for all headings
- Consistent weight progression (700 → 600 → 500)
- No colored headings except in matrix cards

**Body Text:**
- Primary body: #4A4A4A
- Secondary body: #6A6A6A
- Tertiary/captions: #9A9A9A

**Weight Hierarchy:**
- Bold (700): Display text only
- Semibold (600): H1-H4 headings
- Medium (500): H5-H6, labels, buttons
- Regular (400): Body text, descriptions

---

## 🎯 Shadow System (Replacing Gradients)

### Current Problems
❌ Using gradients for depth
❌ Inconsistent shadow usage
❌ Too heavy in some places

### New Shadow Scale

```css
/* Elevation System - Subtle & Sophisticated */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04)
  /* Subtle divider effect */

--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06),
             0 1px 2px rgba(0, 0, 0, 0.04)
  /* Slight elevation - cards at rest */

--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.05),
             0 2px 4px rgba(0, 0, 0, 0.04)
  /* Standard elevation - hoveredcards */

--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.06),
             0 4px 6px rgba(0, 0, 0, 0.04)
  /* High elevation - modals, dropdowns */

--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.08),
             0 8px 10px rgba(0, 0, 0, 0.04)
  /* Maximum elevation - overlays */

/* Focus Shadow */
--shadow-focus: 0 0 0 3px rgba(0, 0, 0, 0.08)
  /* Accessibility focus ring */
```

### Shadow Usage Rules

**DO:**
- Use sm shadow for resting cards/panels
- Transition to md shadow on hover
- Use lg shadow for modals and dropdowns
- Keep shadows subtle (max 0.08 opacity)

**DON'T:**
- Use colored shadows
- Stack multiple large shadows
- Use shadows with gradients

---

## 🔄 Micro-Animations & Interactions

### Animation Principles
1. **Subtle & Natural**: Avoid bouncy or overly playful animations
2. **Fast**: 150-250ms for most transitions
3. **Purposeful**: Every animation should have a reason
4. **GPU-Accelerated**: Use transform and opacity when possible

### Interaction States

#### Buttons
```css
/* Resting State */
background: #000000
box-shadow: var(--shadow-xs)
transform: scale(1)
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1)

/* Hover State */
background: #1A1A1A
box-shadow: var(--shadow-sm)
transform: translateY(-1px)

/* Active/Pressed State */
background: #000000
box-shadow: none
transform: translateY(0) scale(0.98)

/* Focus State */
outline: 2px solid #666666
outline-offset: 2px
```

#### Cards
```css
/* Resting State */
background: #FFFFFF
border: 1px solid #E0E0E0
box-shadow: var(--shadow-sm)
transform: translateY(0)
transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1)

/* Hover State */
border-color: #D0D0D0
box-shadow: var(--shadow-md)
transform: translateY(-2px)
```

#### Navigation Items
```css
/* Resting State */
background: transparent
color: #6A6A6A
border-left: 3px solid transparent
transition: all 200ms ease

/* Hover State */
background: #FAFAFA
color: #1A1A1A
border-left: 3px solid #E0E0E0

/* Active State */
background: #F5F5F5
color: #000000
border-left: 3px solid #000000
font-weight: 500
```

### Micro-Animation Library

```css
/* Fade In - Modal/Overlay Entry */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
animation: fadeIn 200ms ease-out

/* Scale In - Button/Card Interactions */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
animation: scaleIn 200ms cubic-bezier(0.4, 0, 0.2, 1)

/* Slide Up - Drawer/Panel Entry */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
animation: slideUp 250ms cubic-bezier(0.4, 0, 0.2, 1)

/* Shimmer - Loading States */
@keyframes shimmer {
  from { background-position: -200% center; }
  to { background-position: 200% center; }
}
background: linear-gradient(90deg, #F5F5F5 0%, #FAFAFA 50%, #F5F5F5 100%)
background-size: 200% 100%
animation: shimmer 1.5s ease-in-out infinite
```

### Transition Timing

```css
/* Speed Scale */
--transition-instant: 100ms
--transition-fast: 150ms
--transition-base: 200ms
--transition-smooth: 250ms
--transition-slow: 300ms

/* Easing Functions */
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)
--ease-decelerate: cubic-bezier(0.0, 0, 0.2, 1)
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1)
--ease-sharp: cubic-bezier(0.4, 0, 0.6, 1)
```

---

## 🧩 Component Specifications

### Sidebar (src/components/Sidebar.tsx)

#### Current Issues
❌ Using `sidebar-clean` with backdrop-blur and gradients
❌ Active states use `bg-gradient-to-r from-blue-50 to-indigo-50`
❌ Logo container uses `bg-gradient-to-br from-white to-slate-100`
❌ Active button is blue (`bg-info-600`)

#### New Specification
```tsx
/* Container */
background: #FFFFFF
border-right: 1px solid #E0E0E0
box-shadow: var(--shadow-sm)
backdrop-filter: none  // Remove blur

/* Logo Container */
background: #F5F5F5  // Solid light gray, no gradient
border: 1px solid #E0E0E0
border-radius: 12px
padding: 12px

/* Navigation Items - Resting */
background: transparent
color: #6A6A6A
border-left: 3px solid transparent
padding: 12px 16px
border-radius: 8px
transition: all 200ms ease

/* Navigation Items - Hover */
background: #FAFAFA
color: #1A1A1A
border-left: 3px solid #E0E0E0

/* Navigation Items - Active */
background: #F5F5F5
color: #000000
border-left: 3px solid #000000
font-weight: 500
// NO BLUE, NO GRADIENT

/* Project Indicator */
width: 8px
height: 8px
border-radius: 50%
background: #10B981  // Success green (only functional color)

/* Section Headers */
font-size: 11px
font-weight: 600
text-transform: uppercase
letter-spacing: 0.05em
color: #9A9A9A
margin-bottom: 8px
```

### Modals (src/components/shared/Modal.tsx)

#### Current Issues
❌ Using `bg-black/50` backdrop
⚠️ Good structure, needs refinement

#### New Specification
```tsx
/* Backdrop */
background: rgba(0, 0, 0, 0.4)  // Slightly lighter
backdrop-filter: blur(4px)
transition: opacity 200ms ease

/* Modal Container */
background: #FFFFFF
border-radius: 16px
box-shadow: var(--shadow-xl)
border: 1px solid #E0E0E0
transform: scale(1)
animation: scaleIn 200ms cubic-bezier(0.4, 0, 0.2, 1)

/* Modal Header */
padding: 24px
border-bottom: 1px solid #E0E0E0
background: #FAFAFA  // Subtle header differentiation

/* Modal Title */
font-size: 20px
font-weight: 600
color: #1A1A1A
line-height: 28px

/* Close Button */
width: 32px
height: 32px
border-radius: 8px
background: transparent
color: #6A6A6A
transition: all 150ms ease

&:hover {
  background: #F5F5F5
  color: #1A1A1A
  transform: scale(1.05)
}

&:active {
  transform: scale(0.95)
}

/* Modal Content */
padding: 24px
background: #FFFFFF
max-height: calc(90vh - 120px)
overflow-y: auto

/* Modal Footer */
padding: 16px 24px
border-top: 1px solid #E0E0E0
background: #FAFAFA
display: flex
justify-content: flex-end
gap: 12px
```

### Buttons

#### Current Issues
❌ Using colored backgrounds everywhere
❌ Gradient buttons for AI features

#### New Specification
```tsx
/* Primary Button (Black CTA) */
background: #000000
color: #FFFFFF
padding: 10px 20px
border-radius: 8px
font-weight: 500
font-size: 14px
box-shadow: var(--shadow-xs)
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1)

&:hover {
  background: #1A1A1A
  box-shadow: var(--shadow-sm)
  transform: translateY(-1px)
}

&:active {
  transform: translateY(0) scale(0.98)
  box-shadow: none
}

&:disabled {
  background: #F5F5F5
  color: #BFBFBF
  cursor: not-allowed
}

/* Secondary Button (Ghost) */
background: transparent
color: #1A1A1A
border: 1px solid #E0E0E0
padding: 10px 20px
border-radius: 8px
font-weight: 500
font-size: 14px
transition: all 200ms ease

&:hover {
  background: #FAFAFA
  border-color: #D0D0D0
}

&:active {
  background: #F0F0F0
  transform: scale(0.98)
}

/* Tertiary Button (Ghost, No Border) */
background: transparent
color: #4A4A4A
padding: 8px 16px
border-radius: 8px
font-weight: 500
font-size: 14px
transition: all 150ms ease

&:hover {
  background: #FAFAFA
  color: #1A1A1A
}

/* Destructive Button (Error Actions) */
background: #EF4444  // ONLY functional color
color: #FFFFFF
// Same structure as primary

/* Icon Buttons */
width: 36px
height: 36px
border-radius: 8px
background: transparent
color: #6A6A6A
transition: all 150ms ease

&:hover {
  background: #F5F5F5
  color: #1A1A1A
  transform: scale(1.05)
}
```

### Forms & Inputs

#### Current Issues
⚠️ Good base, needs polish

#### New Specification
```tsx
/* Text Input */
background: #FFFFFF
border: 1px solid #E0E0E0
border-radius: 8px
padding: 10px 14px
font-size: 14px
color: #1A1A1A
transition: all 150ms ease

&::placeholder {
  color: #9A9A9A
}

&:hover {
  border-color: #D0D0D0
}

&:focus {
  border-color: #1A1A1A
  outline: none
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08)
}

&:disabled {
  background: #FAFAFA
  color: #BFBFBF
  cursor: not-allowed
}

/* Label */
font-size: 14px
font-weight: 500
color: #4A4A4A
margin-bottom: 6px
display: block

/* Helper Text */
font-size: 12px
color: #6A6A6A
margin-top: 4px

/* Error State */
border-color: #EF4444
&:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1)
}

/* Error Message */
color: #EF4444
font-size: 12px
margin-top: 4px
```

### Project Header (src/components/ProjectHeader.tsx)

#### Current Issues
❌ Using `bg-gradient-to-r from-slate-50 to-blue-50`
❌ Blue hover states

#### New Specification
```tsx
/* Container */
background: #FAFAFA  // Solid, no gradient
border: 1px solid #E0E0E0
border-radius: 16px
padding: 24px
box-shadow: var(--shadow-sm)

/* Project Name */
font-size: 24px
font-weight: 600
color: #1A1A1A
line-height: 32px

/* Description */
font-size: 14px
color: #4A4A4A
line-height: 20px
margin-top: 8px

/* Meta Info (Created by, date) */
font-size: 12px
color: #9A9A9A
margin-top: 8px

/* Edit Button */
background: transparent
border: 1px solid #E0E0E0
border-radius: 8px
padding: 8px 16px
color: #4A4A4A
font-weight: 500
transition: all 150ms ease

&:hover {
  background: #FFFFFF
  border-color: #D0D0D0
  color: #1A1A1A
}

/* Status Indicator (if needed) */
width: 8px
height: 8px
border-radius: 50%
background: #10B981  // Functional color only
```

### Loading States

#### Current Specification
```tsx
/* Skeleton Loader */
background: linear-gradient(
  90deg,
  #F5F5F5 0%,
  #FAFAFA 50%,
  #F5F5F5 100%
)
background-size: 200% 100%
animation: shimmer 1.5s ease-in-out infinite
border-radius: 8px

/* Spinner */
width: 20px
height: 20px
border: 2px solid #E0E0E0
border-top-color: #1A1A1A
border-radius: 50%
animation: spin 0.6s linear infinite

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Loading Overlay */
background: rgba(255, 255, 255, 0.8)
backdrop-filter: blur(2px)
```

---

## 📐 Spacing & Layout

### Current System
✅ Good 8px grid system in tailwind.config.js
✅ Semantic spacing tokens

### Enhanced Guidelines

```css
/* Component Internal Spacing */
--space-xs: 4px    /* Tight elements */
--space-sm: 8px    /* Related elements */
--space-md: 16px   /* Standard gaps */
--space-lg: 24px   /* Section separators */
--space-xl: 32px   /* Major sections */

/* Component Padding */
--padding-xs: 8px   /* Small buttons, badges */
--padding-sm: 12px  /* Standard buttons */
--padding-md: 16px  /* Cards, panels */
--padding-lg: 24px  /* Modals, major containers */
--padding-xl: 32px  /* Page containers */

/* Border Radius */
--radius-sm: 6px    /* Small elements, badges */
--radius-md: 8px    /* Buttons, inputs */
--radius-lg: 12px   /* Cards, panels */
--radius-xl: 16px   /* Modals, major containers */
```

### Layout Principles
1. **Generous Whitespace**: Never cramped, breathing room everywhere
2. **Consistent Padding**: Use spacing scale consistently
3. **Alignment**: Everything aligns to 8px grid
4. **Hierarchy**: Use spacing to create visual hierarchy

---

## 🎯 Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Priority: HIGH | Impact: HIGH**

1. **Update Tailwind Config**
   - [ ] Replace color variables with monochromatic palette
   - [ ] Update shadow system
   - [ ] Add new animation keyframes
   - [ ] Test with existing components

2. **Create Base CSS Variables**
   - [ ] Add new CSS custom properties
   - [ ] Create design-tokens.css file
   - [ ] Document usage patterns

3. **Update Core Components**
   - [ ] Sidebar - Remove gradients, implement new active states
   - [ ] Modal - Refine shadows and backgrounds
   - [ ] Buttons - Implement black primary style

**Success Metrics:**
- Zero gradients in core navigation
- All active states use grayscale
- Shadows feel premium and subtle

### Phase 2: Forms & Interactions (Week 2)
**Priority: HIGH | Impact: MEDIUM**

1. **Form Components**
   - [ ] Text inputs - New focus states
   - [ ] Select dropdowns - Monochromatic styling
   - [ ] Textareas - Consistent with inputs
   - [ ] Checkboxes/Radio - Clean minimal design

2. **Interactive States**
   - [ ] Implement micro-animations
   - [ ] Add hover transitions (150-250ms)
   - [ ] Focus states for accessibility
   - [ ] Loading states with skeleton

**Success Metrics:**
- All interactions feel smooth (60fps)
- Focus states clearly visible
- Loading states elegant

### Phase 3: Headers & Panels (Week 2)
**Priority: MEDIUM | Impact: HIGH**

1. **Project Header**
   - [ ] Remove gradient background
   - [ ] Implement solid background
   - [ ] Update edit button styling
   - [ ] Polish typography

2. **Panel Components**
   - [ ] Cards - New shadow system
   - [ ] Sections - Monochromatic backgrounds
   - [ ] Dividers - Subtle borders

**Success Metrics:**
- No colored backgrounds except functional
- Clear hierarchy with grayscale
- Premium feel throughout

### Phase 4: Polish & Refinement (Week 3)
**Priority: MEDIUM | Impact: MEDIUM**

1. **Micro-Animations**
   - [ ] Add entrance animations to modals
   - [ ] Polish button interactions
   - [ ] Smooth transitions on navigation
   - [ ] Loading states refinement

2. **Accessibility**
   - [ ] Verify focus states meet WCAG 2.1 AA
   - [ ] Check color contrast ratios
   - [ ] Test keyboard navigation
   - [ ] Screen reader testing

3. **Cross-Component Consistency**
   - [ ] Audit all components
   - [ ] Fix inconsistencies
   - [ ] Document patterns
   - [ ] Create usage guidelines

**Success Metrics:**
- WCAG 2.1 AA compliant
- Consistent feel across app
- Premium, professional aesthetic

---

## 📊 Before & After Comparison

### Sidebar Navigation

**Before:**
```tsx
// Gradient backgrounds
className="sidebar-clean" // Uses backdrop-blur, gradients
className="bg-gradient-to-br from-white to-slate-100"

// Colored active states
className="bg-info-600 text-white" // Blue active state
className="bg-gradient-to-r from-blue-50 to-indigo-50" // Gradient hover
```

**After:**
```tsx
// Clean solid backgrounds
className="bg-white border-r border-gray-200 shadow-sm"
className="bg-gray-50 border border-gray-200" // Logo container

// Grayscale active states
className="bg-gray-100 text-black border-l-2 border-black font-medium"
className="hover:bg-gray-50" // Subtle hover
```

### Buttons

**Before:**
```tsx
className="bg-info-600 hover:bg-info-700 text-white"
className="bg-gradient-to-r from-purple-600 to-blue-600"
```

**After:**
```tsx
className="bg-black hover:bg-gray-900 text-white shadow-xs hover:shadow-sm hover:-translate-y-px"
className="bg-transparent border border-gray-200 hover:bg-gray-50"
```

### Project Header

**Before:**
```tsx
className="bg-gradient-to-r from-slate-50 to-blue-50"
```

**After:**
```tsx
className="bg-gray-50 border border-gray-200 shadow-sm"
```

---

## ✅ Success Criteria

### Visual Quality
- [ ] Zero gradients outside matrix cards
- [ ] Consistent monochromatic palette throughout
- [ ] Functional color used only for status/feedback
- [ ] Shadows feel subtle and premium
- [ ] Typography hierarchy clear and professional

### Interaction Quality
- [ ] All animations smooth (60fps)
- [ ] Transitions between 150-250ms
- [ ] Hover states respond immediately
- [ ] Focus states clearly visible
- [ ] Loading states elegant

### Professional Feel
- [ ] Looks like premium task management tool
- [ ] No "AI app" gradient aesthetic
- [ ] Sophisticated and clean
- [ ] Generous whitespace
- [ ] Clear visual hierarchy

### Accessibility
- [ ] WCAG 2.1 AA compliant
- [ ] 4.5:1 contrast ratio for text
- [ ] 3:1 contrast ratio for UI elements
- [ ] Focus indicators visible
- [ ] Keyboard navigation smooth

### Performance
- [ ] No animation jank
- [ ] GPU-accelerated where possible
- [ ] No unnecessary repaints
- [ ] Fast interaction response

---

## 🔧 Development Guidelines

### When Styling New Components

**DO:**
1. Start with grayscale palette
2. Use shadows for depth, not gradients
3. Add functional color only if needed for status
4. Use spacing scale consistently
5. Add micro-animations (150-250ms)
6. Test focus states for accessibility

**DON'T:**
1. Use gradients (except matrix cards)
2. Use blue/purple for navigation/active states
3. Use colored backgrounds for panels/cards
4. Create custom spacing values
5. Use bouncy/playful animations
6. Skip accessibility testing

### Code Examples

**Good:**
```tsx
<button className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xs hover:shadow-sm hover:-translate-y-px transition-all duration-200">
  Save Changes
</button>

<div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-250">
  Card Content
</div>
```

**Bad:**
```tsx
<button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
  Save
</button>

<div className="bg-gradient-to-br from-slate-50 to-blue-50">
  Card Content
</div>
```

---

## 📚 Reference Images

### Inspiration
- Taskboard reference provided (clean whites, subtle shadows, minimal color)
- Linear.app (monochromatic with functional accents)
- Notion (clean, minimal, professional)
- Stripe Dashboard (sophisticated grayscale)

### Key Characteristics
- Clean white backgrounds
- Subtle gray borders (not heavy)
- Shadows for depth, not color
- Minimal accent color (green, blue, purple for status only)
- Generous whitespace
- Clear typography hierarchy
- Smooth, subtle animations

---

## 📝 Notes

- **Matrix & Cards Excluded**: Design matrix and idea cards maintain current styling
- **Incremental Migration**: Can be done component-by-component
- **No Breaking Changes**: All changes are visual only
- **Accessibility First**: Every change must maintain or improve accessibility
- **Performance Conscious**: GPU-accelerated animations where possible

---

**Next Steps:**
1. Review this specification with team
2. Get approval on direction
3. Begin Phase 1 implementation
4. Iterate based on feedback
5. Document patterns as we go

**Questions?**
- Should we create a component library/storybook?
- Need design review process established?
- Want to pilot on specific component first?
