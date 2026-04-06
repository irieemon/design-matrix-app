# Codebase Structure

**Analysis Date:** 2025-04-06

## Directory Layout

```
design-matrix-app/
├── api/                          # Serverless API routes (Vercel functions)
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # App root with routing
│   ├── index.css                 # Global styles
│   ├── components/               # React components organized by feature
│   ├── contexts/                 # State management providers
│   ├── hooks/                    # Custom hooks (logic extraction)
│   ├── lib/                      # Data access, utilities, business logic
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Utility functions (logging, helpers)
│   ├── styles/                   # Tailwind and component styles
│   ├── pages/                    # Page components (routes)
│   ├── test/                     # Test utilities and fixtures
│   └── claudedocs/               # Documentation
├── tests/                        # E2E tests (Playwright)
├── public/                       # Static assets
├── .vercel/                      # Vercel project configuration
├── .planning/                    # GSD documentation
├── vite.config.ts                # Vite build configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies and scripts
└── tailwind.config.js            # Tailwind CSS configuration
```

## Directory Purposes

**api/**
- Purpose: Serverless API endpoints for authentication, AI, admin, payment, and data operations
- Contains: TypeScript handler functions that accept (VercelRequest, VercelResponse)
- Key files: `auth.ts`, `ai.ts`, `admin.ts`, `ideas.ts`, `user.ts`, `stripe.ts`
- Security: Service role key, environment variables, request validation
- Deployed to: Vercel Functions (callable via `/api/{route}`)

**src/components/**
- Purpose: React component library organized by feature/scope
- Contains: Functional components using hooks and contexts
- Key subdirectories:
  - `app/`: Application wrappers (AppWithAuth, MainApp, AuthenticationFlow)
  - `auth/`: Authentication UI (login, signup, password reset)
  - `matrix/`: Design matrix visualization and interaction
  - `brainstorm/`: Brainstorm session UI components
  - `pages/`: Full-page components (FAQ, Pricing, Projects, etc.)
  - `ui/`: Reusable UI components (Modal, Button, Modal variants)
  - `admin/`: Admin panel and modals
  - `layout/`: Layout components (Sidebar, PageRouter, header)
  - `featureModal/`: Feature detail and creation modals
  - `timeline/`: Roadmap timeline visualization
  - `aiStarter/`: AI-assisted project starter
  - `shared/`: Shared modal and utility components
  - `exports/`: Export functionality (PDF, CSV)
  - `demo/`: Demo components for UI testing
  - `dev/`: Development and debug components
  - `accessibility/`: Accessibility-focused components
  - `projectRoadmap/`: Project roadmap specific components

**src/contexts/**
- Purpose: Centralized state management using React Context API
- Contains: Provider components and custom hooks returning context state
- Key files:
  - `AppProviders.tsx`: Root provider that wraps all contexts
  - `AuthMigration.tsx`: Auth hydration and session restoration
  - `ProjectProvider.tsx`: Current project state and operations
  - `ModalProvider.tsx`: Modal open/close state
  - `AdminProvider.tsx`: Admin mode and permissions
  - `ComponentStateProvider.tsx`: UI state (sidebar collapse, selected idea, etc.)
  - `NavigationProvider.tsx`: Navigation state and routing
  - `UserContext.tsx`: Current user and auth status
  - `SecureAuthContext.tsx`: Secure auth state management
  - `ToastContext.tsx`: Toast notification state
  - `SkeletonProvider.tsx`: Skeleton loading UI state

**src/hooks/**
- Purpose: Encapsulate reusable logic and async operations
- Contains: Custom hooks that manage state and side effects
- Key hooks:
  - `useAuth.ts`: Authentication status and login/logout
  - `useSecureAuth.ts`: Secure cookie-based auth
  - `useIdeas.ts`: Fetch and manage ideas for a project
  - `useBrainstormRealtime.ts`: Real-time subscription to brainstorm ideas
  - `useOptimisticUpdates.ts`: Optimistic UI updates
  - `useAdminAuth.ts`: Admin permission checking
  - `useProjectFiles.ts`: File upload and management
  - `useMatrixPerformance.ts`: Matrix rendering optimization
  - `useFullScreenMode.ts`: Full-screen matrix view
  - `featureModal/`: Hooks for feature detail modal logic
  - `shared/`: Base hooks like `useAsyncOperation.ts`, `useDatabase.ts`

**src/lib/**
- Purpose: Business logic, data access, and utility modules
- Contains: Services, repositories, configuration, security helpers
- Key subdirectories:
  - `repositories/`: Data access layer (ideaRepository, projectRepository, userRepository, brainstormSessionRepository)
  - `database/`: Database utilities (services, RLS helpers, validation)
  - `pdf/`: PDF generation (PdfGenerator classes for different formats)
  - `ai/`: AI integration logic
  - `security/`: Security utilities (CSRF, brainstorm access validation)
  - `config/`: Configuration (tierLimits, constants)
  - `authClient.ts`: Authenticated Supabase client factory
  - `supabase.ts`: Core Supabase client initialization

**src/types/index.ts**
- Purpose: Shared TypeScript type definitions
- Contains: Interfaces for core domain objects
- Key types:
  - `IdeaCard`: Idea with position and metadata
  - `Project`: Project data structure
  - `User`, `AuthUser`: User identity
  - `Team`, `TeamMember`: Team collaboration
  - `ProjectCollaborator`: Project access control
  - `BrainstormSession`: Brainstorm session state
  - `ProjectRoadmap`, `RoadmapPhase`: Timeline structure
  - `InsightsData`: Analytics/insights structure
  - `Subscription`, `TeamSettings`: Feature configuration

**src/utils/**
- Purpose: Helper functions and utilities
- Contains: Logger, validators, data transformers
- Key files:
  - `logger.ts`: Structured logging utility
  - `validators.ts`: Data validation helpers
  - URL and encoding utilities
  - Calculation helpers for matrix positioning

**src/test/**
- Purpose: Shared testing utilities and fixtures
- Contains: Mock data, test helpers, setup utilities
- Subdirectories:
  - `mocks/`: Mock Supabase client, auth mocks
  - `fixtures/`: Test data factories
  - `utils/`: Test utilities (render helpers)
  - `__tests__/`: Test files for utilities

**tests/**
- Purpose: End-to-end tests using Playwright
- Contains: Test specs for auth flow, matrix, brainstorm, accessibility
- Key test suites:
  - `auth-*.spec.ts`: Login, signup, password reset, security
  - `matrix/*.spec.ts`: Matrix positioning, drag-and-drop, visual regression
  - `brainstorm/*.spec.ts`: Brainstorm session lifecycle
  - `performance-benchmarks-e2e.spec.ts`: Performance monitoring
  - `accessibility-comprehensive.spec.ts`: a11y validation
  - `cross-browser-compatibility.spec.ts`: Multi-browser testing

**Configuration Files**
- `vite.config.ts`: Vite build tool, development server with API middleware
- `tsconfig.json`: TypeScript strict mode, module resolution
- `tailwind.config.js`: Tailwind CSS utility classes
- `package.json`: Dependencies, scripts, project metadata
- `playwright.e2e.config.ts`: E2E test configuration
- `.vercel/project.json`: Vercel deployment settings

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React DOM bootstrap, context providers, ToastProvider setup
- `src/App.tsx`: Hash-based routing (demo, mobile join), app root
- `src/components/app/MainApp.tsx`: Main authenticated app layout and navigation

**Authentication:**
- `src/components/app/AuthenticationFlow.tsx`: Auth state wrapper
- `src/components/auth/AuthScreen.tsx`: Login/signup UI
- `src/contexts/AuthMigration.tsx`: Session hydration on app load
- `src/contexts/UserContext.tsx`: User state management
- `api/auth.ts`: Login, signup, logout, session refresh endpoints

**Data Access:**
- `src/lib/repositories/ideaRepository.ts`: Fetch/create/update/delete ideas
- `src/lib/repositories/projectRepository.ts`: Project CRUD operations
- `src/lib/repositories/userRepository.ts`: User profile operations
- `src/lib/repositories/brainstormSessionRepository.ts`: Brainstorm session management

**Real-time & Sync:**
- `src/hooks/useBrainstormRealtime.ts`: Subscribe to brainstorm updates
- `src/lib/database/services/RealtimeSubscriptionManager.ts`: Subscription lifecycle
- `src/lib/database/services/IdeaLockingService.ts`: Concurrency control

**Matrix & Visualization:**
- `src/components/DesignMatrix.tsx`: Main matrix component with drag-and-drop
- `src/components/matrix/`: Matrix utilities and sub-components
- `src/hooks/useMatrixPerformance.ts`: Performance optimization

**Modals & UI:**
- `src/components/shared/Modal.tsx`: Base modal component
- `src/components/AddIdeaModal.tsx`: Create idea modal
- `src/components/EditIdeaModal.tsx`: Edit idea modal
- `src/components/FeatureDetailModal.tsx`: Feature timeline modal
- `src/components/AIInsightsModal.tsx`: AI analysis modal

**PDF & Export:**
- `src/lib/pdf/generators/RoadmapPdfGenerator.ts`: Timeline PDF export
- `src/lib/pdf/generators/InsightsPdfGenerator.ts`: Insights PDF export
- `src/components/exports/`: Export UI components

**Admin:**
- `src/components/admin/`: Admin panel components
- `api/admin.ts`: Admin API endpoints (user management, reports)

**AI Integration:**
- `api/ai.ts`: OpenAI integration (idea generation, insights analysis)
- `src/components/AIStarterModal.tsx`: AI project starter UI

**External APIs:**
- `api/stripe.ts`: Stripe payment integration
- `src/hooks/useSecureAuth.ts`: Secure authentication utilities

## Naming Conventions

**Files:**
- Components: PascalCase + `.tsx` (e.g., `DesignMatrix.tsx`, `AddIdeaModal.tsx`)
- Utilities/Helpers: camelCase + `.ts` (e.g., `logger.ts`, `validators.ts`)
- Repositories: camelCase + `.ts` (e.g., `projectRepository.ts`, `ideaRepository.ts`)
- Types: either filename or interface name (e.g., `types/index.ts` exports IdeaCard, Project)
- Tests: same name as file + `.test.ts` or `.spec.ts` (e.g., `DesignMatrix.test.tsx`)
- API routes: lowercase + `.ts` (e.g., `api/auth.ts`, `api/ideas.ts`)

**Directories:**
- Feature domains: lowercase (e.g., `components/matrix/`, `components/brainstorm/`)
- Utility organization: service/type pattern (e.g., `lib/repositories/`, `lib/database/`)
- Nested features: nested directories match hierarchy (e.g., `hooks/featureModal/`, `components/featureModal/`)

**Code Identifiers:**
- Functions: camelCase (e.g., `createProject()`, `fetchIdeas()`)
- Constants: UPPER_SNAKE_CASE for config (e.g., `MAX_IDEA_LENGTH`, `API_TIMEOUT_MS`)
- React Hooks: usePrefix (e.g., `useAuth`, `useBrainstormRealtime`)
- Context Hooks: usePrefix matching provider (e.g., `useProject`, `useModal`, `useAdmin`)
- Types/Interfaces: PascalCase (e.g., `IdeaCard`, `ProjectCollaborator`, `BrainstormSession`)

## Where to Add New Code

**New Feature (e.g., "Reports"):**
- Primary code: `src/components/pages/ReportsPage.tsx` or `src/components/reports/`
- State management: Add to relevant context or create `ReportsProvider.tsx` in `src/contexts/`
- Data access: Add `reportsRepository.ts` in `src/lib/repositories/`
- API endpoint: Add `api/reports.ts` for server-side logic
- Tests: `tests/e2e/reports.spec.ts` for E2E, component tests alongside code
- Types: Add interfaces to `src/types/index.ts`

**New Modal/Form:**
- Implementation: `src/components/{FeatureName}{Modal,Form}.tsx`
- Logic hooks: `src/hooks/{featureName}/use{Feature}{Logic}.ts`
- Styling: Tailwind classes in component or `src/styles/{featureName}.css`
- Tests: `src/components/__tests__/{FeatureName}.test.tsx`

**New Hook (Shared Logic):**
- Implementation: `src/hooks/use{HookName}.ts`
- Tests: `src/hooks/__tests__/use{HookName}.test.ts`
- If feature-specific: `src/hooks/{featureName}/use{HookName}.ts`

**New Utility Function:**
- Shared helpers: `src/utils/{category}.ts`
- Tests: `src/utils/__tests__/{category}.test.ts`
- If domain-specific: `src/lib/{domain}/{utility}.ts`

**New Repository (Data Access):**
- Implementation: `src/lib/repositories/{domainName}Repository.ts`
- Tests: `src/lib/repositories/__tests__/{domainName}Repository.test.ts`
- Follows pattern: Export named functions that accept Supabase client

**New API Route:**
- Implementation: `api/{routeName}.ts`
- Pattern: Export default async function(req: VercelRequest, res: VercelResponse)
- Validation: Use Zod schemas or inline validation
- Response: Always return JSON, set status codes (200, 400, 401, 403, 500)

**New Page/Route:**
- Component: `src/components/pages/{PageName}.tsx`
- If major section: Create subdirectory `src/components/{feature}/` with multiple files
- Navigation: Update routing in `PageRouter.tsx` or `App.tsx` if hash route

**Styling:**
- Use Tailwind utility classes in JSX (preferred)
- Global styles: `src/index.css` or `src/styles/{feature}.css`
- Tailwind config: Extend in `tailwind.config.js` for custom utilities

## Special Directories

**src/test/**
- Purpose: Testing infrastructure shared across all tests
- Generated: No
- Committed: Yes
- Contains: Mock clients, test utilities, setup files
- Not imported by production code

**src/claudedocs/**
- Purpose: Claude AI documentation for code navigation
- Generated: Yes (by Claude)
- Committed: Yes
- Contains: Architecture summaries, file index
- Not included in production builds (tree-shaked)

**public/**
- Purpose: Static assets served as-is
- Generated: No
- Committed: Yes
- Contains: Favicon, fonts, images
- Deployed to: Vercel public CDN

**.vercel/**
- Purpose: Vercel deployment configuration
- Generated: Yes (by `vercel link`)
- Committed: Yes
- Contains: `project.json` linking repo to Vercel project
- Do not modify manually

**dist/**
- Purpose: Production build output
- Generated: Yes (by `npm run build`)
- Committed: No
- Contains: Minified JS, CSS, bundled assets
- Deployed to: Vercel edge network

**node_modules/**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No
- Contains: All transitive dependencies
- Size: ~1GB (Git excluded)

**test-results/**
- Purpose: E2E test reports
- Generated: Yes (by Playwright)
- Committed: No
- Contains: HTML reports, screenshots, videos
- Accessed via: `npm run e2e:report`

---

*Structure analysis: 2025-04-06*
