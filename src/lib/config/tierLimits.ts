/**
 * Subscription Tier Limits Configuration
 *
 * Defines usage limits for each subscription tier:
 * - FREE: 1 project, 5 AI ideas/month, 3 users
 * - TEAM: 10 projects, unlimited AI, 15 users
 * - ENTERPRISE: Unlimited everything
 */

export type SubscriptionTier = 'free' | 'team' | 'enterprise';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete';

export interface TierLimits {
  projects: number; // -1 = unlimited
  ai_ideas_per_month: number; // -1 = unlimited
  users: number; // -1 = unlimited
  exports: readonly string[]; // Allowed export formats
  features: {
    roadmap: boolean;
    insights: boolean;
    files: boolean;
    api_access: boolean;
    sso: boolean;
    white_label: boolean;
    priority_support: boolean;
  };
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    projects: 1,
    ai_ideas_per_month: 5,
    users: 3,
    exports: ['png', 'csv'] as const,
    features: {
      roadmap: true,
      insights: true,
      files: true,
      api_access: false,
      sso: false,
      white_label: false,
      priority_support: false
    }
  },
  team: {
    projects: 10,
    ai_ideas_per_month: -1, // unlimited
    users: 15,
    exports: ['png', 'csv', 'pdf', 'ppt'] as const,
    features: {
      roadmap: true,
      insights: true,
      files: true,
      api_access: false,
      sso: false,
      white_label: false,
      priority_support: true
    }
  },
  enterprise: {
    projects: -1, // unlimited
    ai_ideas_per_month: -1, // unlimited
    users: -1, // unlimited
    exports: ['png', 'csv', 'pdf', 'ppt', 'json', 'xlsx'] as const,
    features: {
      roadmap: true,
      insights: true,
      files: true,
      api_access: true,
      sso: true,
      white_label: true,
      priority_support: true
    }
  }
} as const;

/**
 * Check if a resource is unlimited for a given tier
 */
export function isUnlimited(tier: SubscriptionTier, resource: keyof Pick<TierLimits, 'projects' | 'ai_ideas_per_month' | 'users'>): boolean {
  return TIER_LIMITS[tier][resource] === -1;
}

/**
 * Get the limit for a specific resource and tier
 */
export function getLimit(tier: SubscriptionTier, resource: keyof Pick<TierLimits, 'projects' | 'ai_ideas_per_month' | 'users'>): number {
  const limit = TIER_LIMITS[tier][resource];
  return limit === -1 ? Infinity : limit;
}

/**
 * Check if a tier has access to a specific feature
 */
export function hasFeature(tier: SubscriptionTier, feature: keyof TierLimits['features']): boolean {
  return TIER_LIMITS[tier].features[feature];
}

/**
 * Check if export format is allowed for tier
 */
export function canExport(tier: SubscriptionTier, format: string): boolean {
  return TIER_LIMITS[tier].exports.includes(format);
}

/**
 * Tier display names for UI
 */
export const TIER_NAMES: Record<SubscriptionTier, string> = {
  free: 'Free',
  team: 'Team',
  enterprise: 'Enterprise'
};

/**
 * Tier pricing (monthly)
 */
export const TIER_PRICING: Record<SubscriptionTier, number> = {
  free: 0,
  team: 29,
  enterprise: 0 // Custom pricing
};

/**
 * Tier pricing (yearly) with 17% discount
 */
export const TIER_PRICING_YEARLY: Record<SubscriptionTier, number> = {
  free: 0,
  team: 290, // $29 * 12 * 0.83 ≈ $290
  enterprise: 0 // Custom pricing
};
