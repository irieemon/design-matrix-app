# Monochromatic Design Demo

## How to Access

The monochromatic design demo component has been created and integrated into your application.

### Option 1: Direct URL Access

Once your app is running, navigate to:
```
http://localhost:3003/#mono-demo
```

Or manually change the URL hash to `#mono-demo`

### Option 2: Via Browser Console

Open your browser console and run:
```javascript
window.location.hash = 'mono-demo'
```

### Option 3: Modify PageRouter Temporarily

You can temporarily modify the default page in your router to load the demo on startup.

## What's Included in the Demo

### 1. **Sidebar Navigation**
- Clean monochromatic sidebar
- Grayscale active states (no blue!)
- Smooth hover transitions
- Border-left accent for active items

### 2. **Button Showcase**
- **Primary**: Black with subtle shadow
- **Secondary**: Ghost with border
- **Tertiary**: Minimal hover states
- **Icon buttons**: Micro-animations
- **Destructive**: Red for dangerous actions
- **Disabled states**: Proper visual feedback

### 3. **Cards & Panels**
- White backgrounds with subtle borders
- Hover elevation (shadow + translate)
- Smooth 250ms transitions
- Group hover effects for nested elements

### 4. **Form Elements**
- Clean input styling
- Focus states with ring effect
- Hover border emphasis
- Placeholder text hierarchy
- Icon integration (search example)

### 5. **Status Badges**
- Functional color accents only
- Green (success), Blue (info), Amber (warning), Red (error)
- Subtle backgrounds with borders
- Used only for status/feedback

### 6. **Loading States**
- Skeleton loaders with shimmer animation
- Spinner with grayscale styling
- Smooth pulsing effects

### 7. **Modal Example**
- Click "Open Modal" to see it
- Clean white with subtle shadow
- Backdrop blur effect
- Header/footer differentiation with gray-50
- Loading state demonstration
- Smooth entrance animation

## Design Highlights

### Color Usage
- **95% Grayscale**: White, light gray, medium gray, dark gray, black
- **5% Functional Color**: Only for status indicators and destructive actions
- **Zero Gradients**: Clean, flat design with depth through shadows

### Shadows
- `shadow-sm`: Resting cards
- `shadow-md`: Hover state
- `shadow-xl`: Modals and overlays
- All shadows use black with low opacity (0.04-0.08)

### Animations
- **Timing**: 150-250ms for smooth, premium feel
- **Easing**: cubic-bezier(0.4, 0, 0.2, 1) for natural motion
- **GPU-Accelerated**: Using transform and opacity
- **Hover Effects**: Translate, scale, shadow transitions
- **Active States**: Scale down to 0.98 for feedback

### Typography
- **Headings**: Near-black (#1A1A1A), semibold/bold
- **Body**: Dark gray (#4A4A4A), regular weight
- **Secondary**: Medium gray (#6A6A6A)
- **Tertiary**: Light gray (#9A9A9A)
- **All using Inter font**

## Comparison to Current Design

### Before (Current)
- Blue gradient active states
- Colored backgrounds for panels
- Multiple gradient uses
- "AI app" aesthetic

### After (Demo)
- Grayscale active states
- White/light gray backgrounds
- Shadow-based depth
- Premium tool aesthetic

## Next Steps

After reviewing the demo:

1. **Approve the direction** - Does this match your vision?
2. **Identify adjustments** - Any tweaks needed?
3. **Begin migration** - Start with Sidebar (Phase 1)
4. **Iterate** - Refine based on feedback

## Notes

- The demo is fully self-contained
- No impact on existing components
- Matrix and idea cards remain unchanged (as requested)
- All animations are performance-optimized
- Accessibility maintained (focus states, keyboard nav)

## Feedback

When reviewing, consider:
- Does it feel premium and sophisticated?
- Is the contrast sufficient for readability?
- Are the animations smooth and natural?
- Does it move away from "AI app" aesthetic successfully?
- Any components that need refinement?
