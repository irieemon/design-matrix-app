# Monochrome-Lux Animated Demo Guide

## Overview

The **animated version** of the Monochrome-Lux demo includes all micro-animations from the design brief. This showcases calm, confident, purposeful motion throughout the interface.

## Access

```
http://localhost:3003/#lux-animated
```

## Motion Philosophy

**Core Principles:**
- Calm, confident, purposeful (never playful or bouncy)
- Micro changes in elevation, opacity, and tint
- Motion supports clarity and orientation, not decoration
- Respects `prefers-reduced-motion`

## Animation System

### Durations

```css
--duration-instant: 120ms   /* Instant feedback (hover/pressed) */
--duration-fast: 140ms      /* Quick transitions */
--duration-base: 190ms      /* Typical UI transitions */
--duration-moderate: 220ms  /* Overlays, modals */
--duration-slow: 260ms      /* Section entrances */
```

### Easing Functions

```css
--easing-glide: cubic-bezier(0.2, 0.6, 0, 0.98)  /* "Confident glide" - default */
--easing-standard: ease                          /* Hover/pressed */
--easing-in: ease-in                            /* Exit transitions */
--easing-out: ease-out                          /* Enter transitions */
```

### Movement Constraints

- **Translate:** Maximum 2-6px on Y-axis, 1-2px for Z/elevation
- **Opacity:** 0 → 1 for entrances, 1 → 0 for exits
- **Scale:** Rarely used; if needed, 0.98 → 1.0 (never >1.0)
- **Tint:** Color shifts ≤4%

## Component Animations

### 1. Buttons

**Hover State:**
```css
transform: translateY(-1px);
box-shadow: wider, lighter;
background: +2% tint;
duration: 140ms ease-out;
```

**Pressed State:**
```css
transform: translateY(0);  /* Returns to baseline */
box-shadow: reduces;
duration: 120ms ease-in;
```

**Focus State:**
```css
ring: fades in 0 → 1;
duration: 190ms ease-out;
/* Ring doesn't move, only opacity changes */
```

**What to Try:**
- Hover over "Primary Action" - watch the subtle -1px lift
- Click and hold - see it return to baseline
- Tab to focus - ring fades in smoothly

### 2. Navigation Items (Sidebar)

**Hover State:**
```css
background: +2% tint (#F9FAFB);
text-color: darkens;
icon-opacity: 0.7 → 1.0;
duration: 140ms standard ease;
```

**Active State:**
```css
background: #F3F4F6;
text-color: #1F2937;
/* No transition on click - instant feedback */
```

**What to Try:**
- Hover over inactive nav items - subtle background tint
- Notice icons become more opaque on hover
- Click to activate - instant state change

### 3. Cards

**Hover State:**
```css
background: +2% tint (#FEFEFE);
box-shadow: widens and lightens;
/* No translate - elevation only */
duration: 160ms ease-out;
```

**What to Try:**
- Hover over any card - shadow expands gently
- Background becomes imperceptibly lighter
- No movement, only depth change

### 4. Form Inputs

**Focus Gain:**
```css
border: #E8EBED → #3B82F6 (sapphire);
ring: expands/brightens 0 → 1;
icon-color: shifts to sapphire;
duration: 190-210ms ease-out;
```

**Focus Loss:**
```css
/* Ring fades out, never snaps */
duration: 190ms ease-in;
```

**Hover State:**
```css
border: #E8EBED → #D1D5DB;
duration: 140ms;
```

**What to Try:**
- Click in email input - ring softly expands
- Notice search icon changes to sapphire on focus
- Tab between fields - smooth transitions

### 5. Links & Text Buttons

**Hover State:**
```css
underline: slides in left → right;
text-color: darkens slightly;
duration: 140ms ease-out;
```

**What to Try:**
- Hover over "View Details →" links
- Underline smoothly appears
- Text darkens subtly

### 6. Status Badges

**Hover State:**
```css
box-shadow: subtle lift;
duration: 120ms;
```

**What to Try:**
- Hover over status badges
- Very subtle shadow appears

### 7. Loading Skeletons

**Shimmer Animation:**
```css
animation: shimmer 2s linear infinite;
background: gradient travels -200% → 200%;
/* Slow, subtle, linear tempo */
```

**Reduced Motion:**
- Shimmer disabled entirely
- Shows static gradient bars

**What to Try:**
- Watch the skeleton bars shimmer
- Enable "reduce motion" in OS - shimmer stops

## Reduced Motion Support

