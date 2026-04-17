/**
 * ADR-0017 Wave A — Structural assertions (T-0017-A01..A10, A17, A18)
 *
 * These tests are grep/fs-based structural contracts describing the
 * post-Wave-A state of the repository. They consume source files from disk
 * and assert the absence of legacy auth-hardening artifacts that Wave A
 * deletes or consolidates.
 *
 * ── T-IDs covered ─────────────────────────────────────────────────────────
 *   T-0017-A01  AuthScreen imports drop useSecureAuthContext / SecureAuthContext
 *   T-0017-A02  AuthScreen drops VITE_FEATURE_HTTPONLY_AUTH reference
 *   T-0017-A03  AuthScreen.handleSubmit has single code path to signInWithPassword
 *               (no `secureAuth.login` branch — no intermediary)
 *   T-0017-A04  src/hooks/useSecureAuth.ts no longer exists
 *   T-0017-A05  src/hooks/useOptimizedAuth.ts no longer exists
 *   T-0017-A06  src/contexts/SecureAuthContext.tsx no longer exists
 *   T-0017-A07  src/lib/authClient.ts no longer uses dynamic `sb-api-client-${...}` storageKey
 *   T-0017-A08  AuthScreen's useOptionalSecureAuthContext wrapper is deleted
 *   T-0017-A09  AuthScreen.handleSubmit does NOT call submitButtonRef.current?.setState(...)
 *   T-0017-A10  AuthScreen.handleSubmit finally block does NOT call setTimeout(..., 500)
 *   T-0017-A17  useOptimizedMatrix.ts uses createAuthenticatedClientFromLocalStorage helper
 *               and does NOT call supabase.auth.getSession directly
 *   T-0017-A18  src/lib/authHeaders.ts uses createAuthenticatedClientFromLocalStorage helper
 *               and does NOT call supabase.auth.getSession directly
 *
 * ── Expected BEFORE Wave A (today) ────────────────────────────────────────
 *   FAIL — all A01..A10 assertions flag the current legacy state:
 *     A01 FAIL (SecureAuthContext import present in AuthScreen.tsx:8)
 *     A02 FAIL (VITE_FEATURE_HTTPONLY_AUTH present in AuthScreen.tsx:33)
 *     A03 FAIL (`secureAuth.login` branch present in AuthScreen.tsx:212)
 *     A04 FAIL (useSecureAuth.ts exists, 7267 bytes)
 *     A05 FAIL (useOptimizedAuth.ts exists, 13944 bytes)
 *     A06 FAIL (SecureAuthContext.tsx exists, 3058 bytes)
 *     A07 FAIL (authClient.ts:52 uses `sb-api-client-${Date.now()}` storageKey)
 *     A08 FAIL (useOptionalSecureAuthContext defined in AuthScreen.tsx:14-21)
 *     A09 FAIL (submitButtonRef.current?.setState calls at AuthScreen.tsx:168,260,277)
 *     A10 FAIL (setTimeout(..., 500) in handleSubmit finally at AuthScreen.tsx:275-279)
 *
 *   Mixed — A17 GREEN as regression lock, A18 RED today:
 *     A17 PASS (useOptimizedMatrix.ts already imports + calls the helper at line 12/18)
 *     A18 FAIL (authHeaders.ts:22 still calls supabase.auth.getSession directly)
 *
 * ── Expected AFTER Wave A (Colby's target state) ──────────────────────────
 *   PASS — all structural concerns disappear from the code.
 *
 * ── Mechanics ─────────────────────────────────────────────────────────────
 *   These tests DO NOT execute production code. They read source files via
 *   `fs.readFileSync` and `fs.existsSync`, rooted at `process.cwd()`, and
 *   apply regex matching. That keeps the assertions immune to runtime
 *   mock-graph drift and observes the repo shape directly.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Repository roots resolved from process.cwd(). Vitest invokes from the
// worktree root, so these paths line up with the src tree at runtime.
const REPO_ROOT = process.cwd()
const AUTH_SCREEN_PATH = resolve(REPO_ROOT, 'src/components/auth/AuthScreen.tsx')
const AUTH_CLIENT_PATH = resolve(REPO_ROOT, 'src/lib/authClient.ts')
const USE_SECURE_AUTH_PATH = resolve(REPO_ROOT, 'src/hooks/useSecureAuth.ts')
const USE_OPTIMIZED_AUTH_PATH = resolve(REPO_ROOT, 'src/hooks/useOptimizedAuth.ts')
const SECURE_AUTH_CONTEXT_PATH = resolve(REPO_ROOT, 'src/contexts/SecureAuthContext.tsx')
const USE_OPTIMIZED_MATRIX_PATH = resolve(REPO_ROOT, 'src/hooks/useOptimizedMatrix.ts')
const AUTH_HEADERS_PATH = resolve(REPO_ROOT, 'src/lib/authHeaders.ts')

function readSource(absolutePath: string): string {
  return readFileSync(absolutePath, 'utf8')
}

/**
 * Extract the body of the `handleSubmit` async function from AuthScreen
 * source. Scope-limited to avoid false positives from other functions.
 * Returns empty string if the function signature cannot be located —
 * which itself is an authoring signal rather than a silent pass.
 */
