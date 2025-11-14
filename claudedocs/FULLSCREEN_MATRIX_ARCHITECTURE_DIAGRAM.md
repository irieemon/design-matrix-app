# Full-Screen Matrix Workspace - Architecture Diagram

## Component Structure Visualization

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FULL SCREEN VIEWPORT                             │
│                       (100vw × 100vh, z-index: 1)                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ TopBar (z-index: 101, auto-hide after 3s)                          │ │
│  │ ┌──────────────────────┬──────────────┬──────────────────────────┐ │ │
│  │ │ Project Context      │ View Controls│ Exit Button (always)     │ │ │
│  │ │ "Project Name"       │ Grid | Labels│ ×                        │ │ │
│  │ └──────────────────────┴──────────────┴──────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │                        MATRIX CANVAS                                │ │
│  │                    (Full Viewport Space)                            │ │
│  │                                                                     │ │
│  │   ┌─────────────────────┬─────────────────────┐                   │ │
│  │   │  STRATEGIC          │  INNOVATION         │                   │ │
│  │   │  High Priority      │  High Priority      │                   │ │
│  │   │  Low Impact         │  High Impact        │                   │ │
│  │   │                     │                     │                   │ │
│  │   │   [Idea Card]       │   [Idea Card]       │                   │ │
│  │   │   [Idea Card]       │   [Idea Card]       │                   │ │
│  │   │                     │   [Idea Card]       │                   │ │
│  │   │                     │                     │                   │ │
│  │   ├─────────────────────┼─────────────────────┤                   │ │
│  │   │  MODERATE           │  HIGH               │                   │ │
│  │   │  Med Priority       │  Med Priority       │                   │ │
│  │   │  Low Impact         │  High Impact        │                   │ │
│  │   │                     │                     │                   │ │
│  │   │   [Idea Card]       │   [Idea Card]       │                   │ │
│  │   │                     │   [Idea Card]       │                   │ │
│  │   │                     │   [Idea Card]       │                   │ │
│  │   │                     │                     │                   │ │
│  │   └─────────────────────┴─────────────────────┘                   │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌────┐  ← Floating Action Menu (z-index: 102, side-docked)             │
│  │ +  │     Always visible, expandable                                   │
│  │ AI │     - Add Idea                                                   │
│  │ ⊕  │     - AI Generate                                                │
│  │ ⊖  │     - Zoom In/Out                                                │
│  │ ⚙  │     - Layout Controls                                            │
│  └────┘                                                                   │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ BottomBar (z-index: 101, auto-hide after 3s)                       │ │
│  │ ┌──────────────────────┬──────────────┬──────────────────────────┐ │ │
│  │ │ Idea Counter         │ Shortcuts    │ Help Button              │ │ │
│  │ │ "25 ideas"           │ Press ? help │ ?                        │ │ │
│  │ └──────────────────────┴──────────────┴──────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           STATE TRANSITIONS                              │
└─────────────────────────────────────────────────────────────────────────┘

                        ┌───────────────────┐
                        │   Normal View     │
                        │  (AppLayout +     │
                        │   MatrixPage)     │
                        └─────────┬─────────┘
                                  │
                     Button Click │ 'F' Key │ Double-Click Canvas
                                  ↓
                        ┌───────────────────┐
                        │   ENTERING        │
                        │  Full-Screen      │
                        │                   │
                        │ 1. Hide sidebar   │───┐
                        │ 2. Fade chrome    │   │ 500ms
                        │ 3. Scale canvas   │   │ transition
                        │ 4. Show FS chrome │←──┘
                        └─────────┬─────────┘
                                  │
                                  ↓
                        ┌───────────────────┐
                  ┌────→│  Full-Screen      │←─────┐
                  │     │   Active          │      │
                  │     │                   │      │
                  │     │ Chrome Visible    │      │
                  │     └─────────┬─────────┘      │
                  │               │                 │
             Auto-show │          │ 3s inactivity  │ Mouse near edge
             on activity│         ↓                 │ or keyboard input
                  │     ┌───────────────────┐      │
                  │     │  Full-Screen      │      │
                  └─────│   Chrome Hidden   │──────┘
                        │  (auto-hide)      │
                        └─────────┬─────────┘
                                  │
                      ESC Key  │ Exit Button │ Double-Click Canvas
                                  ↓
                        ┌───────────────────┐
                        │   EXITING         │
                        │  Full-Screen      │
                        │                   │
                        │ 1. Fade FS chrome │───┐
                        │ 2. Scale canvas   │   │ 500ms
                        │ 3. Show chrome    │   │ transition
                        │ 4. Show sidebar   │←──┘
                        └─────────┬─────────┘
                                  │
                                  ↓
                        ┌───────────────────┐
                        │   Normal View     │
                        │  (Restored)       │
                        └───────────────────┘
