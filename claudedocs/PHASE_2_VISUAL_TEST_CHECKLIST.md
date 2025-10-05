# Phase 2 Visual Test Checklist - Animated Lux

**Dev Server**: http://localhost:3006/
**Date**: 2025-10-02
**Phase**: 2 - Core Components (Buttons & Inputs)
**Status**: Testing visual changes

---

## 🎯 What to Test

Phase 2 has applied Animated Lux styling to **Buttons** and **Inputs**. You should now see visual changes throughout the application.

---

## ✅ Button Testing Checklist

### Test Locations
- Login/Auth screens
- Modal action buttons (Add Idea, Edit Idea, etc.)
- Project header buttons
- Sidebar navigation
- Form submit buttons

### What to Look For

#### **Primary Buttons** (Main action buttons)

- [ ] **Color Change**: Background is now **graphite** (#374151) instead of pure black
- [ ] **Hover Effect**: Button lifts **-1px** (subtle upward movement)
- [ ] **Hover Shadow**: Shadow expands wider (not darker)
- [ ] **Press Effect**: Returns to baseline when clicked
- [ ] **Focus Ring**: Sapphire ring appears when tabbed to (not black outline)
- [ ] **Timing**: Animations feel smooth (140ms hover, 120ms press)

**Expected Feel**: Calm, refined, professional (not harsh black)

#### **Secondary Buttons** (Less prominent actions)

- [ ] **Background**: White with hairline border
- [ ] **Border Color**: Very light gray (#E8EBED)
- [ ] **Hover**: Background becomes off-white (#F9FAFB)
- [ ] **Hover Lift**: -1px upward movement
- [ ] **Text Color**: Graphite (#374151)
- [ ] **Focus Ring**: Sapphire ring

**Expected Feel**: Subtle, elegant borders (not heavy)

#### **Tertiary Buttons** (Text-only buttons)

- [ ] **Default**: Transparent background, graphite text
- [ ] **Hover**: Light gray background appears (#F9FAFB)
- [ ] **Hover Lift**: -1px upward movement
- [ ] **Text**: Darkens slightly on hover

**Expected Feel**: Minimal, text-focused

#### **Danger Buttons** (Delete, destructive actions)

- [ ] **Color**: Red background preserved
- [ ] **Hover**: Darkens to garnet (#B91C1C)
- [ ] **Hover Lift**: -1px upward movement
- [ ] **Shadow**: Red-tinted shadow

**Expected Feel**: Warning, but refined

---

## ✅ Input Testing Checklist

### Test Locations
- Login form (email/password inputs)
- Add Idea modal (title, description)
- Edit Idea modal
- Search inputs
- Any form fields

### What to Look For

#### **Input Borders**

- [ ] **Default**: Very light hairline border (#E8EBED)
- [ ] **Hover**: Border darkens slightly (#D1D5DB)
- [ ] **Focus**: Border becomes sapphire blue (#3B82F6)
- [ ] **Transition**: Smooth color change (190ms)

**Expected Feel**: Hairline borders (more refined than thick borders)

#### **Focus Ring**

- [ ] **Appearance**: Sapphire ring with soft glow
- [ ] **Fade-In**: Ring smoothly fades in (190ms)
- [ ] **Spread**: 4px ring around input
- [ ] **Opacity**: Soft, not harsh (10% opacity)
- [ ] **No Outline**: Black outline is gone

**Expected Feel**: Soft sapphire glow (confident, professional)

#### **Input Icons** (if present, like search icons)

- [ ] **Default**: Gray color (#6B7280)
- [ ] **Focus**: Changes to sapphire (#3B82F6)
- [ ] **Transition**: Smooth color change (140ms)

**Expected Feel**: Icons "light up" on focus

#### **Placeholder Text**

- [ ] **Color**: Light gray (#9CA3AF)
- [ ] **Readable**: Still legible but subtle

#### **Background**

- [ ] **Primary Inputs**: White background
- [ ] **Secondary Inputs**: Off-white (#F9FAFB)
- [ ] **Inset Shadow**: Very subtle inner shadow

**Expected Feel**: Clean, refined surfaces

---

## ✅ Animation Timing Tests

### Hover Animations
- [ ] Button hover lift feels smooth (not instant, not slow)
- [ ] Shadow expansion is noticeable but subtle
- [ ] Background color transitions are smooth

**Expected Timing**: 140ms (feels responsive but calm)

### Press Animations
- [ ] Button press returns to baseline quickly
- [ ] Feels tactile and responsive

**Expected Timing**: 120ms (instant feedback)

### Focus Animations
- [ ] Focus ring fades in smoothly (not instant)
- [ ] Icon color transitions are smooth
- [ ] Border color changes are fluid

**Expected Timing**: 190ms (confident, purposeful)

---

## ✅ Cross-Component Consistency

### Check Multiple Locations
- [ ] All primary buttons use same graphite color
- [ ] All inputs have same hairline borders
- [ ] All focus rings are sapphire
- [ ] Animation timing feels consistent

**Expected Feel**: Cohesive design system throughout

---

## ✅ Accessibility Tests

### Keyboard Navigation
- [ ] Tab through buttons - focus rings visible
- [ ] Tab through inputs - focus rings visible
- [ ] Focus indicators are clear
- [ ] No visual jumpiness

### Reduced Motion (if you have it enabled)
- [ ] Animations still work or are disabled properly
- [ ] No broken layouts

---

## ❌ What Should NOT Have Changed

### Matrix & Idea Cards (Excluded)
- [ ] **DesignMatrix component**: No Lux changes (preserve performance)
- [ ] **IdeaCardComponent**: No Lux changes (preserve drag-drop)
- [ ] Matrix drag-and-drop still works normally
- [ ] Card positioning unchanged

### Existing Functionality
- [ ] All buttons still clickable
- [ ] All inputs still accept text
- [ ] Forms still submit
- [ ] No broken interactions

---

## 🎨 Overall Design Assessment

### Subjective Feel
- [ ] Design feels more **refined** (not harsh)
- [ ] Colors are more **subtle** (graphite vs black)
- [ ] Animations are **calm and purposeful**
- [ ] Focus states are **more visible**
- [ ] Overall aesthetic is **professional**

### Compared to Before
- [ ] Less harsh contrast
- [ ] More cohesive color palette
- [ ] Smoother interactions
- [ ] More polished feel

---

## 🐛 Issues to Report

If you encounter any issues, note:

1. **What component** (button, input, modal, etc.)
2. **What page/location**
3. **What's wrong** (broken animation, wrong color, etc.)
4. **Screenshot** if possible

---

## ✅ Sign-Off

After testing, confirm:

- [ ] Buttons have correct Lux styling
- [ ] Inputs have correct Lux styling
- [ ] Animations are smooth
- [ ] No functionality broken
- [ ] Matrix/idea cards unchanged
- [ ] Overall design improvement confirmed

**Tester**: _________________
**Date**: _________________
**Approval**: ⬜ PASS  ⬜ NEEDS FIXES

---

## 📸 Reference: What You Should See

### Buttons Before → After
- **Before**: Pure black (#000000) primary buttons
- **After**: Refined graphite (#374151) primary buttons

### Inputs Before → After
- **Before**: Thick gray borders, black focus outline
- **After**: Hairline borders, sapphire focus ring

### Animations Before → After
- **Before**: Faster/instant transitions
- **After**: 140ms-190ms smooth, calm transitions

---

## 🚀 Next Steps After Testing

If tests PASS:
- ✅ Continue with Card components (Phase 2 completion)
- ✅ Apply card-hover animations
- ✅ Final Phase 2 checkpoint

If tests FAIL:
- ⚠️ Document issues
- ⚠️ Fix problems
- ⚠️ Re-test

---

**Testing URL**: http://localhost:3006/
**Documentation**: claudedocs/PHASE_2_VISUAL_TEST_CHECKLIST.md
**Phase**: 2 - Core Components (Buttons & Inputs)
