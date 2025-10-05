import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  return {
  plugins: [
    react(),
    {
      name: 'development-csp',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://vfovtgtjailvrphsgafv.supabase.co; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://vfovtgtjailvrphsgafv.supabase.co https://vitals.vercel-analytics.com ws: wss:; worker-src 'self' blob: https://cdnjs.cloudflare.com;"
          )
          next()
        })
      }
    },
    {
      name: 'api-development',
      configureServer(server) {
        server.middlewares.use('/api', async (req, res, next) => {
          try {
            // Extract the API route from the URL
            const apiPath = req.url?.replace(/^\/api/, '') || ''
            const apiFile = `/api${apiPath}.ts`

            console.log(`[API] Request: ${req.method} ${req.url}`)
            console.log(`[API] Loading module: ${apiFile}`)

            // Parse request body for POST/PUT requests
            let body = undefined
            if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
              const chunks = []
              req.on('data', (chunk) => chunks.push(chunk))
              await new Promise((resolve) => req.on('end', resolve))
              const rawBody = Buffer.concat(chunks).toString()
              try {
                body = rawBody ? JSON.parse(rawBody) : undefined
              } catch (e) {
                body = rawBody
              }
            }

            // Use Vite's SSR loader to properly handle TypeScript with all its dependencies
            let module
            let handler

            try {
              // Resolve the absolute path
              const { fileURLToPath } = await import('url')
              const { resolve } = await import('path')
              const __dirname = fileURLToPath(new URL('.', import.meta.url))
              const absolutePath = resolve(__dirname, `.${apiFile}`)

              console.log(`[API] Resolved path: ${absolutePath}`)

              // Use Vite's SSR module loader which handles TypeScript and imports correctly
              // We need to fix the SSR environment to include process.env
              const originalEnv = globalThis.process?.env
              if (!globalThis.process) {
                globalThis.process = { env: {} } as any
              }

              // Ensure environment variables are available in SSR context
              const envVars = {
                SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
                VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
                SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
                VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
                SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
                VITE_SUPABASE_SERVICE_ROLE_KEY: env.VITE_SUPABASE_SERVICE_ROLE_KEY,
                OPENAI_API_KEY: env.OPENAI_API_KEY,
                ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
                NODE_ENV: env.NODE_ENV || 'development'
              }

              console.log(`[API] Setting env vars:`, {
                SUPABASE_URL: envVars.SUPABASE_URL?.substring(0, 30),
                SUPABASE_ANON_KEY: envVars.SUPABASE_ANON_KEY?.substring(0, 20) + '...',
                OPENAI_API_KEY: envVars.OPENAI_API_KEY?.substring(0, 15) + '...'
              })

              Object.assign(globalThis.process.env, envVars)

              module = await server.ssrLoadModule(absolutePath)
              handler = module.default

              // Restore original env if needed
              if (originalEnv && globalThis.process) {
                globalThis.process.env = originalEnv
              }

              console.log(`[API] Module loaded successfully, handler type: ${typeof handler}`)
            } catch (loadError) {
              console.error(`[API] SSR Load Error:`, loadError)
              console.error(`[API] Stack:`, loadError.stack)
              throw loadError
            }

            if (typeof handler === 'function') {
              // Set CORS headers for all API requests
              const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost:3003'
              res.setHeader('Access-Control-Allow-Origin', origin)
              res.setHeader('Access-Control-Allow-Credentials', 'true')
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
              res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization, Accept, Origin')

              // Handle preflight OPTIONS request
              if (req.method === 'OPTIONS') {
                res.statusCode = 200
                res.end()
                return
              }

              // Create Vercel-like request/response objects
              const vercelReq = {
                ...req,
                method: req.method,
                headers: req.headers,
                url: req.url,
                query: Object.fromEntries(new URLSearchParams(req.url?.split('?')[1] || '')),
                body: body,
                socket: req.socket
              }

              const vercelRes = {
                statusCode: 200,
                status: (code) => {
                  vercelRes.statusCode = code
                  res.statusCode = code
                  return vercelRes
                },
                json: (data) => {
                  res.setHeader('Content-Type', 'application/json')
                  res.statusCode = vercelRes.statusCode
                  res.end(JSON.stringify(data))
                },
                setHeader: (name, value) => {
                  res.setHeader(name, value)
                },
                getHeader: (name) => {
                  return res.getHeader(name)
                },
                end: (data) => {
                  res.statusCode = vercelRes.statusCode
                  res.end(data)
                }
              }

              console.log(`[API] Executing handler for ${req.method} ${req.url}`)
              await handler(vercelReq, vercelRes)
              console.log(`[API] Handler completed with status ${vercelRes.statusCode}`)
            } else {
              console.error(`[API] Handler is not a function: ${typeof handler}`)
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'API handler not found' }))
            }
          } catch (error) {
            console.error('API Development Server Error:', error)
            console.error('Error stack:', error.stack)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: 'Internal server error',
              message: error.message,
              details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }))
          }
        })
      }
    }
  ],
  server: {
    port: 3003,
    open: false,
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/coverage/**',
        '**/__tests__/**',
        '**/test/**',
        '**/tests/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.md',
        '**/claudedocs/**',
        '**/*-screenshots/**',
        '**/*-results/**',
        '**/*-report*/**',
        '**/*.mjs',
      ]
    }
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', 'lucide-react'],
          pdf: ['jspdf', 'pdfmake', 'html2canvas']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js', 'pdfjs-dist']
  }
}})