```

## Interaction Flow: Adding an Idea in Full-Screen

```
User in Full-Screen Mode
         │
         ├─→ Presses 'N' key OR Clicks '+' in Floating Menu
         │
         ↓
┌────────────────────────┐
│ Full-Screen continues  │
│ with overlay           │
└────────────────────────┘
         │
         ↓
┌────────────────────────┐
│ AddIdeaModal appears   │
│ (z-index: 1000)        │
│ - Darkened background  │
│ - Modal centered       │
│ - Focus trapped        │
└────────────────────────┘
         │
         ├─→ User fills form and saves
         │   ↓
         │   New idea appears on canvas
         │   Modal closes
         │   Focus returns to canvas
         │
         ├─→ User presses ESC
         │   ↓
         │   Modal closes without saving
         │   Focus returns to canvas
         │
         └─→ User clicks outside modal
             ↓
             Modal closes without saving
             Focus returns to canvas
```

## Chrome Auto-Hide Logic

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      AUTO-HIDE DECISION TREE                             │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │  User Action Occurs  │
                    └──────────┬───────────┘
                               │
                               ↓
                    ┌──────────────────────┐
                    │  Is Full-Screen?     │
                    └──────────┬───────────┘
                      Yes ↓         ↑ No: Always show chrome
                               │
                    ┌──────────────────────┐
                    │  Action Type?        │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┼─────────────┬─────────────────┐
                 │             │             │                 │
          Mouse Movement   Keyboard     Modal/Menu        Timer Fired
                 │          Input         Opens         (3s inactivity)
                 ↓             ↓             ↓                 ↓
         ┌──────────┐   ┌──────────┐  ┌──────────┐    ┌──────────┐
         │ Near Edge│   │ Show     │  │ Show     │    │ Hide     │
         │ (<50px)? │   │ Chrome   │  │ Chrome   │    │ Chrome   │
         └────┬─────┘   └──────────┘  └──────────┘    └──────────┘
              │
       Yes ↓     ↑ No: Do nothing
              │
      ┌──────────────────────┐
      │ Show Chrome          │
      │ Reset 3s timer       │
      └──────────────────────┘
```

## Keyboard Shortcut Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     KEYBOARD SHORTCUT ROUTING                            │
└─────────────────────────────────────────────────────────────────────────┘

Key Press Event
     │
     ↓
┌────────────────────┐
│ Is input focused?  │
└────────┬───────────┘
    Yes ↓    ↑ No: Continue
     │       │
  Ignore  ┌──────────────────┐
          │ Is modal open?   │
          └────────┬─────────┘
              Yes ↓    ↑ No: Continue
               │       │
      Modal handlers ┌──────────────────────┐
                     │ Full-Screen          │
                     │ Shortcut Handler     │
                     └────────┬─────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         'F' or ESC     Zoom/View       Action Keys
              │          (+, -, 0,        (N, A, E,
              │           G, L, H)         Del, ?, etc)
              ↓               ↓                ↓
    Toggle Full-Screen   Adjust View     Execute Action
    or Exit            (Grid, Zoom,     (Add, Edit,
                        Labels, etc)      Delete, etc)
```

## Performance Optimization Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   RENDER OPTIMIZATION PIPELINE                           │
└─────────────────────────────────────────────────────────────────────────┘

Initial Render
     │
     ↓
┌────────────────────┐
│ Count ideas        │
└────────┬───────────┘
         │
         ├─→ < 50 ideas: Full quality rendering
         │   - All animations enabled
         │   - High-fidelity grid
         │   - Smooth transitions
         │
         ├─→ 50-100 ideas: Balanced mode
         │   - Reduced animation complexity
         │   - Simplified grid rendering
         │   - Essential transitions only
         │
         └─→ > 100 ideas: Performance mode
             - Virtual rendering (viewport culling)
             - Minimal animations
             - Simplified visuals
             - Canvas-based rendering (future)

┌────────────────────────────────────────────────────────────────────────┐
│ During Interaction (Pan, Zoom, Drag)                                   │
└────────────────────────────────────────────────────────────────────────┘

Interaction Start
     │
     ↓
Measure frame rate
     │
     ├─→ 60fps: Continue current quality
     ├─→ 30-60fps: Degrade quality
     │   - Disable non-essential animations
     │   - Reduce update frequency
     │
     └─→ < 30fps: Emergency mode
         - Freeze background elements
         - Show only essential UI
         - Warn user about performance
```

## Mobile/Touch Adaptation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     RESPONSIVE LAYOUT BREAKPOINTS                        │
└─────────────────────────────────────────────────────────────────────────┘

