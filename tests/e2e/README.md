# Comprehensive E2E Test Suite

## Overview

This directory contains comprehensive end-to-end tests for visual regression and accessibility compliance testing of the Design Matrix application.

## Test Suites

### 1. Visual Regression Testing (`visual-regression-comprehensive.spec.ts`)

**Total Tests: 45+**

Comprehensive screenshot-based testing to detect unintended visual changes.

#### Test Categories:

**Pages (6 tests)**
- Login screen
- Dashboard (empty state)
- Dashboard with ideas
- Matrix view
- User settings
- Project management

**Modals (6 tests)**
- Add idea modal
- Add idea modal (filled form)
- Edit idea modal
- AI insights modal
- Feature detail modal
- Confirm delete modal

**Components (10 tests)**
- Idea card (default, hover, dragging states)
- Sidebar (collapsed, expanded)
- Quadrant labels
- Buttons (primary, secondary)
- Form inputs
- Loading spinner

**Responsive Breakpoints (8 tests)**
- Mobile Small (320x568)
- Mobile (375x667)
- Mobile Large (414x896)
- Tablet Portrait (768x1024)
- Tablet Landscape (1024x768)
- Desktop (1440x900)
- Desktop Large (1920x1080)
- Desktop Wide (2560x1440)

**Quadrants with Ideas (5 tests)**
- Quick Wins quadrant (multiple ideas)
- Strategic quadrant (multiple ideas)
- Reconsider quadrant (multiple ideas)
- Avoid quadrant (multiple ideas)
- All quadrants balanced distribution

**Application States (5 tests)**
- Error state (invalid data)
- Loading state (initial load)
- Empty state (no ideas)
- Empty state (no projects)
- Success state (idea added)

### 2. Accessibility Testing (`accessibility-comprehensive.spec.ts`)

**Total Tests: 35+**

Comprehensive WCAG 2.1 AA compliance and accessibility testing.

#### Test Categories:

**WCAG 2.1 AA Compliance (6 tests)**
- Login page compliance
- Dashboard compliance
- Matrix view compliance
- Modal dialog compliance
- Forms compliance
- No critical/serious violations check

**Keyboard Navigation (7 tests)**
- Logical tab order
- Focus visible on all interactive elements
- Matrix navigation without mouse
- Arrow keys for idea movement
- Escape key closes modals
- Enter key activates buttons
- Space key activates buttons

**Screen Reader Support (8 tests)**
- Page has proper landmarks
- All images have alt text
- Buttons have accessible names
- Form inputs have labels
- Idea cards have proper roles
- Live regions for dynamic content
- Modal has proper dialog role
- Focus trap in modals

**Color Contrast (3 tests)**
- Automated contrast check
- Dark mode support
- High contrast mode

**Touch Targets (2 tests)**
- Minimum size 44x44px on mobile
- Adequate spacing between targets

**Motion and Animation (2 tests)**
- Respects reduced motion preference
- No flashing content (seizure prevention)

**Forms Accessibility (3 tests)**
- Error messages are accessible
- Required fields are marked
- Field instructions are associated

**Skip Links and Navigation (2 tests)**
- Skip to main content functionality
- Heading hierarchy is logical

## Running Tests

### Prerequisites

```bash
# Install Playwright browsers
npm run playwright:install
```

### Run All E2E Tests

```bash
npm run e2e:all
```

### Run Specific Test Suites

```bash
# Visual regression tests only
npm run e2e:visual

# Accessibility tests only
npm run e2e:accessibility
```

### Interactive Mode

```bash
# Run with Playwright UI for debugging
npm run e2e:ui

# Run with step-by-step debugging
npm run e2e:debug
```

### Update Visual Baselines

When intentional UI changes are made:

```bash
npm run e2e:visual:update
```

### View Test Report

```bash
npm run e2e:report
```

## Coverage Goals

### Visual Regression
- 100% of user-facing pages
- 100% of modal dialogs
- 100% of interactive components
- 100% of responsive breakpoints
- 100% of application states

### Accessibility
- 0 critical WCAG violations
- 0 serious WCAG violations
- 100% keyboard navigability
- 100% screen reader compatibility
- 100% color contrast compliance

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