**When `prefers-reduced-motion` is enabled:**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  .shimmer-animation {
    animation: none !important;
  }
}
```

**Changes:**
- All transitions become instant (<1ms)
- Shimmer stops completely
- Static states only
- Focus rings still appear (essential for a11y)

**To Test:**
- **macOS:** System Preferences → Accessibility → Display → Reduce motion
- **Windows:** Settings → Ease of Access → Display → Show animations
- Refresh page to see static version

## Performance

**Optimized For:**
- GPU-accelerated properties only (transform, opacity)
- No layout-thrashing
- <20 concurrent animations typical
- Smooth 60fps on modern hardware

**Avoid:**
- Animating width, height, top, left
- Multiple shadows simultaneously
- Nested transforms

## Key Observations

### What Makes It "Premium"

1. **Subtle Lifts:** -1px translate feels tactile, not floaty
2. **Shadow Expansion:** Shadows widen, never darken significantly
3. **Tint Shifts:** Background changes ≤2-4%, barely noticeable
4. **Confident Timing:** 180-220ms feels unhurried yet responsive
5. **No Bounce:** Cubic-bezier glide, no overshoot
6. **Ring Fades:** Focus rings appear gradually, never snap

### Comparison to Instant Transitions

Try toggling between:
- **Original demo** (`#lux-demo`) - Instant/minimal animations
- **Animated demo** (`#lux-animated`) - Full micro-animations

**Differences:**
- Buttons lift on hover vs stay flat
- Inputs have animated focus rings vs instant
- Cards have smooth elevation vs immediate
- Links have underline slide vs instant appear
- Overall feels more "alive" yet still calm

## Technical Implementation

### CSS Custom Properties

```css
:root {
  --duration-instant: 120ms;
  --duration-fast: 140ms;
  --duration-base: 190ms;
  --duration-moderate: 220ms;
  --duration-slow: 260ms;
  --easing-glide: cubic-bezier(0.2, 0.6, 0, 0.98);
  --easing-standard: ease;
  --easing-in: ease-in;
  --easing-out: ease-out;
}
```

### Utility Classes

**Button Hover Lift:**
```css
.btn-hover-lift {
  transition: transform var(--duration-fast) var(--easing-out),
              box-shadow var(--duration-fast) var(--easing-out);
}
.btn-hover-lift:hover:not(:disabled) {
  transform: translateY(-1px);
}
```

**Card Hover:**
```css
.card-hover {
  transition: box-shadow var(--duration-fast) var(--easing-out),
              background-color var(--duration-fast) var(--easing-out);
}
```

**Input Focus:**
```css
.input-focus {
  transition: border-color var(--duration-base) var(--easing-out),
              box-shadow var(--duration-base) var(--easing-out);
}
```

**Link Underline:**
```css
.link-underline::after {
  width: 0;
  transition: width var(--duration-fast) var(--easing-out);
}
.link-underline:hover::after {
  width: 100%;
}
```

## Design System Integration

**If you choose this aesthetic:**

1. **Add to Tailwind config:**
   ```js
   theme: {
     extend: {
       transitionDuration: {
         '120': '120ms',
         '140': '140ms',
         '190': '190ms',
         '220': '220ms',
         '260': '260ms',
       },
       transitionTimingFunction: {
         'glide': 'cubic-bezier(0.2, 0.6, 0, 0.98)',
       }
     }
   }
   ```

2. **Create utility classes:**
   - `.btn-lift` for button hover
   - `.card-elevate` for card hover
   - `.focus-ring` for input focus
   - `.link-slide` for underline animation

3. **Apply systematically:**
   - All buttons get `.btn-lift`
   - All cards get `.card-elevate`
   - All inputs get `.input-focus`
   - All links get `.link-slide`

## Accessibility Notes

**WCAG Compliance:**
- ✅ Focus states always visible
- ✅ Reduced motion support
- ✅ Color not sole indicator
- ✅ Touch targets 44x44px minimum
- ✅ Keyboard navigation smooth

**Motion Accessibility:**
- Animations support understanding, not required for function
- All states have non-motion indicators (color, border, shadow)
- Reduced motion makes everything instant but functional

## Comparison Table

| Element | Static (#lux-demo) | Animated (#lux-animated) |
|---------|-------------------|-------------------------|
| **Buttons** | No hover lift | -1px translate + shadow |
| **Cards** | No elevation | Shadow expansion |
| **Inputs** | Instant focus | Ring fade-in 190ms |
| **Links** | Instant underline | Slide-in 140ms |
| **Nav Items** | Instant background | Tint fade 140ms |
| **Icons** | Static opacity | Opacity shift on hover |
| **Shadows** | Static | Width expansion |
| **Loading** | Shimmer | Shimmer (same) |

## Feedback Questions

1. **Does the motion feel calm and confident?**
2. **Are hover states responsive enough (140-160ms)?**
3. **Is the -1px button lift noticeable but not excessive?**
4. **Do focus rings fade in smoothly?**
5. **Are card elevations subtle enough?**
6. **Does the link underline slide feel natural?**
7. **Is the overall timing right (not too fast/slow)?**
8. **Does reduced motion work correctly?**

## Next Steps

If you approve this motion system:
- [ ] Apply to all buttons in app
- [ ] Add to all form inputs
- [ ] Implement on all cards/panels
- [ ] Add link underline animations
- [ ] Create Tailwind utility classes
- [ ] Document motion standards
- [ ] Test reduced motion thoroughly
- [ ] Performance audit with many elements

---

**Demo URL:** http://localhost:3003/#lux-animated
**Design System:** Monochrome-Lux with Micro-Animations
**Status:** Ready for review
**Motion Philosophy:** Calm, confident, purposeful