Desktop (> 1024px)              Tablet (768px - 1024px)
┌────────────────────┐          ┌────────────────────┐
│ TopBar: Full       │          │ TopBar: Compact    │
│ Floating: Expanded │          │ Floating: Icons    │
│ BottomBar: Full    │          │ BottomBar: Compact │
│ Grid: 2x2          │          │ Grid: 2x2          │
│ Cards: Large       │          │ Cards: Medium      │
└────────────────────┘          └────────────────────┘

Mobile (< 768px)
┌────────────────────┐
│ TopBar: Minimal    │
│ (Project + Exit)   │
│ Floating: Hidden   │
│ (Swipe to reveal)  │
│ BottomBar: Hidden  │
│ (Swipe to reveal)  │
│ Grid: 2x2          │
│ (Pinch to zoom)    │
│ Cards: Small       │
│ (Touch optimized)  │
└────────────────────┘

Touch Gestures:
- Double-tap canvas → Toggle full-screen
- Pinch → Zoom in/out
- Two-finger drag → Pan canvas
- Long-press → Context menu
- Swipe from edge → Show chrome
```

## Implementation Phase Timeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DEVELOPMENT ROADMAP                                 │
└─────────────────────────────────────────────────────────────────────────┘

Week 1: Foundation
├─ Days 1-2: Core Infrastructure
│  ├─ MatrixFullScreenView component
│  ├─ useFullScreenMode hook
│  └─ Entry/exit transitions
└─ Days 3-4: Chrome UI
   ├─ TopBar component
   ├─ BottomBar component
   ├─ Floating menu
   └─ Exit button

Week 2: Interactions
├─ Days 1-2: Auto-Hide
│  ├─ useAutoHideChrome hook
│  ├─ Edge detection
│  └─ Fade animations
└─ Days 3-4: Keyboard
   ├─ useFullScreenKeyboardShortcuts hook
   ├─ All shortcuts implementation
   └─ Help modal

Week 3: Polish
├─ Days 1-2: Touch Support
│  ├─ Touch gesture handlers
│  ├─ Pinch-to-zoom
│  └─ Mobile optimization
├─ Days 3-4: Performance
│  ├─ Virtual rendering
│  ├─ Performance monitoring
│  └─ Optimization

Week 4: Testing & Launch
├─ Days 1-2: Testing
│  ├─ Unit tests
│  ├─ Integration tests
│  └─ E2E tests
└─ Days 3-4: Launch
   ├─ Code review
   ├─ Documentation
   └─ Deployment
```

---

## Quick Reference: Key Files

**Core Components**:
- `src/components/matrix/MatrixFullScreenView.tsx` - Main full-screen wrapper
- `src/components/matrix/fullscreen/TopBar.tsx` - Project context and controls
- `src/components/matrix/fullscreen/BottomBar.tsx` - Status and hints
- `src/components/matrix/fullscreen/FloatingActionMenu.tsx` - Quick actions
- `src/components/matrix/fullscreen/ExitButton.tsx` - Always-visible exit

**Custom Hooks**:
- `src/hooks/useFullScreenMode.ts` - Full-screen state and browser API
- `src/hooks/useAutoHideChrome.ts` - Chrome auto-hide behavior
- `src/hooks/useFullScreenKeyboardShortcuts.ts` - Keyboard shortcut handling

**Modified Files**:
- `src/components/pages/MatrixPage.tsx` - Add full-screen toggle
- `src/components/matrix/MatrixContainer.tsx` - Support full-screen dimensions

---

## Success Criteria Checklist

**Functionality** (Must-Have):
- [ ] User can enter full-screen via button/keyboard
- [ ] User can exit full-screen via ESC/button
- [ ] Canvas scales to full viewport smoothly
- [ ] Chrome auto-hides after 3 seconds
- [ ] All keyboard shortcuts work correctly
- [ ] Ideas can be added/edited/deleted in full-screen
- [ ] Drag and drop works in full-screen

**User Experience** (Should-Have):
- [ ] Entry/exit animations are smooth (60fps)
- [ ] Chrome shows when mouse near edges
- [ ] Floating menu provides quick access to actions
- [ ] Help modal explains all shortcuts
- [ ] Touch gestures work on mobile/tablet

**Performance** (Should-Have):
- [ ] 60fps with 50 ideas
- [ ] 30fps with 100+ ideas
- [ ] < 100MB memory usage
- [ ] < 100ms time-to-interactive

**Accessibility** (Must-Have):
- [ ] 100% keyboard navigable
- [ ] Screen reader announces mode changes
- [ ] Focus management works correctly
- [ ] AAA contrast ratio for all text

