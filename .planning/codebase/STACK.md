# Technology Stack

**Analysis Date:** 2025-04-06

## Languages

**Primary:**
- TypeScript 5.2.2 - All source code, strict mode enabled
- JSX/TSX - React component definitions
- JavaScript - Configuration files and utilities

**Secondary:**
- CSS/Tailwind - Styling via `tailwind.config.js`

## Runtime

**Environment:**
- Node.js 22.19.0 (specified in `.nvmrc`)
- Browser: ES2020 target (modern browsers only)

**Package Manager:**
- npm (npm 10.x implied by Node 22)
- Lockfile: `package-lock.json` present (v3, npm 9+)

## Frameworks

**Core:**
- React 18.2.0 - UI framework
- Vite 5.0.8 - Build tool and dev server (ESM-first, fast rebuilds)
- TypeScript 5.2.2 - Type system for entire codebase

**Frontend Routing:**
- React Router 7.9.1 - Client-side routing

**Styling:**
- Tailwind CSS 3.3.6 - Utility-first CSS framework
- PostCSS 8.4.32 - CSS processing pipeline

**UI Components & Animation:**
- Lucide React 0.294.0 - Icon library
- @dnd-kit/core 6.1.0 - Drag-and-drop primitives
- @dnd-kit/sortable 8.0.0 - Sortable list plugin
- @dnd-kit/utilities 3.2.2 - Utility functions for dnd-kit

**PDF & Document Export:**
- jsPDF 3.0.2 - PDF generation library
- pdfmake 0.2.20 - PDF document building
- html2canvas 1.4.1 - HTML-to-canvas screenshot capture
- pdfjs-dist 5.4.394 - PDF rendering engine

**Charts & Visualization:**
- Recharts 3.4.1 - React charting library (used in analytics/reports)

**Testing:**
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

**Development Tools:**
- @vitejs/plugin-react 4.2.1 - React Fast Refresh
- TypeScript ESLint 8.47.0 - TypeScript linting
- ESLint 9.39.1 - Code style enforcement
- eslint-plugin-react 7.37.5 - React-specific rules
- eslint-plugin-react-hooks 7.0.1 - React hooks linting
- Globals 16.5.0 - Global scope definitions
- tsx 4.20.5 - TypeScript executor for Node

**Security & Validation:**
- Helmet 8.1.0 - HTTP header security middleware
- Express Rate Limit 8.1.0 - Rate limiting for APIs
- DOMPurify 3.2.7 - HTML sanitization
- Validator 13.15.23 - String validation library

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.57.2 - Supabase client SDK (database, auth, realtime)
- stripe 17.5.0 - Stripe Node.js SDK (server-side payment processing)
- @stripe/stripe-js 5.3.0 - Stripe JavaScript client (checkout)
- @emailjs/browser 4.4.1 - Client-side email API (collaboration invitations)
- uuid 9.0.1 - UUID generation for IDs

**Infrastructure:**
- @vercel/analytics 1.5.0 - Vercel Web Vitals analytics
- @vercel/node 5.3.21 - Vercel Node.js runtime types (dev only)

**Mock Service Worker:**
- msw 2.11.2 - API mocking for tests

**Browser Compatibility:**
- Puppeteer 24.22.1 - Headless browser automation (for visual tests)

## Configuration

**Environment:**
- Frontend: Uses `import.meta.env.VITE_*` for static Vite replacement at build time
- Backend API: Uses `process.env` directly (Node.js environment variables)
- `.env` files: Listed in `.gitignore` (never committed)

**Critical Environment Variables:**
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

**Build:**
- `vite.config.ts` - Vite configuration with React plugin, API middleware for development
- `tsconfig.json` - TypeScript compiler options (ES2020 target, strict mode, JSX support)
- `eslint.config.js` - ESLint flat config (v9 format)
- `vitest.config.ts` - Vitest configuration with JSDOM environment
- `tailwind.config.js` - Tailwind CSS theme and component configuration
- `vercel.json` - Vercel deployment configuration (build command, functions, rewrites)

## Platform Requirements

**Development:**
- Node.js 22.19.0 or compatible
- npm 10.x
- Modern browser with ES2020 support
- macOS/Linux/Windows (npm scripts test with bash)

**Production:**
- Vercel deployment platform (uses `vercel.json` for configuration)
- Serverless functions for `/api` routes
- Static asset hosting for SPA
- Node.js runtime for API functions

**Browsers Supported:**
- Chrome/Chromium (latest)
- Firefox (latest)
- Safari/WebKit (latest)
- Mobile Chrome/Safari (modern versions)

## Build & Deployment

**Build Process:**
```bash
npm run build:check        # Type check + Vite build
vite build                 # Production bundle to dist/
```

**Output:**
- SPA served from `dist/index.html`
- Static assets in `dist/assets/`
- Lazy-loaded chunks via code splitting
- API routes as serverless functions

**Development Server:**
- `npm run dev` - Vite dev server on port 3003
- Live reload with Fast Refresh
- API middleware for local `/api` route testing
- Content Security Policy headers for development

---

*Stack analysis: 2025-04-06*
