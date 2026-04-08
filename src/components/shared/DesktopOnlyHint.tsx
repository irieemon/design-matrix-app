/**
 * DesktopOnlyHint — non-blocking "Best on desktop" banner.
 *
 * Rendered above page content when the user is on a mobile viewport and the
 * current route is classified as desktop-only (see 07-MOBILE-AUDIT.md).
 * Per D-08, this never blocks rendering of the underlying page.
 */
import React from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'

interface DesktopOnlyHintProps {
  pageName: string
  emailLinkCta?: boolean
}

export const DesktopOnlyHint: React.FC<DesktopOnlyHintProps> = ({
  pageName,
  emailLinkCta = true,
}) => {
  const { isMobile } = useBreakpoint()

  if (!isMobile) return null

  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const mailto = `mailto:?subject=${encodeURIComponent(
    'Prioritas link'
  )}&body=${encodeURIComponent(currentUrl)}`

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm text-amber-900"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base">
          <strong>Best on desktop</strong> — {pageName} works better on a larger screen.
        </p>
        {emailLinkCta && (
          <a
            href={mailto}
            className="inline-flex items-center justify-center min-h-11 min-w-11 px-3 rounded-md bg-amber-100 hover:bg-amber-200 text-base font-medium"
          >
            Email me this link
          </a>
        )}
      </div>
    </div>
  )
}

export default DesktopOnlyHint
