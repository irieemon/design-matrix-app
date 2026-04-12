/**
 * Model Profiles Service -- ADR-0013 Step 1
 *
 * Reads the active AI model profile from Supabase with a 60-second in-memory
 * cache. Falls back to FALLBACK_PROFILE (gpt-4o for everything) when the DB
 * is unreachable or no active profile exists.
 */

import { supabaseAdmin } from '../utils/supabaseAdmin.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskType =
  | 'generate-ideas'
  | 'generate-insights'
  | 'generate-roadmap'
  | 'analyze-image'
  | 'analyze-video'
  | 'analyze-file'
  | 'transcribe-summary';

export interface TaskConfig {
  gatewayModelId: string;
  fallbackModels: string[];
  temperature: number;
  maxOutputTokens: number;
}

export interface ModelProfile {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  is_active: boolean;
  task_configs: Record<TaskType, TaskConfig>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Fallback profile -- matches current gpt-4o-for-everything behavior
// ---------------------------------------------------------------------------

const FALLBACK_TASK_CONFIG: TaskConfig = {
  gatewayModelId: 'openai/gpt-4o',
  fallbackModels: [],
  temperature: 0.7,
  maxOutputTokens: 4096,
};

export const FALLBACK_PROFILE: ModelProfile = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'fallback',
  display_name: 'Fallback (hardcoded)',
  description: 'Hardcoded gpt-4o fallback used when no active profile is configured in the database',
  is_active: false,
  task_configs: {
    'generate-ideas': { ...FALLBACK_TASK_CONFIG, temperature: 0.8 },
    'generate-insights': { ...FALLBACK_TASK_CONFIG, temperature: 0.5 },
    'generate-roadmap': { ...FALLBACK_TASK_CONFIG, temperature: 0.6, maxOutputTokens: 8192 },
    'analyze-image': { ...FALLBACK_TASK_CONFIG, temperature: 0.3 },
    'analyze-video': { ...FALLBACK_TASK_CONFIG, temperature: 0.3 },
    'analyze-file': { ...FALLBACK_TASK_CONFIG, temperature: 0.3 },
    'transcribe-summary': { ...FALLBACK_TASK_CONFIG, temperature: 0.0 },
  },
  created_at: '1970-01-01T00:00:00.000Z',
  updated_at: '1970-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// In-memory cache (60-second TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;

let cachedProfile: ModelProfile | null = null;
let cacheTimestamp = 0;

/** Reset the in-memory profile cache. Exposed for test isolation only. */
export function _resetCacheForTesting(): void {
  cachedProfile = null;
  cacheTimestamp = 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the active model profile from Supabase. Results are cached for 60
 * seconds. Returns FALLBACK_PROFILE when the database is unreachable or no
 * active profile row exists.
 */
export async function getActiveProfile(): Promise<ModelProfile> {
  const now = Date.now();

  if (cachedProfile && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProfile;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('model_profiles')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return FALLBACK_PROFILE;
    }

    cachedProfile = data as ModelProfile;
    cacheTimestamp = now;
    return cachedProfile;
  } catch {
    return FALLBACK_PROFILE;
  }
}
