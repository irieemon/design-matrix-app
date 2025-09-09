/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase keys are client-side safe (protected by RLS policies)
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  
  // AI API keys are now SERVER-SIDE ONLY for security
  // They are accessed via /api/ai/* endpoints, not directly from client
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}