/**
 * QuotaExhaustedModal -- ADR-0015 Step 5
 *
 * Modal shown when a free-tier user exhausts their monthly AI quota.
 * Presents usage count, reset date, and an upgrade CTA.
 *
 * Focus management: Close button receives focus on mount to prevent
 * accidental purchase via the upgrade button.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { QuotaData } from '../../hooks/useAIQuota';

interface QuotaExhaustedModalProps {
  isOpen: boolean;
  onClose: () => void;
  quota: QuotaData;
  onUpgrade?: () => void;
}

const HEADING_ID = 'quota-exhausted-heading';

function formatResetDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoDate));
}

function QuotaExhaustedModal({ isOpen, onClose, quota, onUpgrade }: QuotaExhaustedModalProps) {
  const navigate = useNavigate();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const resetDate = formatResetDate(quota.resetsAt);

  function handleUpgrade() {
    onUpgrade?.();
    navigate('/pricing');
  }

  return (
    <div
      role="dialog"
      aria-labelledby={HEADING_ID}
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/40"
    >
      <div className="relative w-full max-w-md rounded-xl bg-surface-primary p-modal-padding shadow-modal-lux text-center">
        <h2
          id={HEADING_ID}
          className="text-xl font-bold text-graphite-900"
        >
          Monthly AI Limit Reached
        </h2>

        <p className="mt-3 text-sm text-graphite-600">
          You've used all {quota.limit} AI generations this month.
          Your limit resets on {resetDate}.
        </p>

        <button
          type="button"
          onClick={handleUpgrade}
          className="mt-6 w-full min-h-[44px] rounded-lg bg-sapphire-600 text-white font-medium hover:bg-sapphire-700 active:bg-sapphire-800 active:scale-[0.98] transition-colors shadow-button-lux-hover focus:outline-none focus:ring-4 focus:ring-sapphire-500/10"
        >
          Upgrade to Team
        </button>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg py-2 text-sm text-graphite-500 hover:bg-graphite-100 focus:outline-none focus:ring-4 focus:ring-sapphire-500/10 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default QuotaExhaustedModal;
