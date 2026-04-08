/**
 * PaymentFailedBanner — sticky header banner that surfaces unread
 * payment_failed notifications from user_notifications (BILL-02).
 *
 * CRITICAL: Uses createAuthenticatedClientFromLocalStorage, NOT the default
 * supabase singleton. The singleton's getSession() flow can deadlock on
 * page refresh after storage operations (see project MEMORY.md). The
 * localStorage-derived client reads the token synchronously and avoids
 * that hang entirely.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { createAuthenticatedClientFromLocalStorage } from '../../lib/supabase'
import { useCurrentUser } from '../../contexts/UserContext'
import { logger } from '../../utils/logger'

interface PaymentFailedNotification {
  id: string
  user_id: string
  type: string
  message: string | null
  created_at: string
  read_at: string | null
}

const POLL_INTERVAL_MS = 60_000

export const PaymentFailedBanner: React.FC = () => {
  const currentUser = useCurrentUser()
  const [notification, setNotification] = useState<PaymentFailedNotification | null>(null)
  const [dismissing, setDismissing] = useState(false)

  const fetchNotification = useCallback(async () => {
    if (!currentUser?.id) return
    const client = createAuthenticatedClientFromLocalStorage()
    if (!client) return

    try {
      const { data, error } = await client
        .from('user_notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('type', 'payment_failed')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        logger.warn('PaymentFailedBanner: query failed', error)
        return
      }
      setNotification((data as PaymentFailedNotification | null) ?? null)
    } catch (err) {
      logger.warn('PaymentFailedBanner: exception', err)
    }
  }, [currentUser?.id])

  useEffect(() => {
    void fetchNotification()
    const id = window.setInterval(fetchNotification, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [fetchNotification])

  const handleDismiss = useCallback(async () => {
    if (!notification || dismissing) return
    setDismissing(true)
    const client = createAuthenticatedClientFromLocalStorage()
    if (!client) {
      setDismissing(false)
      return
    }
    try {
      const { error } = await client
        .from('user_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notification.id)
      if (error) {
        logger.warn('PaymentFailedBanner: dismiss failed', error)
        setDismissing(false)
        return
      }
      setNotification(null)
    } catch (err) {
      logger.warn('PaymentFailedBanner: dismiss exception', err)
    } finally {
      setDismissing(false)
    }
  }, [notification, dismissing])

  if (!notification) return null

  return (
    <div
      role="alert"
      data-testid="payment-failed-banner"
      className="sticky top-0 z-50 flex items-center gap-3 border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" aria-hidden="true" />
      <div className="flex-1">
        <strong className="font-semibold">Payment failed.</strong>{' '}
        <span>
          {notification.message ||
            "We couldn't charge your card. Please update your payment method to keep your subscription active."}
        </span>{' '}
        <a href="/settings" className="underline hover:no-underline">
          Manage billing
        </a>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={dismissing}
        aria-label="Dismiss payment failed notification"
        className="rounded-md p-1 text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default PaymentFailedBanner
