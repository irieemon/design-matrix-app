<!-- GSD:project-start source:PROJECT.md -->
## Project

**Prioritas**

Prioritas is a collaborative prioritization tool that combines AI-powered multi-modal analysis with real-time brainstorming and a visual design matrix. Teams and individuals use it to brainstorm ideas, analyze them with AI across text, images, video, and audio, then prioritize them on an interactive matrix. Built with React, TypeScript, Supabase, and deployed on Vercel with a freemium billing model via Stripe.

**Core Value:** Real-time collaborative brainstorming with AI-powered multi-modal analysis — teams can submit ideas from any device, analyze them with the right AI model for the task, and visually prioritize together on a shared matrix.

### Constraints

- **Timeline**: 2-4 weeks to public launch
- **Tech stack**: React + TypeScript + Vite + Supabase + Vercel (established, no migrations)
- **Billing**: Freemium model — free tier must be functional, paid tiers must gate features
- **Security**: Must fix CSRF, rate limiting, and password reset before any public access
- **AI costs**: Multi-modal analysis (vision, audio, video) is expensive — must enforce subscription limits
- **Mobile**: Brainstorming on phones is a key use case — not just responsive, genuinely usable
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.2.2 - All source code, strict mode enabled
- JSX/TSX - React component definitions
- JavaScript - Configuration files and utilities
- CSS/Tailwind - Styling via `tailwind.config.js`
## Runtime
- Node.js 22.19.0 (specified in `.nvmrc`)
- Browser: ES2020 target (modern browsers only)
- npm (npm 10.x implied by Node 22)
- Lockfile: `package-lock.json` present (v3, npm 9+)
## Frameworks
- React 18.2.0 - UI framework
- Vite 5.0.8 - Build tool and dev server (ESM-first, fast rebuilds)
- TypeScript 5.2.2 - Type system for entire codebase
- React Router 7.9.1 - Client-side routing
- Tailwind CSS 3.3.6 - Utility-first CSS framework
- PostCSS 8.4.32 - CSS processing pipeline
- Lucide React 0.294.0 - Icon library
- @dnd-kit/core 6.1.0 - Drag-and-drop primitives
- @dnd-kit/sortable 8.0.0 - Sortable list plugin
- @dnd-kit/utilities 3.2.2 - Utility functions for dnd-kit
- jsPDF 3.0.2 - PDF generation library
- pdfmake 0.2.20 - PDF document building
- html2canvas 1.4.1 - HTML-to-canvas screenshot capture
- pdfjs-dist 5.4.394 - PDF rendering engine
- Recharts 3.4.1 - React charting library (used in analytics/reports)
- Vitest 3.2.4 - Unit test runner (Vite-native)
- @vitest/ui 3.2.4 - Vitest web UI
- @vitest/coverage-v8 3.2.4 - Code coverage reporter
- Playwright 1.55.0 - E2E and integration testing
- @playwright/test 1.55.0 - Playwright test runner
- @axe-core/playwright 4.10.2 - Accessibility testing
- axe-playwright 2.2.2 - Accessibility assertions
- Testing Library React 16.3.0 - React component testing utilities
- Testing Library User Event 14.6.1 - User interaction simulation
- JSDOM 27.0.0 - DOM implementation for tests
- Happy DOM 18.0.1 - Alternative lightweight DOM
- @vitejs/plugin-react 4.2.1 - React Fast Refresh
- TypeScript ESLint 8.47.0 - TypeScript linting
- ESLint 9.39.1 - Code style enforcement
- eslint-plugin-react 7.37.5 - React-specific rules
- eslint-plugin-react-hooks 7.0.1 - React hooks linting
- Globals 16.5.0 - Global scope definitions
- tsx 4.20.5 - TypeScript executor for Node
- Helmet 8.1.0 - HTTP header security middleware
- Express Rate Limit 8.1.0 - Rate limiting for APIs
- DOMPurify 3.2.7 - HTML sanitization
- Validator 13.15.23 - String validation library
## Key Dependencies
- @supabase/supabase-js 2.57.2 - Supabase client SDK (database, auth, realtime)
- stripe 17.5.0 - Stripe Node.js SDK (server-side payment processing)
- @stripe/stripe-js 5.3.0 - Stripe JavaScript client (checkout)
- @emailjs/browser 4.4.1 - Client-side email API (collaboration invitations)
- uuid 9.0.1 - UUID generation for IDs
- @vercel/analytics 1.5.0 - Vercel Web Vitals analytics
- @vercel/node 5.3.21 - Vercel Node.js runtime types (dev only)
- msw 2.11.2 - API mocking for tests
- Puppeteer 24.22.1 - Headless browser automation (for visual tests)
## Configuration
- Frontend: Uses `import.meta.env.VITE_*` for static Vite replacement at build time
- Backend API: Uses `process.env` directly (Node.js environment variables)
- `.env` files: Listed in `.gitignore` (never committed)
- `VITE_SUPABASE_URL` - Supabase project URL (frontend, public)
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous public key (frontend)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend API only, never exposed to frontend)
- `OPENAI_API_KEY` - OpenAI API key (backend only)
- `ANTHROPIC_API_KEY` - Anthropic Claude API key (backend only)
- `STRIPE_SECRET_KEY` - Stripe secret key (backend only)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signature verification key
- `VITE_STRIPE_PRICE_ID_TEAM` - Team tier price ID (frontend checkout)
- `VITE_STRIPE_PRICE_ID_ENTERPRISE` - Enterprise tier price ID (frontend checkout)
- `VITE_EMAILJS_SERVICE_ID` - EmailJS service ID (frontend)
- `VITE_EMAILJS_TEMPLATE_ID` - EmailJS template ID (frontend)
- `VITE_EMAILJS_PUBLIC_KEY` - EmailJS public API key (frontend)
- `vite.config.ts` - Vite configuration with React plugin, API middleware for development
- `tsconfig.json` - TypeScript compiler options (ES2020 target, strict mode, JSX support)
- `eslint.config.js` - ESLint flat config (v9 format)
- `vitest.config.ts` - Vitest configuration with JSDOM environment
- `tailwind.config.js` - Tailwind CSS theme and component configuration
- `vercel.json` - Vercel deployment configuration (build command, functions, rewrites)
## Platform Requirements
- Node.js 22.19.0 or compatible
- npm 10.x
- Modern browser with ES2020 support
- macOS/Linux/Windows (npm scripts test with bash)
- Vercel deployment platform (uses `vercel.json` for configuration)
- Serverless functions for `/api` routes
- Static asset hosting for SPA
- Node.js runtime for API functions
- Chrome/Chromium (latest)
- Firefox (latest)
- Safari/WebKit (latest)
- Mobile Chrome/Safari (modern versions)
## Build & Deployment
- SPA served from `dist/index.html`
- Static assets in `dist/assets/`
- Lazy-loaded chunks via code splitting
- API routes as serverless functions
- `npm run dev` - Vite dev server on port 3003
- Live reload with Fast Refresh
- API middleware for local `/api` route testing
- Content Security Policy headers for development
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Components: PascalCase (e.g., `Button.tsx`, `AuthScreen.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useAuth.ts`, `useComponentState.ts`)
- Utilities: camelCase (e.g., `logger.ts`, `promiseUtils.ts`)
- Tests: match source file with `.test.ts` or `.test.tsx` suffix (e.g., `Button.test.tsx`)
- Types/Interfaces: PascalCase with descriptive names (e.g., `ButtonProps`, `UseAuthReturn`)
- Constants: UPPER_SNAKE_CASE (e.g., `SUPABASE_STORAGE_KEY`, `TIMEOUTS`)
- camelCase with action verb prefixes: `handle*`, `check*`, `get*`, `set*`, `export*`
- Example: `handleAuthSuccess`, `checkUserProjectsAndRedirect`, `getCachedUserProfile`
- Custom hooks always start with `use`: `useAuth`, `useComponentState`, `useOptionalComponentStateContext`
- Callback functions use `on*` pattern: `onStateChange`, `onAsyncAction`, `onClick`
- camelCase for local/component state: `currentUser`, `isLoading`, `hasError`
- Private refs and state use naming convention to indicate intent: `ref`, `Ref` suffix for useRef holders
- Unused variables prefixed with underscore: `_error`, `_response` (documented in ESLint config)
- Interfaces: PascalCase with `I` prefix or descriptive name (e.g., `ButtonProps`, `UseAuthReturn`)
- Type aliases: PascalCase (e.g., `ButtonVariant`, `ButtonState`)
- Union types named with `*Type` or `*Union` (e.g., `UserRole = 'user' | 'admin' | 'super_admin'`)
- Generic types use single capital letters or descriptive names (e.g., `<T>`, `<T extends object>`)
## Code Style
- No dedicated .prettierrc found - style follows ESLint enforcement
- Indentation: 2 spaces (standard React convention)
- Line length: Not explicitly configured
- String quotes: Single quotes enforced by convention (seen in codebase)
- Semicolons: Required (TypeScript strict mode enabled)
- Tool: ESLint v9 with flat config format (`eslint.config.js`)
- Configuration approach: Modern flat config (migrated from `.eslintrc.json`)
- Parser: `typescript-eslint` (unified package replacing separate parser + plugin)
- Key rules enforced:
- Test files: `**/__tests__/**`, `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx`
- Config files: `*.config.js`, `*.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- Build output: `dist/`, `coverage/`
- Backend: `api/` directory (separate TypeScript project)
## Import Organization
- Alias configured: `@` → `./src` (in `vitest.config.ts` and `tsconfig.json`)
- Usage: `import { Button } from '@/components/ui/Button'` (recommended for non-test files)
- Tests commonly use relative paths: `import { Button } from '../Button'`
## Error Handling
- Try/catch blocks with nested try/catch for different failure modes
- Error discrimination via `instanceof Error` and error message matching
- Unused error variables prefixed with underscore: `catch (_error)` then reference as `error` if needed
- Example from `src/hooks/useAuth.ts`:
- Promise.allSettled for non-blocking parallel operations (handles some failures without blocking)
- Timeout wrappers using `withTimeout()` utility for API calls
- Graceful degradation: Services fallback to basic user data when full profile fetch fails
- Storage fallback: If Supabase call fails, fallback to localStorage data
- Use `logger.error()` for exceptions that need investigation
- Use `logger.warn()` for expected failures (timeouts, missing cache)
- Use `logger.debug()` for contextual information during error recovery
## Logging
- Debug mode controlled via URL parameter: `?debug=true`
- Production mode: only `warn` and `error` levels shown
- Debug mode: all levels shown (`debug`, `info`, `warn`, `error`)
- Throttling: debug logs throttled at 10-second intervals to prevent spam
- Rate limiting: per-level limits (debug: 5/sec, info: 8/sec, warn: 20/sec, error: 50/sec)
## Comments
- Complex logic requiring explanation (e.g., performance optimizations, auth timeout handling)
- Security-related decisions (marked with `// ✅ SECURITY FIX:` or `// ❌ Risk:`)
- Non-obvious workarounds (marked with `// CRITICAL FIX:` or `// HACK:`)
- Performance notes (marked with `// PERFORMANCE OPTIMIZED:`)
- Used for utility functions and exported functions
- Documents parameters, return types, and examples
- Example from `src/utils/promiseUtils.ts`:
## Function Design
- Example: `useAuth` hook is ~630 lines due to nested error handling and multiple fallback scenarios
- Prefer object destructuring: `function myFunc({ param1, param2 } = {})`
- Generic constraints for reusable utilities: `function getSessionCache<T>()`
- Options objects for many parameters: `interface UseAuthOptions { ... }`
- Always specify return types in TypeScript (no implicit `any`)
- Return objects with descriptive property names: `{ currentUser, isLoading, handleAuthSuccess }`
- Custom hooks return interface: `interface UseAuthReturn { ... }`
## Module Design
- Named exports preferred: `export const Button = ...` or `export function useAuth() { ... }`
- Default exports used for components: `export default Button`
- Barrel files (index.ts) used to aggregate related exports
- Located at directory level: `src/components/ui/index.ts`, `src/utils/index.ts`
- Import from barrel files in parent directories: `import { Button, Input } from '@/components/ui'`
- Individual imports preferred in test files for clarity
## Special Patterns Observed
- useRef used for mutable values that don't trigger re-renders
- useRef used for callback function stability: `handleAuthSuccessRef.current = handleAuthSuccess`
- Example: `const buttonRef = useRef<HTMLButtonElement>(null)`
- Custom wrapper pattern to safely call hooks conditionally:
- useCallback with explicit dependency arrays to memoize functions
- useEffect cleanup functions to prevent memory leaks
- Cache management (ProfileService cache, session cache)
- Demo users identified via `isDemoUUID()` or `isDemoUser` flag
- Demo UUIDs follow pattern: `00000000-0000-0000-0000-0000000000XX`
- Skip database calls and use client-side fallback data for demo users
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- React SPA (Vite) with Context-based state management eliminating prop drilling
- Repository pattern for data abstraction in `src/lib/repositories/`
- Serverless API routes in `api/` (Vercel functions) handling authentication and external integrations
- Lazy-loaded components for performance optimization
- Supabase for authentication and database with RLS enforcement
- Real-time capabilities via Supabase Realtime channels with fallback polling
## Layers
- Purpose: React components rendering UI and handling user interaction
- Location: `src/components/`
- Contains: Page components, modals, feature-specific components (matrix, brainstorm, admin)
- Depends on: Custom hooks, contexts, repositories
- Used by: React render tree
- Purpose: Centralized state management without prop drilling
- Location: `src/contexts/`
- Contains: AppProviders, AuthMigrationProvider, ProjectProvider, ModalProvider, AdminProvider, ComponentStateProvider, NavigationProvider
- Depends on: Repositories, authentication utilities
- Used by: All presentation components via hooks
- Purpose: Encapsulate reusable logic and async operations
- Location: `src/hooks/`
- Contains: useAuth, useSecureAuth, useIdeas, useBrainstormRealtime, useOptimisticUpdates, feature-specific hooks
- Depends on: Repositories, contexts, external libraries
- Used by: Components for state and side effects
- Purpose: Abstract database operations and enforce consistent data patterns
- Location: `src/lib/repositories/`
- Contains: projectRepository, ideaRepository, userRepository, brainstormSessionRepository, sessionParticipantRepository
- Depends on: Supabase clients, authentication utilities
- Used by: Hooks and contexts for data fetching
- Purpose: Serverless functions handling auth, AI, admin operations, payment processing
- Location: `api/` (Vercel functions)
- Contains: auth.ts, ai.ts, admin.ts, ideas.ts, user.ts, stripe.ts
- Depends on: External APIs (OpenAI, Stripe), Supabase service role key, authentication middleware
- Used by: Frontend via fetch/HTTP requests
- Purpose: Shared TypeScript interfaces for type safety
- Location: `src/types/index.ts`
- Contains: IdeaCard, User, Project, Team, BrainstormSession, Invitation, ActivityLog interfaces
- Used by: All layers for compile-time type checking
- Purpose: Cross-cutting concerns and helper functions
- Location: `src/utils/`, `src/lib/`
- Contains: Logger, PDF generation, security helpers, realtime subscription management, idea locking service
- Used by: Components, hooks, repositories
## Data Flow
## Key Abstractions
- Purpose: Abstract database queries behind consistent interface
- Examples: `src/lib/repositories/ideaRepository.ts`, `projectRepository.ts`, `userRepository.ts`
- Pattern: Functions that encapsulate Supabase queries and return typed data
- Benefit: Centralized error handling, caching logic, RLS policy enforcement
- Purpose: Share state across component tree without prop drilling
- Examples: `ProjectProvider`, `AdminProvider`, `ModalProvider`, `ComponentStateProvider`
- Pattern: useContext hook returns both state and mutation functions
- Benefit: Clean component props, separation of concerns, easy to mock in tests
- Purpose: Extract reusable logic from components
- Examples: `useAuth`, `useIdeas`, `useBrainstormRealtime`, `useOptimisticUpdates`
- Pattern: Encapsulate state + side effects, return interface matching component needs
- Benefit: Logic reusability, testability, cleaner component code
- Purpose: Server-side logic requiring secrets or elevated privileges
- Examples: `/api/auth`, `/api/ai`, `/api/stripe`
- Pattern: Vercel function takes (req, res), validates auth, executes operation, returns JSON
- Benefit: Secrets secured on server, external API integration, business logic isolation
- Purpose: Immediate UI feedback while server catches up
- Location: `useOptimisticUpdates.ts`
- Pattern: Update UI immediately, queue server request, rollback on failure
- Benefit: Perceived performance, user experience
## Entry Points
- Location: `src/main.tsx`
- Triggers: Application load
- Responsibilities: React DOM bootstrap, context provider setup, app initialization
- Location: `src/App.tsx`
- Triggers: After main.tsx mounts
- Responsibilities: Route hash handling (demo, mobile join), provider wrapping, component selection
- Location: `src/components/app/MainApp.tsx`
- Triggers: User authenticated
- Responsibilities: Main layout, navigation, page routing
- Location: `api/*.ts` (Vercel functions)
- Triggers: POST/GET to `/api/{endpoint}`
- Responsibilities: Request validation, service layer delegation, response serialization
- Location: `vite.config.ts` with middleware
- Triggers: Dev mode API requests
- Responsibilities: SSR module loading for API routes during development, environment setup
## Error Handling
- `src/components/ErrorBoundary.tsx`: Catches React render errors
- Project loading in `MainApp.tsx`: Falls back to empty state
- Brainstorm realtime in `useBrainstormRealtime.ts`: Falls back to polling
- PDF generation: Shows error toast, allows retry
## Cross-Cutting Concerns
- Framework: `src/utils/logger.ts`
- Pattern: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`
- Used in: Auth hydration, API requests, realtime events
- Framework: Zod schemas in API routes and repositories
- Examples: `api/auth.ts` validates request body, `api/ai.ts` validates idea format
- Pattern: Schema.parse() throws on invalid data, caught and returned as error
- Strategy: httpOnly cookies for tokens (preferred) + legacy localStorage support
- Implementation: `src/lib/authClient.ts` with `createAuthenticatedClient()`
- Flow: Login → store in httpOnly cookie → request includes cookie automatically
- Framework: Supabase Realtime channels
- Pattern: `useBrainstormRealtime.ts` subscribes to channel, listens for broadcasts
- Fallback: Polling if WebSocket unavailable (4s interval)
- Example: Brainstorm session gets new ideas from channel or polling
- RLS: Supabase Row-Level Security policies on all tables
- CSRF: Cookie-based tokens validated server-side
- API Routes: Service role key protected in environment variables
- Secrets: Never exposed to frontend (API_KEY, STRIPE_SECRET_KEY only on backend)
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
