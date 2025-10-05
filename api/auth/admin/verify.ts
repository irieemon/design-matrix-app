/**
 * Admin Verification API
 *
 * POST /api/auth/admin/verify - Verify admin role and return capabilities
 *
 * Server-side admin verification prevents client-side privilege escalation
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelResponse } from '@vercel/node'
import {
  withAuth,
  withCSRF,
  withRateLimit,
  compose,
  type AuthenticatedRequest,
} from '../../middleware'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!

/**
 * Admin capabilities by role
 */
const ADMIN_CAPABILITIES = {
  admin: [
    'view_all_users',
    'view_all_projects',
    'update_user_status',
    'view_platform_stats',
  ],
  super_admin: [
    'view_all_users',
    'view_all_projects',
    'update_user_status',
    'view_platform_stats',
    'update_user_roles',
    'delete_any_project',
    'system_administration',
  ],
} as const

/**
 * Admin verification handler
 */
async function adminVerifyHandler(req: AuthenticatedRequest, res: VercelResponse) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')

  if (req.method !== 'POST') {
    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }

    return res.status(405).json({
      error: {
        message: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
        allowed: ['POST'],
      },
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // User is guaranteed to exist from withAuth middleware
    const userId = req.user!.id

    // Create Supabase admin client (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Verify role from database (single source of truth)
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, email, role, full_name')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      console.error('Admin verification error:', error)
      return res.status(403).json({
        error: {
          message: 'Unable to verify admin status',
          code: 'VERIFICATION_FAILED',
        },
        timestamp: new Date().toISOString(),
      })
    }

    // Check if user has admin role
    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
    const isSuperAdmin = profile.role === 'super_admin'

    if (!isAdmin) {
      // Log unauthorized admin access attempt
      await supabase.from('admin_audit_log').insert({
        user_id: userId,
        action: 'ADMIN_ACCESS_DENIED',
        resource: '/api/auth/admin/verify',
        is_admin: false,
        timestamp: new Date().toISOString(),
        ip_address: req.headers['x-forwarded-for'] as string || null,
        user_agent: req.headers['user-agent'] || null,
        metadata: {
          reason: 'Non-admin user attempted admin verification',
        },
      })

      return res.status(403).json({
        error: {
          message: 'Admin access required',
          code: 'NOT_ADMIN',
        },
        timestamp: new Date().toISOString(),
      })
    }

    // Get capabilities based on role
    const capabilities = isSuperAdmin
      ? ADMIN_CAPABILITIES.super_admin
      : ADMIN_CAPABILITIES.admin

    // Log successful admin verification
    await supabase.from('admin_audit_log').insert({
      user_id: userId,
      action: 'ADMIN_VERIFIED',
      resource: '/api/auth/admin/verify',
      is_admin: true,
      timestamp: new Date().toISOString(),
      ip_address: req.headers['x-forwarded-for'] as string || null,
      user_agent: req.headers['user-agent'] || null,
      metadata: {
        role: profile.role,
        capabilities: capabilities.length,
      },
    })

    // Return admin verification
    return res.status(200).json({
      success: true,
      isAdmin: true,
      isSuperAdmin,
      capabilities: Array.from(capabilities),
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.full_name,
      },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Admin verify handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error during admin verification',
        code: 'VERIFICATION_ERROR',
      },
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Export handler with security middleware
 */
export default compose(
  withRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,  // Moderate rate limit for admin checks
  }),
  withCSRF(),  // CSRF protection
  withAuth     // Authentication required
)(adminVerifyHandler)
