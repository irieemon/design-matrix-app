# External Integrations

**Analysis Date:** 2025-04-06

## APIs & External Services

**Backend AI Services:**
- OpenAI API - Idea generation, insights analysis, roadmap generation
  - SDK/Client: `openai` (Node.js SDK, used server-side)
  - Auth: `OPENAI_API_KEY` environment variable
  - Endpoints: `/api/ai?action=generate-ideas`, `/api/ai?action=generate-insights`, `/api/ai?action=generate-roadmap`
  - Implementation: `api/ai.ts`, `src/lib/ai/` services

- Anthropic Claude API - Alternative AI model support
  - SDK/Client: `@anthropic-sdk/sdk` (implied, may be used as fallback)
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Routing: `src/lib/ai/openaiModelRouter.ts` handles model selection
  - Features: Used in AI insights generation (`src/lib/ai/aiInsightsService.ts`)

**Payment Processing:**
- Stripe - Subscription and payment management
  - SDK/Client: `stripe` (Node.js SDK, server-side), `@stripe/stripe-js` (frontend)
  - Auth: 
    - `STRIPE_SECRET_KEY` (backend only, serverless functions)
    - `STRIPE_WEBHOOK_SECRET` (webhook signature verification)
    - `VITE_STRIPE_PRICE_ID_TEAM` (frontend checkout)
    - `VITE_STRIPE_PRICE_ID_ENTERPRISE` (frontend checkout)
  - Endpoints: 
    - `POST /api/stripe?action=checkout` - Create checkout session
    - `POST /api/stripe?action=portal` - Customer billing portal
    - `POST /api/stripe/webhooks` - Webhook event handling (subscription updates)
  - Implementation: `api/stripe.ts`, `src/lib/services/stripeService.ts`, `src/lib/services/subscriptionService.ts`

**Email Service:**
- EmailJS - Transactional email for collaboration invitations
  - SDK/Client: `@emailjs/browser` (frontend-only service)
  - Auth:
    - `VITE_EMAILJS_SERVICE_ID` (frontend)
    - `VITE_EMAILJS_TEMPLATE_ID` (frontend)
    - `VITE_EMAILJS_PUBLIC_KEY` (frontend)
  - Template Variables: `inviter_name`, `inviter_email`, `invitee_email`, `project_name`, `role`, `invitation_url`
  - Fallback: Uses mailto: links if EmailJS credentials unavailable
  - Implementation: `src/lib/emailService.ts`

**Analytics:**
- Vercel Web Vitals - Performance monitoring
  - SDK/Client: `@vercel/analytics`
  - Implementation: Integrated via `@vercel/analytics` package in Vercel deployment
  - Metrics: Core Web Vitals (LCP, FID, CLS), custom events

## Data Storage

**Primary Database:**
- Supabase PostgreSQL
  - Connection: `VITE_SUPABASE_URL` (frontend), `SUPABASE_URL` (backend)
  - Client: `@supabase/supabase-js` (frontend), `createClient()` from SDK (backend)
  - Auth: 
    - Frontend: `VITE_SUPABASE_ANON_KEY` (public, RLS enforced)
    - Backend: `SUPABASE_SERVICE_ROLE_KEY` (admin-only, for serverless functions)
  - Tables:
    - `users` - User profiles and metadata
    - `projects` - Project definitions and ownership
    - `ideas` - Idea cards with matrix coordinates
    - `brainstorm_sessions` - Real-time brainstorming sessions
    - `collaborations` - Project collaborator relationships
    - `subscriptions` - User subscription information
    - `admin_settings` - Global admin configuration
  - Features:
    - Row-Level Security (RLS) for multi-tenant isolation
    - Real-time subscriptions for collaborative features
    - Functions/RPC for server-side logic
  - Implementation: `src/lib/supabase.ts`, `src/lib/repositories/`, `api/_lib/utils/supabaseAdmin.ts`

**Session Storage:**
- Browser localStorage - Supabase auth session persistence
  - Key: `sb-{project-id}-auth-token` (dynamic, based on Supabase project)
  - Purpose: Auth session hydration across page reloads
  - Cleanup: Automatic removal of legacy auth keys during migration
  - Security: Session tokens only, PII never stored

