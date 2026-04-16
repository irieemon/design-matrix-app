/**
 * Indirection module for the CSRF bootstrap call from useAuth's useEffect.
 *
 * Why this exists: Roz's terminal-logout test (ADR-0016 Step 3) uses
 * `vi.doMock('../useAuth')` to override `bootstrapCsrfCookie`. To honor the
 * mock, the runner reads `bootstrapCsrfCookie` from the useAuth module
 * NAMESPACE object at call time (not at module load), via a static
 * `import * as useAuthMod from './useAuth'`. Property access at call time
 * picks up whatever the namespace currently exposes — including the
 * mocked function after `vi.doMock` + `vi.resetModules()` re-evaluation.
 *
 * The previous design used `await import('./useAuth')` chained through a
 * second dynamic import — that pattern is fragile under vitest's module
 * cache reset semantics (the inner dynamic import re-resolved past the
 * mock factory). Static namespace import + late property read is the
 * established pattern in this codebase (see BaseAiService.ts:13).
 */

import type { BootstrapCsrfOutcome } from './useAuth'

export async function runCsrfBootstrapAndMaybeLogout(): Promise<BootstrapCsrfOutcome> {
  // Dynamic import of the useAuth module surface so vi.doMock('../useAuth')
  // can substitute the bootstrapCsrfCookie binding at call time. The test
  // pre-populates vitest's module cache with the mocked useAuth via
  // `vi.doMock(...) + vi.resetModules() + import('../useAuth')`; this dynamic
  // import resolves to that same cached mocked namespace.
  const useAuthMod = await import('./useAuth')
  return useAuthMod.bootstrapCsrfCookie()
}
