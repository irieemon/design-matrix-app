# Architecture

**Analysis Date:** 2025-04-06

## Pattern Overview

**Overall:** Context-Provider + Repository Pattern with Vercel Serverless Functions

**Key Characteristics:**
- React SPA (Vite) with Context-based state management eliminating prop drilling
- Repository pattern for data abstraction in `src/lib/repositories/`
- Serverless API routes in `api/` (Vercel functions) handling authentication and external integrations
- Lazy-loaded components for performance optimization
- Supabase for authentication and database with RLS enforcement
- Real-time capabilities via Supabase Realtime channels with fallback polling

## Layers

**Presentation Layer:**
- Purpose: React components rendering UI and handling user interaction
- Location: `src/components/`
- Contains: Page components, modals, feature-specific components (matrix, brainstorm, admin)
- Depends on: Custom hooks, contexts, repositories
- Used by: React render tree

**Context/State Management Layer:**
- Purpose: Centralized state management without prop drilling
- Location: `src/contexts/`
- Contains: AppProviders, AuthMigrationProvider, ProjectProvider, ModalProvider, AdminProvider, ComponentStateProvider, NavigationProvider
- Depends on: Repositories, authentication utilities
- Used by: All presentation components via hooks

**Hook Layer:**
- Purpose: Encapsulate reusable logic and async operations
- Location: `src/hooks/`
- Contains: useAuth, useSecureAuth, useIdeas, useBrainstormRealtime, useOptimisticUpdates, feature-specific hooks
- Depends on: Repositories, contexts, external libraries
- Used by: Components for state and side effects

**Repository/Data Access Layer:**
- Purpose: Abstract database operations and enforce consistent data patterns
- Location: `src/lib/repositories/`
- Contains: projectRepository, ideaRepository, userRepository, brainstormSessionRepository, sessionParticipantRepository
- Depends on: Supabase clients, authentication utilities
- Used by: Hooks and contexts for data fetching

**API/Backend Layer:**
- Purpose: Serverless functions handling auth, AI, admin operations, payment processing
- Location: `api/` (Vercel functions)
- Contains: auth.ts, ai.ts, admin.ts, ideas.ts, user.ts, stripe.ts
- Depends on: External APIs (OpenAI, Stripe), Supabase service role key, authentication middleware
- Used by: Frontend via fetch/HTTP requests

**Type Definitions:**
- Purpose: Shared TypeScript interfaces for type safety
- Location: `src/types/index.ts`
- Contains: IdeaCard, User, Project, Team, BrainstormSession, Invitation, ActivityLog interfaces
- Used by: All layers for compile-time type checking

**Utilities & Services:**
- Purpose: Cross-cutting concerns and helper functions
- Location: `src/utils/`, `src/lib/`
- Contains: Logger, PDF generation, security helpers, realtime subscription management, idea locking service
- Used by: Components, hooks, repositories

## Data Flow

**User Authentication:**

1. User visits app → `App.tsx` routes through `AppWithAuth`
2. `AppWithAuth` checks `UserContext` for current user
3. If unauthenticated, shows `AuthenticationFlow` component
4. On login: Supabase auth stores session in httpOnly cookies (or localStorage for legacy)
5. `AuthMigrationProvider` hydrates user context on app load
6. Session maintained via Supabase's GoTrueClient

**Idea Creation Pipeline (Brainstorm):**

1. User submits idea in `MobileIdeaSubmitForm.tsx` or `AddIdeaModal.tsx`
2. Component calls hook → repository function → API endpoint (`/api/ideas`)
3. API validates user authentication from httpOnly cookies
4. API inserts idea via service role client (bypasses SELECT RLS)
5. `useBrainstormRealtime` hook subscribes to Supabase Realtime channel
6. Realtime broadcast updates all connected clients
7. Fallback polling triggers if Realtime unavailable
8. `useOptimisticUpdates` hook shows idea optimistically before confirmation

**Matrix Positioning:**

1. Component renders `DesignMatrix.tsx` with draggable ideas
2. Ideas positioned via x/y coordinates (0-520 pixel range)
3. Drag-and-drop via `@dnd-kit` library
4. On drop: repository updates idea coordinates in database
5. `useMatrixPerformance` hook throttles position updates
6. Real-time subscribers receive position broadcasts

**Project Roadmap Generation:**

1. User triggers roadmap export → `ProjectRoadmap` component
2. Component calls `RoadmapRepository.generateRoadmap()`
3. Repository fetches ideas and project settings
4. Generates timeline based on priority and user-defined dates
5. Can export as PDF via `src/lib/pdf/generators/`

**State Management (Project Context Example):**

1. `ProjectProvider` wraps app providers in `AppProviders.tsx`
2. Maintains current project ID and project data
3. On project switch: fetches project details and ideas via repository
4. Child components access via `useProject()` hook
5. Updates broadcast via context dispatch, no prop drilling needed

