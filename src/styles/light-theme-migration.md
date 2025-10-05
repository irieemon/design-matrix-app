# Clean Light Theme Migration Guide

This guide provides specific migration paths for transforming the current design to the new clean light theme system.

## Key Transformations

### 1. Sidebar Updates

**Dark Slate to Clean White Sidebar:**

```tsx
// OLD (Dark theme)
<div className="bg-slate-800 text-slate-100 border-slate-700">
  <nav className="text-slate-300 hover:text-slate-100">

// NEW (Clean light theme)
<div className="sidebar-clean">
  <nav className="sidebar-item">
```

**Specific Class Replacements:**
- `bg-slate-800` → `bg-white`
- `text-slate-100` → `text-neutral-900`
- `text-slate-300` → `text-neutral-600`
- `border-slate-700` → `border-neutral-200`
- `hover:bg-slate-700` → `hover:bg-neutral-100`

### 2. Card Components

**Gray Backgrounds to Clean White Cards:**

```tsx
// OLD
<div className="bg-gray-100 border border-gray-300">

// NEW
<div className="card-clean">
// or for interactive cards
<div className="card-clean-hover">
```

### 3. Button Transformations

**Primary Buttons:**
```tsx
// OLD
<button className="bg-blue-600 hover:bg-blue-700 text-white">

// NEW
<button className="btn-primary">
```

**Secondary Buttons:**
```tsx
// OLD
<button className="bg-gray-200 hover:bg-gray-300 text-gray-900">

// NEW
<button className="btn-secondary">
```

**Ghost/Subtle Buttons:**
```tsx
// OLD
<button className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">

// NEW
<button className="btn-ghost">
```

### 4. Input Fields

**Form Controls:**
```tsx
// OLD
<input className="border border-gray-300 bg-white px-3 py-2 focus:border-blue-500">

// NEW
<input className="input-clean">
```

### 5. Status Indicators

**Replace semantic color classes:**
```tsx
// Success states
// OLD: bg-green-100 text-green-800
// NEW: badge-success

// Info states
// OLD: bg-blue-100 text-blue-800
// NEW: badge-info

// Warning states
// OLD: bg-yellow-100 text-yellow-800
// NEW: badge-warning

// Error states
// OLD: bg-red-100 text-red-800
// NEW: badge-error
```

### 6. Text Color Hierarchy

**Consistent text colors:**
```tsx
// Primary headings and important text
className="text-primary"          // neutral-900

// Regular body text and descriptions
className="text-secondary"        // neutral-600

// Supporting information
className="text-tertiary"         // neutral-500

// Placeholder and disabled text
className="text-muted"           // neutral-400
```

### 7. Background Transformations

**Page and component backgrounds:**
```tsx
// Main app background
// OLD: bg-gray-50
// NEW: bg-white

// Card/section backgrounds
// OLD: bg-gray-100
// NEW: bg-neutral-100

// Subtle contrast areas
// OLD: bg-gray-200
// NEW: bg-neutral-150
```

### 8. Border and Divider Updates

**Clean border system:**
```tsx
// Light borders
// OLD: border-gray-200
// NEW: border-neutral-200

// Medium borders
// OLD: border-gray-300
// NEW: border-neutral-300

// Horizontal dividers
// OLD: border-b border-gray-200
// NEW: divider-horizontal

// Vertical dividers
// OLD: border-r border-gray-200
// NEW: divider-vertical
```

## Component-Specific Migrations

### Matrix/Dashboard Components

```tsx
// Matrix container
<div className="bg-white border border-neutral-200 rounded-lg shadow-card">

// Matrix grid background
<div className="matrix-grid-background">

// Quadrant headers
<h3 className="text-lg font-semibold text-primary">
```

### Navigation Components

```tsx
// Main navigation container
<nav className="sidebar-clean">

// Navigation items
<a className="sidebar-item" href="#">
  <Icon className="w-5 h-5 text-neutral-500" />
  <span className="ml-3 text-sm font-medium">Dashboard</span>
</a>

// Active navigation item
<a className="sidebar-item active" href="#">
```

### Modal and Dropdown Components

```tsx
// Modal overlay
<div className="modal-overlay">

// Modal content
<div className="modal-content p-6">

// Dropdown menus
<div className="dropdown-clean p-2">
```

### Progress and Loading States

```tsx
// Progress bars
<div className="progress-bar h-2">
  <div className="progress-fill" style={{ width: '60%' }}></div>
</div>

// Loading skeletons
<div className="skeleton h-4 w-32"></div>
<div className="skeleton h-20 w-full mt-2"></div>
```

## Shadow and Elevation Updates

**Replace existing shadow classes:**
```tsx
// Card shadows
// OLD: shadow-md
// NEW: shadow-card

// Hover states
// OLD: hover:shadow-lg
// NEW: hover:shadow-card-hover

// Button shadows
// OLD: shadow-sm
// NEW: shadow-button

// Modal shadows
// OLD: shadow-2xl
// NEW: shadow-modal
```

## Animation and Transitions

**Enhanced interaction feedback:**
```tsx
// Smooth transitions for all interactive elements
className="transition-all duration-200"

// Hover and focus states
className="hover:shadow-card-hover transition-shadow duration-200"

// Entrance animations
className="animate-fade-in"
className="animate-slide-up"
```

## Migration Checklist

### Phase 1: Core Layout
- [ ] Update main app background from `bg-gray-50` to `bg-white`
- [ ] Transform sidebar from dark slate to `sidebar-clean`
- [ ] Update navigation items to use `sidebar-item` classes
- [ ] Replace card backgrounds with `card-clean` or `card-clean-hover`

### Phase 2: Interactive Elements
- [ ] Replace button classes with `btn-primary`, `btn-secondary`, `btn-ghost`
- [ ] Update input fields to use `input-clean`
- [ ] Transform status indicators to badge classes
- [ ] Update hover and focus states

### Phase 3: Typography and Colors
- [ ] Replace text color classes with semantic hierarchy
- [ ] Update border colors to neutral palette
- [ ] Apply consistent spacing using 8px grid system
- [ ] Implement shadow system for proper elevation

### Phase 4: Component Polish
- [ ] Add smooth transitions to all interactive elements
- [ ] Implement proper loading states with skeletons
- [ ] Update progress indicators to clean styles
- [ ] Apply entrance animations where appropriate

## Testing and Validation

After migration, verify:
- [ ] All text meets WCAG AA contrast requirements (4.5:1+)
- [ ] Interactive elements have clear hover and focus states
- [ ] Cards and components have appropriate elevation/depth
- [ ] Consistent spacing throughout the interface
- [ ] Smooth animations and transitions
- [ ] Clean, professional appearance aligned with brand standards

## Performance Considerations

- All custom classes are optimized for Tailwind's purging
- Shadow system uses minimal CSS for better performance
- Animation classes are lightweight and GPU-accelerated
- Color system generates only used variants to minimize CSS size