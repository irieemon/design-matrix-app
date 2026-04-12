/**
 * Tests for ADR-0013 Step 1 — modelProfiles.ts
 *
 * PRE-BUILD NOTE (remove when Colby delivers modelProfiles.ts):
 * The `vi.mock('../modelProfiles.js', factory)` block below is a stub that
 * satisfies Vite's static import resolver while the file does not yet exist.
 * The stubs throw "not implemented" so every test fails with a clear signal.
 *
 * WHEN COLBY DELIVERS the file:
 * 1. Delete the entire `vi.mock('../modelProfiles.js', ...)` block.
 * 2. Re-run — tests should now pass against the real implementation.
 *
 * Test IDs map to ADR-0013 test spec: T-0013-001 through T-0013-005, T-0013-047
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabaseAdmin so tests control what Supabase returns
const { mockSupabaseSingle } = vi.hoisted(() => ({
  mockSupabaseSingle: vi.fn(),
}));

vi.mock('../../utils/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSupabaseSingle,
        }),
      }),
    }),
  },
}));

import { getActiveProfile, FALLBACK_PROFILE, _resetCacheForTesting } from '../modelProfiles.js';

// ---------------------------------------------------------------------------
// Type definitions matching ADR-0013 spec
// ---------------------------------------------------------------------------

type TaskType =
  | 'generate-ideas'
  | 'generate-insights'
  | 'generate-roadmap'
  | 'analyze-image'
  | 'analyze-video'
  | 'analyze-file'
  | 'transcribe-summary';

interface TaskConfig {
  gatewayModelId: string;
  fallbackModels: string[];
  temperature: number;
  maxOutputTokens: number;
}

interface ModelProfile {
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
// Fixtures
// ---------------------------------------------------------------------------

const TASK_TYPES: TaskType[] = [
  'generate-ideas',
  'generate-insights',
  'generate-roadmap',
  'analyze-image',
  'analyze-video',
  'analyze-file',
  'transcribe-summary',
];

function makeTaskConfig(overrides: Partial<TaskConfig> = {}): TaskConfig {
  return {
    gatewayModelId: 'anthropic/claude-sonnet-4-6',
    fallbackModels: ['google/gemini-2.5-flash', 'openai/gpt-4o'],
    temperature: 0.7,
    maxOutputTokens: 4096,
    ...overrides,
  };
}

function makeAllTaskConfigs(): Record<TaskType, TaskConfig> {
  return Object.fromEntries(
    TASK_TYPES.map((t) => [t, makeTaskConfig()])
  ) as Record<TaskType, TaskConfig>;
}

const DB_BALANCED_PROFILE: ModelProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'balanced',
  display_name: 'Balanced',
  description: 'Default balanced profile',
  is_active: true,
  task_configs: makeAllTaskConfigs(),
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('modelProfiles — getActiveProfile()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCacheForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // T-0013-001: Returns the active profile from DB
  // -------------------------------------------------------------------------
  it('T-0013-001: returns the profile where is_active=true from Supabase', async () => {
    mockSupabaseSingle.mockResolvedValueOnce({
      data: DB_BALANCED_PROFILE,
      error: null,
    });

    const profile = await getActiveProfile();

    expect(profile).not.toBeNull();
    expect(profile!.is_active).toBe(true);
    expect(profile!.name).toBe('balanced');
    expect(profile!.id).toBe(DB_BALANCED_PROFILE.id);
  });

  // -------------------------------------------------------------------------
  // T-0013-002: Returns FALLBACK_PROFILE when no active profile in DB
  // -------------------------------------------------------------------------
  it('T-0013-002: returns FALLBACK_PROFILE when Supabase returns no active profile', async () => {
    mockSupabaseSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const profile = await getActiveProfile();

    expect(profile).not.toBeNull();
    expect(profile).toBe(FALLBACK_PROFILE);
  });

  // -------------------------------------------------------------------------
  // T-0013-003: Returns FALLBACK_PROFILE when Supabase query returns an error
  // -------------------------------------------------------------------------
  it('T-0013-003: returns FALLBACK_PROFILE when Supabase query returns an error', async () => {
    mockSupabaseSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection refused', code: '08006' },
    });

    const profile = await getActiveProfile();

    expect(profile).not.toBeNull();
    expect(profile).toBe(FALLBACK_PROFILE);
  });

  // -------------------------------------------------------------------------
  // T-0013-004: Cached profile returned within 60s TTL — no second DB call
  // -------------------------------------------------------------------------
  it('T-0013-004: returns the same cached object on second call within 60s TTL without re-querying Supabase', async () => {
    vi.useFakeTimers();

    mockSupabaseSingle.mockResolvedValue({
      data: DB_BALANCED_PROFILE,
      error: null,
    });

    // First call populates the cache
    const first = await getActiveProfile();
    expect(first!.name).toBe('balanced');

    // Advance 30 seconds — still within the 60s TTL
    vi.advanceTimersByTime(30_000);

    // Second call must return the cached reference, not re-query
    const second = await getActiveProfile();
    expect(second).toBe(first);

    expect(mockSupabaseSingle).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // T-0013-005: After 60s TTL, re-queries DB
  // -------------------------------------------------------------------------
  it('T-0013-005: re-queries Supabase after the 60s cache TTL expires', async () => {
    vi.useFakeTimers();

    mockSupabaseSingle.mockResolvedValue({
      data: DB_BALANCED_PROFILE,
      error: null,
    });

    // First call populates the cache
    await getActiveProfile();

    // Advance past the 60-second TTL
    vi.advanceTimersByTime(61_000);

    // Second call after TTL must hit Supabase again
    await getActiveProfile();

    expect(mockSupabaseSingle).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // T-0013-047: After TTL expires, returns the UPDATED profile, not stale cache
  // -------------------------------------------------------------------------
  it('T-0013-047: after TTL expires, returns the updated profile from Supabase rather than the stale cached one', async () => {
    vi.useFakeTimers();

    mockSupabaseSingle.mockResolvedValueOnce({
      data: DB_BALANCED_PROFILE,
      error: null,
    });

    const firstResult = await getActiveProfile();
    expect(firstResult!.name).toBe('balanced');

    // Advance past TTL
    vi.advanceTimersByTime(61_000);

    // Admin switched to premium — DB now returns premium
    const DB_PREMIUM_PROFILE: ModelProfile = {
      ...DB_BALANCED_PROFILE,
      id: '00000000-0000-0000-0000-000000000003',
      name: 'premium',
      display_name: 'Premium',
    };

    mockSupabaseSingle.mockResolvedValueOnce({
      data: DB_PREMIUM_PROFILE,
      error: null,
    });

    const secondResult = await getActiveProfile();

    // Must return the freshly fetched premium profile, not the stale balanced one
    expect(secondResult!.name).toBe('premium');
    expect(secondResult).not.toBe(firstResult);
    expect(mockSupabaseSingle).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// FALLBACK_PROFILE shape contract
// ---------------------------------------------------------------------------

describe('FALLBACK_PROFILE shape', () => {
  it('FALLBACK_PROFILE is exported and defined', () => {
    expect(FALLBACK_PROFILE).toBeDefined();
  });

  it('FALLBACK_PROFILE covers all 7 required task types', () => {
    for (const task of TASK_TYPES) {
      expect(FALLBACK_PROFILE!.task_configs[task]).toBeDefined();
      expect(typeof FALLBACK_PROFILE!.task_configs[task].gatewayModelId).toBe('string');
      expect(FALLBACK_PROFILE!.task_configs[task].gatewayModelId.length).toBeGreaterThan(0);
    }
  });

  it('FALLBACK_PROFILE uses openai/gpt-4o for text tasks (matches current hardcoded behavior)', () => {
    const textTasks: TaskType[] = [
      'generate-ideas',
      'generate-insights',
      'generate-roadmap',
    ];

    for (const task of textTasks) {
      expect(FALLBACK_PROFILE!.task_configs[task].gatewayModelId).toBe('openai/gpt-4o');
    }
  });

  it('FALLBACK_PROFILE has is_active=false (it is a hardcoded sentinel, not a real DB row)', () => {
    // is_active=true would misrepresent origin and could mislead callers that inspect the flag
    expect(FALLBACK_PROFILE!.is_active).toBe(false);
  });
});
