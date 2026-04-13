/**
 * AIQuotaBadge -- ADR-0015 Step 5
 *
 * Persistent navigation badge showing AI quota status for free-tier users.
 * Consumes useAIQuota hook for quota data. Hidden for paid tiers.
 *
 * States: loading (skeleton), neutral (0-79%), warning (80-99%),
 * exhausted (100%), error (fetch failed), hidden (paid tier).
 */

import { useState } from 'react';
import { useAIQuota } from '../../hooks/useAIQuota';

type BadgeState = 'neutral' | 'warning' | 'exhausted';

function getBadgeState(percentageUsed: number): BadgeState {
  if (percentageUsed >= 100) return 'exhausted';
  if (percentageUsed >= 80) return 'warning';
  return 'neutral';
}

const BADGE_STYLES: Record<BadgeState, string> = {
  neutral: 'text-graphite-600 bg-graphite-100 border border-hairline-default',
  warning: 'text-amber-700 bg-amber-50 border border-amber-200',
  exhausted: 'text-garnet-700 bg-garnet-50 border border-garnet-200',
};

const ARIA_LABELS: Record<BadgeState, (current: number, limit: number) => string> = {
  neutral: (current, limit) => `AI usage: ${current} of ${limit} generations used this month`,
  warning: (current, limit) => `AI usage warning: ${current} of ${limit} generations used this month`,
  exhausted: (current, limit) => `AI usage limit reached: ${current} of ${limit} generations used this month`,
};

function AIQuotaBadge() {
  const { quota, isLoading, error } = useAIQuota();
  const [isHovered, setIsHovered] = useState(false);

  if (isLoading) {
    return (
      <span
        role="status"
        aria-label="Loading AI usage"
        className="inline-block w-14 h-5 rounded-full bg-graphite-200 animate-shimmer"
      />
    );
  }

  if (error) {
    return (
      <span
        role="status"
        aria-label="AI usage unavailable"
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-graphite-400 bg-graphite-50"
      >
        -- AI
      </span>
    );
  }

  if (quota === null) {
    return null;
  }

  const state = getBadgeState(quota.percentageUsed);
  const ariaLabel = ARIA_LABELS[state](quota.current, quota.limit);
  const isExhausted = state === 'exhausted';

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`relative inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[state]}`}
      onMouseEnter={() => isExhausted && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {quota.current}/{quota.limit} AI
      {isExhausted && isHovered && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-graphite-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap"
        >
          Upgrade for unlimited
        </span>
      )}
    </span>
  );
}

export default AIQuotaBadge;
