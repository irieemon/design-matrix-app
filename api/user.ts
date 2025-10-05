/**
 * Component State Storage API
 *
 * Server-side component state persistence (replaces localStorage)
 * Prevents XSS via stored state injection
 *
 * POST   /api/user/component-state - Save component state
 * GET    /api/user/component-state - Get component state(s)
 * DELETE /api/user/component-state - Delete component state
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'
import {
  withUserRateLimit,
  withCSRF,
  withAuth,
  compose,
  type AuthenticatedRequest,
} from './_lib/middleware/index'

// Create a DOMPurify instance for server-side use
const window = new JSDOM('').window as any
const purify = DOMPurify(window)

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

/**
 * Validation schema for component state
 */
const ComponentStateSchema = z.object({
  componentKey: z.string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Component key must be alphanumeric with hyphens/underscores'),
  stateData: z.record(z.unknown())
    .refine(
      data => JSON.stringify(data).length < 100000,
      'State data must be less than 100KB'
    ),
  encrypted: z.boolean().optional().default(false),
  expiresIn: z.number().min(0).max(30 * 24 * 60 * 60 * 1000).optional(), // Max 30 days in ms
})

/**
 * Sanitize component state data
 */
function sanitizeStateData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  // Convert to JSON and sanitize
  const jsonString = JSON.stringify(data)
  const sanitized = purify.sanitize(jsonString, {
    ALLOWED_TAGS: [],  // No HTML tags
    ALLOWED_ATTR: [],  // No attributes
  })

  try {
    return JSON.parse(sanitized)
  } catch {
    // If parsing fails, return empty object
    return {}
  }
}

/**
 * Save component state handler
 */
async function handleSave(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    // Validate request body
    const validation = ComponentStateSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        error: {
          message: 'Invalid component state data',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        },
        timestamp: new Date().toISOString(),
      })
    }

    const { componentKey, stateData, encrypted, expiresIn } = validation.data
    const userId = req.user!.id

    // Sanitize state data to prevent XSS
    const sanitizedData = sanitizeStateData(stateData)

    // Calculate expiration if specified
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn).toISOString()
      : null

    // Create Supabase client with user's session
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${req.session!.accessToken}`,
        },
      },
    })

    // Upsert component state
    const { data, error } = await supabase
      .from('user_component_states')
      .upsert({
        user_id: userId,
        component_key: componentKey,
        state_data: sanitizedData,
        encrypted: encrypted || false,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,component_key',
      })
      .select()
      .single()

    if (error) {
      console.error('Component state save error:', error)
      return res.status(500).json({
        error: {
          message: 'Failed to save component state',
          code: 'SAVE_FAILED',
          details: error.message,
        },
        timestamp: new Date().toISOString(),
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        id: data.id,
        componentKey: data.component_key,
        updatedAt: data.updated_at,
        expiresAt: data.expires_at,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Save handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'SAVE_ERROR',
      },
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Get component state handler
 */
async function handleGet(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const userId = req.user!.id
    const componentKey = req.query.componentKey as string | undefined

    // Create Supabase client with user's session
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${req.session!.accessToken}`,
        },
      },
    })

    // Build query
    let query = supabase
      .from('user_component_states')
      .select('*')
      .eq('user_id', userId)

    // Filter by component key if specified
    if (componentKey) {
      query = query.eq('component_key', componentKey)
    }

    // Filter out expired states
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

    const { data, error } = await query

    if (error) {
      console.error('Component state fetch error:', error)
      return res.status(500).json({
        error: {
          message: 'Failed to fetch component state',
          code: 'FETCH_FAILED',
        },
        timestamp: new Date().toISOString(),
      })
    }

    // If fetching single component, return just that
    if (componentKey && data.length === 1) {
      return res.status(200).json({
        success: true,
        data: {
          componentKey: data[0].component_key,
          stateData: data[0].state_data,
          encrypted: data[0].encrypted,
          updatedAt: data[0].updated_at,
          expiresAt: data[0].expires_at,
        },
        timestamp: new Date().toISOString(),
      })
    }

    // Return all states
    return res.status(200).json({
      success: true,
      data: data.map(state => ({
        componentKey: state.component_key,
        stateData: state.state_data,
        encrypted: state.encrypted,
        updatedAt: state.updated_at,
        expiresAt: state.expires_at,
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'FETCH_ERROR',
      },
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Delete component state handler
 */
async function handleDelete(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const userId = req.user!.id
    const componentKey = req.query.componentKey as string | undefined

    if (!componentKey) {
      return res.status(400).json({
        error: {
          message: 'componentKey query parameter is required',
          code: 'MISSING_COMPONENT_KEY',
        },
        timestamp: new Date().toISOString(),
      })
    }

    // Create Supabase client with user's session
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${req.session!.accessToken}`,
        },
      },
    })

    const { error } = await supabase
      .from('user_component_states')
      .delete()
      .eq('user_id', userId)
      .eq('component_key', componentKey)

    if (error) {
      console.error('Component state delete error:', error)
      return res.status(500).json({
        error: {
          message: 'Failed to delete component state',
          code: 'DELETE_FAILED',
        },
        timestamp: new Date().toISOString(),
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Component state deleted',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Delete handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'DELETE_ERROR',
      },
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Main handler
 */
async function componentStateHandler(req: AuthenticatedRequest, res: VercelResponse) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')

  if (req.method === 'POST') {
    return handleSave(req, res)
  }

  if (req.method === 'GET') {
    return handleGet(req, res)
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res)
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  return res.status(405).json({
    error: {
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      allowed: ['GET', 'POST', 'DELETE'],
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * Export handler with security middleware
 */
export default compose(
  withUserRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,  // 100 state operations per 15 minutes per user
  }),
  withCSRF(),
  withAuth
)(componentStateHandler)
