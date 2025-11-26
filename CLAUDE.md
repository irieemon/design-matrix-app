# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prioritas is a smart prioritization suite for teams. It provides an interactive priority matrix where users drag and drop ideas across value vs effort quadrants with real-time collaboration.

## Commands

```bash
# Development
npm run dev           # Start Vite dev server
npm run build         # Production build
npm run build:check   # TypeScript check + build
npm run type-check    # TypeScript only (no emit)
npm run lint          # ESLint check (zero warnings allowed)
npm run lint:fix      # Auto-fix ESLint issues

# Unit Tests (Vitest)
npm run test          # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage report
npm run test:ui       # Interactive UI dashboard

# Unit Tests - Single file
npm run test -- src/hooks/__tests__/useAuth.test.ts

# E2E Tests (Playwright)
npm run e2e:all       # All E2E tests
npm run e2e:visual    # Visual regression tests
npm run e2e:chromium  # Chromium only
npm run test:functional          # Functional tests
npm run test:functional:headed   # With browser visible

# E2E - Single test file
npx playwright test tests/e2e/auth-complete-journey.spec.ts --reporter=html
```

## Architecture

### Frontend (src/)
- **React 18 + TypeScript + Vite** - Single-page application
- **Tailwind CSS** - Styling with custom design tokens
- **@dnd-kit/core** - Drag and drop for priority matrix
- **React Router** - Client-side routing (hash routes for demos)
- **Context Providers** - AppProviders wraps all contexts to eliminate prop drilling

### Backend (api/)
- **Vercel Serverless Functions** - TypeScript API routes
- **Supabase** - PostgreSQL database with real-time subscriptions
- Key endpoints: `auth.ts`, `ai.ts`, `ideas.ts`, `projects.ts`, `stripe.ts`

### Key Directories
- `src/components/` - React components, `DesignMatrix.tsx` is the main matrix component
- `src/hooks/` - Custom hooks (`useAuth`, `useIdeas`, `useBrowserHistory`, etc.)
- `src/lib/` - Services and utilities (database, auth, logging, AI, PDF processing)
- `src/contexts/` - React context providers
- `tests/` - Playwright E2E tests
- `context/` - Design guidelines and brand standards

### Logging
Use the logging service instead of `console.log`:
```typescript
import { logger } from '@/lib/logging'
logger.info('Message', { data })
logger.error('Error', error, { context })
```

See `src/lib/logging/README.md` for full API.

## Design Guidelines

When making visual changes:
1. Reference `/context/brand_standard.yaml` for colors, typography, and component specs
2. Reference `/context/design-principles-example.md` for design principles
3. Maintain accessibility with contrast ratio > 4.5:1 for body text

Key design values:
- Primary: `#000000`, Secondary: `#6C6C6C`, Background: `#FFFFFF`
- Font: Inter, card radius: 12px, transitions: 200ms ease-in-out

## Critical Rules

**Never run npm commands with sudo** - This causes 35,000+ files to become root-owned and breaks the dev server. Fix underlying permission issues instead.

## Environment Setup

1. Copy `.env.example` to `.env`
2. Add Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## Testing Patterns

- Unit tests use Vitest + React Testing Library + MSW for mocking
- E2E tests use Playwright with multiple configs (functional, visual, performance)
- Mock data in `src/test/utils/test-utils.tsx`
- Test files co-located in `__tests__/` directories or `tests/` root