## Key Abstractions

**Repository Pattern:**
- Purpose: Abstract database queries behind consistent interface
- Examples: `src/lib/repositories/ideaRepository.ts`, `projectRepository.ts`, `userRepository.ts`
- Pattern: Functions that encapsulate Supabase queries and return typed data
- Benefit: Centralized error handling, caching logic, RLS policy enforcement

**Context Providers:**
- Purpose: Share state across component tree without prop drilling
- Examples: `ProjectProvider`, `AdminProvider`, `ModalProvider`, `ComponentStateProvider`
- Pattern: useContext hook returns both state and mutation functions
- Benefit: Clean component props, separation of concerns, easy to mock in tests

**Custom Hooks:**
- Purpose: Extract reusable logic from components
- Examples: `useAuth`, `useIdeas`, `useBrainstormRealtime`, `useOptimisticUpdates`
- Pattern: Encapsulate state + side effects, return interface matching component needs
- Benefit: Logic reusability, testability, cleaner component code

**API Route Handlers:**
- Purpose: Server-side logic requiring secrets or elevated privileges
- Examples: `/api/auth`, `/api/ai`, `/api/stripe`
- Pattern: Vercel function takes (req, res), validates auth, executes operation, returns JSON
- Benefit: Secrets secured on server, external API integration, business logic isolation

**Optimistic Updates:**
- Purpose: Immediate UI feedback while server catches up
- Location: `useOptimisticUpdates.ts`
- Pattern: Update UI immediately, queue server request, rollback on failure
- Benefit: Perceived performance, user experience

## Entry Points

**Browser Entry Point:**
- Location: `src/main.tsx`
- Triggers: Application load
- Responsibilities: React DOM bootstrap, context provider setup, app initialization

**React App Root:**
- Location: `src/App.tsx`
- Triggers: After main.tsx mounts
- Responsibilities: Route hash handling (demo, mobile join), provider wrapping, component selection

**Authenticated App:**
- Location: `src/components/app/MainApp.tsx`
- Triggers: User authenticated
- Responsibilities: Main layout, navigation, page routing

**API Entry Points:**
- Location: `api/*.ts` (Vercel functions)
- Triggers: POST/GET to `/api/{endpoint}`
- Responsibilities: Request validation, service layer delegation, response serialization

**Vite Dev Server:**
- Location: `vite.config.ts` with middleware
- Triggers: Dev mode API requests
- Responsibilities: SSR module loading for API routes during development, environment setup

## Error Handling

**Strategy:** Three-tier error handling (component, hook, API)

**Patterns:**

1. **API Level** (`api/*.ts`):
   - Try-catch wraps handler execution
   - Returns `{ error, message, details }` JSON
   - Status codes: 400 (validation), 401 (auth), 403 (forbidden), 500 (server)

2. **Hook/Repository Level** (`src/hooks/`, `src/lib/`):
   - Catch Supabase errors, translate to user messages
   - Log errors via `logger.error()`
   - Throw or return error state depending on context
   - Realtime subscription errors trigger fallback polling

3. **Component Level** (`src/components/`):
   - `ErrorBoundary.tsx` wraps major sections
   - Modals show user-friendly toast notifications via `ToastContext`
   - Failed requests show inline errors or retry buttons
   - Loading states and spinners for async operations

**Key Error Boundaries:**
- `src/components/ErrorBoundary.tsx`: Catches React render errors
- Project loading in `MainApp.tsx`: Falls back to empty state
- Brainstorm realtime in `useBrainstormRealtime.ts`: Falls back to polling
- PDF generation: Shows error toast, allows retry

## Cross-Cutting Concerns

**Logging:** 
- Framework: `src/utils/logger.ts`
- Pattern: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`
- Used in: Auth hydration, API requests, realtime events

**Validation:**
- Framework: Zod schemas in API routes and repositories
- Examples: `api/auth.ts` validates request body, `api/ai.ts` validates idea format
- Pattern: Schema.parse() throws on invalid data, caught and returned as error

**Authentication:**
- Strategy: httpOnly cookies for tokens (preferred) + legacy localStorage support
- Implementation: `src/lib/authClient.ts` with `createAuthenticatedClient()`
- Flow: Login → store in httpOnly cookie → request includes cookie automatically

**Real-time Data:**
- Framework: Supabase Realtime channels
- Pattern: `useBrainstormRealtime.ts` subscribes to channel, listens for broadcasts
- Fallback: Polling if WebSocket unavailable (4s interval)
- Example: Brainstorm session gets new ideas from channel or polling

**Security:**
- RLS: Supabase Row-Level Security policies on all tables
- CSRF: Cookie-based tokens validated server-side
- API Routes: Service role key protected in environment variables
- Secrets: Never exposed to frontend (API_KEY, STRIPE_SECRET_KEY only on backend)

---

*Architecture analysis: 2025-04-06*
