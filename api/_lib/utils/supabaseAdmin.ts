/**
 * Supabase Admin Client (Service Role)
 *
 * SECURITY WARNING: This client bypasses Row Level Security (RLS)
 * USE ONLY in backend API routes, NEVER in frontend code
 *
 * Purpose: Admin operations like token tracking, cross-user queries
 */

import { createClient } from '@supabase/supabase-js'

// Server-side: Use non-VITE_ prefixed variables (runtime variables)
// VITE_ variables are only available at build time, not at runtime in serverless functions
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Log configuration status (don't throw to allow module to load)
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase configuration:', {
    hasUrl: !!supabaseUrl,
    hasServiceRoleKey: !!supabaseServiceRoleKey,
    availableEnvVars: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
  })
}

// Create admin client with service role key (bypasses RLS)
// If credentials are missing, client creation will fail gracefully at query time
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null as any  // Null client - will fail gracefully at usage time instead of module load

/**
 * Track OpenAI token usage
 * This inserts into ai_token_usage table using service role (bypassing RLS)
 */
export async function trackTokenUsage(params: {
  userId: string
  projectId: string | null
  endpoint: string
  model: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  responseTimeMs: number
  success?: boolean
  errorMessage?: string
}) {
  try {
    // CRITICAL: Check if supabaseAdmin is initialized
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not initialized - cannot track token usage')
      return // Don't throw - token tracking failures shouldn't break user flow
    }

    // Calculate costs based on model pricing
    const costs = getModelCosts(params.model)
    const inputCost = (params.usage.prompt_tokens / 1000000) * costs.input
    const outputCost = (params.usage.completion_tokens / 1000000) * costs.output
    const totalCost = inputCost + outputCost

    // Insert token usage record
    const { error } = await supabaseAdmin
      .from('ai_token_usage')
      .insert({
        user_id: params.userId,
        project_id: params.projectId,
        endpoint: params.endpoint,
        model: params.model,
        prompt_tokens: params.usage.prompt_tokens,
        completion_tokens: params.usage.completion_tokens,
        total_tokens: params.usage.total_tokens,
        input_cost: inputCost,
        output_cost: outputCost,
        total_cost: totalCost,
        response_time_ms: params.responseTimeMs,
        success: params.success ?? true,
        error_message: params.errorMessage
      })

    if (error) {
      console.error('❌ Failed to track token usage:', error)
      // Don't throw - token tracking failures shouldn't break user flow
    } else {
      console.log('✅ Token usage tracked:', {
        user: params.userId.substring(0, 8),
        endpoint: params.endpoint,
        model: params.model,
        tokens: params.usage.total_tokens,
        cost: totalCost.toFixed(4)
      })
    }
  } catch (error) {
    console.error('❌ Token tracking error:', error)
    // Don't throw - failures shouldn't break user flow
  }
}

/**
 * Get model costs per 1M tokens
 * Source: OpenAI pricing as of 2025-01
 */
function getModelCosts(model: string): { input: number; output: number } {
  const costs: Record<string, { input: number; output: number }> = {
    // GPT-5 Series (2025)
    'gpt-5': { input: 1.25, output: 10.00 },
    'gpt-5-mini': { input: 0.08, output: 0.30 },
    'gpt-5-nano': { input: 0.04, output: 0.15 },
    'gpt-5-chat-latest': { input: 1.25, output: 10.00 },

    // GPT-4 Series (legacy)
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-4': { input: 30.00, output: 60.00 },

    // O-Series Reasoning Models
    'o1-preview': { input: 15.00, output: 60.00 },
    'o1-mini': { input: 3.00, output: 12.00 },
    'o3-deep-research': { input: 20.00, output: 80.00 },
    'o4-mini-deep-research': { input: 8.00, output: 32.00 },

    // Specialized Models
    'gpt-realtime': { input: 6.00, output: 18.00 },
    'whisper-1': { input: 0.006, output: 0.006 }, // per minute, not per 1M tokens
  }

  return costs[model] || { input: 0, output: 0 }
}