**File Storage:**
- Supabase Storage (S3-compatible)
  - Buckets: User-uploaded files (documents, images for brainstorm sessions)
  - Implementation: `src/lib/fileService.ts`

**Caching:**
- In-Memory Cache (browser)
  - Services: `CacheManager.ts` for user profiles, project existence checks
  - Duration: 2-10 minutes depending on data type
  - Backend: No persistent cache layer (stateless serverless functions)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (Postgres + Auth0-compatible)
  - Implementation: Custom auth flow in `src/components/auth/AuthScreen.tsx`
  - Method: Email/password with session persistence
  - Features:
    - Session restoration on page reload (`useAuth` hook)
    - Token refresh from secure storage
    - Logout with session cleanup
  - Client: `src/lib/authClient.ts` (factory for creating authenticated clients)
  - Security:
    - No service role key exposed to frontend
    - RLS enforcement on all queries
    - Session tokens stored securely in localStorage

## Monitoring & Observability

**Error Tracking:**
- Vercel Analytics - Automatically captures Web Vitals
- Console logging: Debug and error logs throughout codebase
- No dedicated error tracking service (Sentry, etc.) detected

**Logs:**
- Browser console: `src/utils/logger.ts` provides structured logging
- Server-side: `api/_lib/utils/logger.ts` for serverless functions
- Vercel deployment logs: Automatic capture of function execution

**Debugging:**
- Vite development server with source maps
- Playwright E2E tests with failure screenshots
- Visual regression testing for UI consistency

## CI/CD & Deployment

**Hosting:**
- Vercel - Serverless deployment platform
  - Configuration: `vercel.json`
  - Build command: `npm run build`
  - Output directory: `dist/`
  - Framework detection: Vite
  - Functions: API routes in `api/**/*.ts` deployed as serverless functions
  - Preview deployments: Automatic on PR
  - Production: Main branch deploys

**CI Pipeline:**
- GitHub Actions (implied by git workflow)
- Pre-commit hooks via ESLint
- Type checking: `npm run type-check` (tsc --noEmit)
- Linting: `npm run lint` (max-warnings 0 enforced)

**Environment Configuration:**
- Vercel Environment Variables (secret management)
- `.env.local` for development (ignored in git)
- Feature flags via `VITE_*` environment variables
- Separate backend-only and frontend-public secrets

## Webhooks & Callbacks

**Incoming:**
- Stripe webhook endpoint: `POST /api/stripe/webhooks`
  - Events: `customer.subscription.updated`, `customer.subscription.deleted`, `charge.succeeded`
  - Signature verification: `STRIPE_WEBHOOK_SECRET`
  - Processing: Subscription status updates in Supabase

**Outgoing:**
- Stripe hosted checkout sessions
  - Success redirect: `/subscription/success?session_id={CHECKOUT_SESSION_ID}`
  - Cancel redirect: `/pricing?canceled=true`
- Collaboration invitations:
  - Email sent via EmailJS
  - Invitation URL points back to app with project join token

## Security Headers

**Content Security Policy (CSP):**
- Enforced in `vite.config.ts` dev middleware
- Allows:
  - Scripts: `self`, `unsafe-inline`, `unsafe-eval`, Vercel analytics, Cloudflare CDN
  - Styles: `self`, `unsafe-inline`, Google Fonts
  - Images: `self`, data URIs, blobs, Supabase storage
  - Fonts: `self`, data URIs, Google Fonts
  - Connections: All Supabase endpoints, Vercel Analytics, WebSocket connections

**Additional Headers (Vercel):**
- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-XSS-Protection: 1; mode=block` - Legacy XSS protection

## Rate Limiting & Security

**Frontend:**
- Input validation: `api/_lib/utils/validation.ts`
- Sanitization: DOMPurify for user-generated content
- CSRF protection: Middleware in `api/_lib/middleware/withCSRF.ts`

**Backend (API):**
- Rate limiting: `express-rate-limit` configured per endpoint
- Subscription limit enforcement: AI generation quota enforcement via `subscriptionService`
- Auth verification: `withAuth` middleware on protected endpoints
- Input validation: Strict schema validation before processing
- Helmet security headers

---

*Integration audit: 2025-04-06*