function extractHandleSubmitBody(source: string): string {
  const signatureIndex = source.indexOf('const handleSubmit = async (')
  if (signatureIndex === -1) {
    return ''
  }
  // Walk forward counting braces from the first `{` after the signature
  // until depth returns to zero. Handles arrow-function body matching
  // without depending on a single-line regex.
  const openBrace = source.indexOf('{', signatureIndex)
  if (openBrace === -1) {
    return ''
  }
  let depth = 0
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return source.slice(openBrace, i + 1)
      }
    }
  }
  return source.slice(openBrace)
}

describe('ADR-0017 Wave A — structural assertions', () => {
  describe('AuthScreen source contract', () => {
    it('[T-0017-A01] AuthScreen does not import useSecureAuthContext, SecureAuthContext, or useOptionalSecureAuthContext', () => {
      const source = readSource(AUTH_SCREEN_PATH)
      // Three reverse-oracle regexes; all must return zero matches after Wave A.
      expect(source).not.toMatch(/from\s+['"][^'"]*SecureAuthContext['"]/)
      expect(source).not.toMatch(/\buseSecureAuthContext\b/)
      expect(source).not.toMatch(/\buseOptionalSecureAuthContext\b/)
    })

    it('[T-0017-A02] AuthScreen does not reference VITE_FEATURE_HTTPONLY_AUTH', () => {
      const source = readSource(AUTH_SCREEN_PATH)
      expect(source).not.toMatch(/VITE_FEATURE_HTTPONLY_AUTH/)
    })

    it('[T-0017-A03] AuthScreen.handleSubmit login branch has no secureAuth.login intermediary', () => {
      const source = readSource(AUTH_SCREEN_PATH)
      const body = extractHandleSubmitBody(source)
      // Guard: if body extraction failed, surface the authoring error rather
      // than passing silently.
      expect(body.length).toBeGreaterThan(0)
      // Single code path contract: no secureAuth.login(...) call anywhere in
      // handleSubmit. Post-Wave-A the mode==='login' branch calls
      // supabase.auth.signInWithPassword directly with no branch on a
      // feature flag or context presence.
      expect(body).not.toMatch(/\bsecureAuth\s*\.\s*login\b/)
      expect(body).not.toMatch(/\buseNewAuth\s*&&\s*secureAuth\b/)
      // Positive witness that the canonical SDK call is still present so
      // this assertion doesn't pass vacuously if the file is renamed or
      // gutted.
      expect(body).toMatch(/supabase\s*\.\s*auth\s*\.\s*signInWithPassword\s*\(/)
    })

    it('[T-0017-A08] AuthScreen deletes useOptionalSecureAuthContext wrapper function', () => {
      const source = readSource(AUTH_SCREEN_PATH)
      // The declaration AND any call site must both be gone.
      expect(source).not.toMatch(/function\s+useOptionalSecureAuthContext\s*\(/)
      expect(source).not.toMatch(/\buseOptionalSecureAuthContext\s*\(/)
    })

    it('[T-0017-A09] AuthScreen.handleSubmit does not imperatively call submitButtonRef.current?.setState', () => {
      const source = readSource(AUTH_SCREEN_PATH)
      const body = extractHandleSubmitBody(source)
      expect(body.length).toBeGreaterThan(0)
      // `?.setState(` covers both optional-chain and non-null-assertion
      // forms because we match the method name directly on submitButtonRef.
      expect(body).not.toMatch(/submitButtonRef\s*\.\s*current\s*\??\s*\.\s*setState\s*\(/)
    })

    it('[T-0017-A10] AuthScreen.handleSubmit finally block does not call setTimeout with a 500ms delay', () => {
      const source = readSource(AUTH_SCREEN_PATH)
      const body = extractHandleSubmitBody(source)
      expect(body.length).toBeGreaterThan(0)
      // Forbid any `setTimeout(..., 500)` within handleSubmit. The reset-
      // button-state side-effect is what Wave A deletes.
      expect(body).not.toMatch(/setTimeout\s*\([\s\S]*?,\s*500\s*\)/)
    })
  })

  describe('Deleted hook and context files', () => {
    it('[T-0017-A04] src/hooks/useSecureAuth.ts does not exist', () => {
      expect(existsSync(USE_SECURE_AUTH_PATH)).toBe(false)
    })

    it('[T-0017-A05] src/hooks/useOptimizedAuth.ts does not exist', () => {
      expect(existsSync(USE_OPTIMIZED_AUTH_PATH)).toBe(false)
    })

    it('[T-0017-A06] src/contexts/SecureAuthContext.tsx does not exist', () => {
      expect(existsSync(SECURE_AUTH_CONTEXT_PATH)).toBe(false)
    })
  })

  describe('Supabase client consolidation', () => {
    it('[T-0017-A07] src/lib/authClient.ts does not use a dynamic sb-api-client-${...} storageKey', () => {
      // Guard: if the file itself has been deleted in Wave A, treat that as
      // a pass — the reverse-oracle is about the storageKey pattern, not
      // the file's existence.
      if (!existsSync(AUTH_CLIENT_PATH)) {
        return
      }
      const source = readSource(AUTH_CLIENT_PATH)
      expect(source).not.toMatch(/sb-api-client-\$\{/)
    })
  })

  describe('[T-0017-A17] useOptimizedMatrix uses createAuthenticatedClientFromLocalStorage helper', () => {
    // Regression lock: the hook already consolidated onto the shared helper
    // (line 12 import, line 18 use). This test pins that state so Wave B /
    // future refactors cannot silently reintroduce a direct getSession() call
    // on the singleton client (which deadlocks on navigator.locks).
    it('imports createAuthenticatedClientFromLocalStorage from ../lib/supabase', () => {
      const source = readSource(USE_OPTIMIZED_MATRIX_PATH)
      expect(source).toMatch(
        /import\s*\{[^}]*\bcreateAuthenticatedClientFromLocalStorage\b[^}]*\}\s*from\s*['"][^'"]*supabase['"]/
      )
    })

    it('does NOT call supabase.auth.getSession directly', () => {
      const source = readSource(USE_OPTIMIZED_MATRIX_PATH)
      // Forbid `supabase.auth.getSession(` — whitespace-tolerant. Any
      // re-introduction of a direct session read on the singleton client
      // trips this reverse oracle.
      expect(source).not.toMatch(/supabase\s*\.\s*auth\s*\.\s*getSession\s*\(/)
    })
  })

  describe('[T-0017-A18] authHeaders.ts uses createAuthenticatedClientFromLocalStorage (no direct getSession)', () => {
    // Currently RED: src/lib/authHeaders.ts:22 calls
    // `await supabase.auth.getSession()` which triggers the GoTrueClient
    // navigator.locks deadlock under the shared singleton. Wave A
    // consolidates this onto the lock-free helper.
    it('imports createAuthenticatedClientFromLocalStorage from ./supabase', () => {
      const source = readSource(AUTH_HEADERS_PATH)
      expect(source).toMatch(
        /import\s*\{[^}]*\bcreateAuthenticatedClientFromLocalStorage\b[^}]*\}\s*from\s*['"][^'"]*supabase['"]/
      )
    })

    it('does NOT call supabase.auth.getSession directly', () => {
      const source = readSource(AUTH_HEADERS_PATH)
      expect(source).not.toMatch(/supabase\s*\.\s*auth\s*\.\s*getSession\s*\(/)
    })
  })
})
